"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  BookOpen,
  Check,
  Star,
  Clock,
  RefreshCw,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { ArticleCardSkeleton } from "@/components/ui/skeleton";
import type { Article } from "@/types/reader";
import { useState } from "react";

/**
 * 列表项缩略图。
 *
 * 单独抽成组件只是为了持有一个「加载失败」的局部状态：RSS 里的
 * image_url 经常指向防盗链、已删除或需要特定 Referer 的图片，
 * 加载失败时浏览器会渲染成一块灰色方块，比没有图还难看。
 * 这里失败后直接不渲染，让列表项退化成纯文字（与无图文章一致）。
 */
function Thumbnail({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  return (
    <div className="w-24 h-24 shrink-0 rounded-lg overflow-hidden bg-[#f0f0f0] dark:bg-[#2a2a2a]">
      {/* 用原生 img 而非 next/image：next.config.mjs 已关掉图片优化器
          （images.unoptimized），RSS 的图床域名无法穷举成白名单。 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        className="w-full h-full object-cover"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

interface ArticleListProps {
  articles: Article[];
  selectedArticle: Article | null;
  loading: boolean;
  totalArticles: number;
  syncing: boolean;
  feedListCollapsed: boolean;
  onSelectArticle: (article: Article) => void;
  onRefresh: () => void;
  onMarkAllRead: () => void;
  onToggleCollapse: () => void;
  /** 当前排序方向 */
  sortOrder: "newest" | "oldest";
  /** 切换排序 */
  onToggleSort: () => void;
  /** 紧凑模式：隐藏摘要与缩略图，同样高度能看到更多条目 */
  compactView?: boolean;
}

export function ArticleList({
  articles,
  selectedArticle,
  loading,
  totalArticles,
  syncing,
  feedListCollapsed,
  onSelectArticle,
  onRefresh,
  onMarkAllRead,
  onToggleCollapse,
  sortOrder,
  onToggleSort,
  compactView = false,
}: ArticleListProps) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-[#1c1c1e] flex flex-col border-r border-[#e0e0e0] dark:border-[#2a2a2a] transition-all duration-300",
        // 小屏：列表占满整宽；md 起固定 26rem，可折叠
        feedListCollapsed
          ? "w-0 overflow-hidden opacity-0"
          : "w-full md:w-[26rem] opacity-100"
      )}
    >
      {/* Header */}
      <div className="h-12 px-3 flex items-center justify-between border-b border-[#e0e0e0] dark:border-[#2a2a2a] bg-white dark:bg-[#1c1c1e]">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-[15px] text-[#1a1a1a] dark:text-white">
            文章
          </h2>
          <span className="text-xs text-[#999] bg-[#f0f0f0] dark:bg-[#2a2a2a] px-2 py-0.5 rounded-full">
            {totalArticles}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* 排序方向：QiReader 等阅读器都有「从旧到新」，
              补看积压文章时按发布时间正序更符合阅读顺序 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-[#666] hover:text-[#1a1a1a] hover:bg-[#f0f0f0] dark:text-[#999] dark:hover:text-white dark:hover:bg-[#2a2a2a]"
            onClick={onToggleSort}
            title={sortOrder === "newest" ? "当前：最新在前（点击切换）" : "当前：从旧到新（点击切换）"}
          >
            {sortOrder === "newest" ? (
              <ArrowDownWideNarrow className="h-4 w-4" />
            ) : (
              <ArrowUpNarrowWide className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-[#666] hover:text-[#1a1a1a] hover:bg-[#f0f0f0] dark:text-[#999] dark:hover:text-white dark:hover:bg-[#2a2a2a]"
            onClick={onMarkAllRead}
            title="全部已读"
            aria-label="全部已读"
          >
            <CheckCheck className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-[#666] hover:text-[#1a1a1a] hover:bg-[#f0f0f0] dark:text-[#999] dark:hover:text-white dark:hover:bg-[#2a2a2a]"
            onClick={onRefresh}
            disabled={syncing}
            title="刷新"
          >
            <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-[#666] hover:text-[#1a1a1a] hover:bg-[#f0f0f0] dark:text-[#999] dark:hover:text-white dark:hover:bg-[#2a2a2a] lg:hidden"
            onClick={onToggleCollapse}
          >
            {feedListCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Article List */}
      <ScrollArea className="flex-1">
        <div className="divide-y divide-[#f0f0f0] dark:divide-[#2a2a2a]">
          {loading ? (
            <div className="p-4 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <ArticleCardSkeleton
                  key={i}
                  className="bg-transparent"
                />
              ))}
            </div>
          ) : !articles || articles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[#999]">
              <BookOpen className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-sm">暂无文章</p>
            </div>
          ) : (
            articles.map((article, index) => (
              <button
                key={article.id}
                onClick={() => onSelectArticle(article)}
                className={cn(
                  "w-full text-left px-4 py-4 transition-all duration-200 group",
                  // 点下去有轻微内缩反馈，避免「点了没反应」的错觉
                  "active:scale-[0.995]",
                  "animate-in fade-in-0 slide-in-from-left-1",
                  "hover:bg-[#f8f8f8] dark:hover:bg-[#252525]",
                  selectedArticle?.id === article.id
                    ? "bg-[#007AFF]/[0.07] dark:bg-[#007AFF]/[0.18] border-l-[3px] border-l-[#007AFF]"
                    : "border-l-[3px] border-l-transparent hover:border-l-[#ddd] dark:hover:border-l-[#444]"
                )}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                {/* Source & Time */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-[#007AFF] truncate max-w-[60%]">
                    {article.feed?.title}
                  </span>
                  <span className="text-xs text-[#bbb]">·</span>
                  <span className="text-xs text-[#999] shrink-0">
                    {formatDate(article.pubDate)}
                  </span>
                  {!article.isRead && (
                    <span className="ml-auto w-2 h-2 rounded-full bg-[#007AFF] shrink-0" />
                  )}
                </div>

                {/* 标题 + 缩略图并排：有封面图时右侧留出 96px 图片位，
                    标题可用宽度随之变窄，但整体信息密度和可扫读性更高。 */}
                <div className="flex gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className={cn(
                      "text-[15px] leading-snug mb-2 line-clamp-2",
                      !article.isRead
                        ? "font-semibold text-[#1a1a1a] dark:text-white"
                        : "font-normal text-[#666] dark:text-[#999]"
                    )}>
                      {article.title}
                    </h3>

                    {!compactView && (
                      <p className="text-[13px] text-[#888] dark:text-[#666] line-clamp-2 leading-relaxed">
                        {article.description}
                      </p>
                    )}
                  </div>

                  {!compactView && article.imageUrl ? (
                    <Thumbnail src={article.imageUrl} />
                  ) : null}
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 mt-3">
                  {article.isFavorited && (
                    <Star className="h-3.5 w-3.5 text-[#FFB800] fill-[#FFB800]" />
                  )}
                  {article.isRead && (
                    <span className="flex items-center gap-1 text-xs text-[#4ade80]">
                      <Check className="h-3 w-3" />
                      已读
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
