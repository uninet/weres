"use client";

import { useRef } from "react";
import { useScrollToRead } from "@/hooks/use-scroll-to-read";
import { useTextToSpeech, htmlToSpeakableText } from "@/hooks/use-text-to-speech";
import { Volume2, VolumeX, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Heart,
  Share2,
  Maximize2,
  Minimize2,
  Bookmark,
  Type,
  Sun,
  Moon,
  Tag as TagIcon,
  Plus,
  Check,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getFontSizeClass,
  getFontFamilyClass,
  getLineHeightClass,
  getContentWidthClass,
  getArticleContentVars,
  fontSizes,
  fontFamilies,
  lineHeightOptions,
  contentWidthOptions,
} from "@/lib/reader-config";
import type { Article } from "@/types/reader";

interface ArticleContentProps {
  article: Article | null;
  articles: Article[];
  loading: boolean;
  isImmersiveMode: boolean;
  feedListCollapsed: boolean;
  showSettings: boolean;
  fontSize: string;
  fontFamily: string;
  lineHeight: string;
  contentWidth: string;
  isDarkMode: boolean;
  isGuest: boolean;
  onToggleImmersive: () => void;
  onToggleFeedList: () => void;
  onToggleDarkMode: () => void;
  onPrevArticle: () => void;
  onNextArticle: () => void;
  onShowSettingsChange: (open: boolean) => void;
  onFontSizeChange: (value: string) => void;
  onFontFamilyChange: (value: string) => void;
  onLineHeightChange: (value: string) => void;
  onContentWidthChange: (value: string) => void;
  onShowRestriction: (feature: string) => void;
  /** 滚动到一定进度后自动标记已读（QiReader 同款行为） */
  onMarkReadByScroll?: (articleId: string) => void;
  /** 收藏 / 取消收藏当前文章。原实现里登录用户点收藏什么都不发生。 */
  onToggleFavorite?: (articleId: string, nextStarred: boolean) => void;
  /** 服务端是否配了 SMTP。没配就不渲染推送按钮，避免点了才报错。 */
  kindleEnabled?: boolean;
  kindlePushing?: boolean;
  onPushToKindle?: (articleId: string) => void;
  /** 该用户已有的全部标签 */
  allTags?: Array<{ id: string; name: string; color: string }>;
  /** 当前文章已打的标签 */
  articleTags?: Array<{ id: string; name: string; color: string }>;
  onAttachTag?: (tag: { id: string; name: string; color: string }) => void;
  onDetachTag?: (tagId: string) => void;
  onCreateTag?: (name: string) => void;
  /** 轻量提示通道（复制链接这类小反馈用） */
  onNotify?: (message: string, kind: "success" | "error") => void;
}

export function ArticleContent({
  article,
  articles,
  loading,
  isImmersiveMode,
  feedListCollapsed,
  showSettings,
  fontSize,
  fontFamily,
  lineHeight,
  contentWidth,
  isDarkMode,
  isGuest,
  onToggleImmersive,
  onToggleFeedList,
  onToggleDarkMode,
  onPrevArticle,
  onNextArticle,
  onShowSettingsChange,
  onFontSizeChange,
  onFontFamilyChange,
  onLineHeightChange,
  onContentWidthChange,
  onShowRestriction,
  onMarkReadByScroll,
  onToggleFavorite,
  kindleEnabled = false,
  kindlePushing = false,
  onPushToKindle,
  allTags = [],
  articleTags = [],
  onAttachTag,
  onDetachTag,
  onCreateTag,
  onNotify,
}: ArticleContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 文本转语音：浏览器内置 Web Speech API，不需要任何外部服务
  const tts = useTextToSpeech();

  // 滚动即已读：真正读完才标记，避免快速翻找时把路过的都变成已读
  useScrollToRead({
    containerRef: scrollRef,
    articleId: article?.id,
    // 已读过的不必再监听
    enabled: Boolean(article && !article.isRead && onMarkReadByScroll),
    onRead: (id) => onMarkReadByScroll?.(id),
  });

  const currentIndex = article
    ? articles.findIndex((a) => a.id === article.id)
    : -1;
  const hasPrevArticle = currentIndex > 0;
  const hasNextArticle = currentIndex >= 0 && currentIndex < articles.length - 1;

  if (!article) {
    return (
      <div className="reader-surface flex-1 flex items-center justify-center bg-[#fafafa] dark:bg-[#0d0d0d]">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-[#e8e8e8] to-[#d0d0d0] dark:from-[#2a2a2a] dark:to-[#1a1a1a] rounded-2xl flex items-center justify-center mx-auto mb-6">
            <BookOpen className="h-10 w-10 text-[#999] dark:text-[#666]" />
          </div>
          <p className="text-lg font-medium text-[#666] dark:text-[#999]">
            选择一篇文章开始阅读
          </p>
          <p className="text-sm mt-2 text-[#999] dark:text-[#666]">享受沉浸式阅读体验</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={contentRef}
      className={cn(
        "reader-surface flex-1 flex flex-col bg-[#fafafa] dark:bg-[#0d0d0d] overflow-hidden transition-all duration-300",
        isImmersiveMode && "fixed inset-0 z-[100]"
      )}
    >
      {/* Toolbar */}
      <div className="h-14 border-b border-[#e0e0e0] dark:border-[#2a2a2a] bg-white dark:bg-[#1c1c1e] flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-1">
          {/* Collapse Feed List Button (mobile/tablet) */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg lg:hidden text-[#666] hover:bg-[#f0f0f0] dark:text-[#999] dark:hover:bg-[#2a2a2a]"
            onClick={onToggleFeedList}
          >
            {feedListCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg text-[#666] hover:text-[#1a1a1a] hover:bg-[#f0f0f0] dark:text-[#999] dark:hover:text-white dark:hover:bg-[#2a2a2a]"
                onClick={onPrevArticle}
                disabled={!hasPrevArticle}
              >
                <ChevronLeft
                  className={cn("h-4 w-4", !hasPrevArticle && "text-[#ccc] dark:text-[#444]")}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>上一篇</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg text-[#666] hover:text-[#1a1a1a] hover:bg-[#f0f0f0] dark:text-[#999] dark:hover:text-white dark:hover:bg-[#2a2a2a]"
                onClick={onNextArticle}
                disabled={!hasNextArticle}
              >
                <ChevronRight
                  className={cn("h-4 w-4", !hasNextArticle && "text-[#ccc] dark:text-[#444]")}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>下一篇</TooltipContent>
          </Tooltip>
          <span className="text-xs text-[#999] ml-2 font-medium">
            {currentIndex + 1} / {articles.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Reading Settings */}
          <DropdownMenu open={showSettings} onOpenChange={onShowSettingsChange}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-lg text-[#666] hover:text-[#1a1a1a] hover:bg-[#f0f0f0] dark:text-[#999] dark:hover:text-white dark:hover:bg-[#2a2a2a]"
                  >
                    <Type className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>阅读设置</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-56 p-4 space-y-4">
              {/* Font Size */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#666] dark:text-[#999]">字体大小</label>
                <div className="flex gap-1">
                  {fontSizes.map((size) => (
                    <button
                      key={size.value}
                      onClick={() => onFontSizeChange(size.value)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-sm transition-colors",
                        fontSize === size.value
                          ? "bg-[#007AFF] text-white"
                          : "bg-[#f0f0f0] text-[#666] hover:bg-[#e0e0e0] dark:bg-[#2a2a2a] dark:text-[#999] dark:hover:bg-[#333]"
                      )}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Family */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#666] dark:text-[#999]">字体样式</label>
                <div className="space-y-1">
                  {fontFamilies.map((font) => (
                    <button
                      key={font.value}
                      onClick={() => onFontFamilyChange(font.value)}
                      className={cn(
                        "w-full px-3 py-2 rounded-lg text-sm text-left transition-colors",
                        fontFamily === font.value
                          ? "bg-[#007AFF] text-white"
                          : "hover:bg-[#f0f0f0] dark:hover:bg-[#2a2a2a]"
                      )}
                    >
                      <span className={font.className}>{font.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Line Height */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#666] dark:text-[#999]">行间距</label>
                <div className="flex gap-1">
                  {lineHeightOptions.map((lh) => (
                    <button
                      key={lh.value}
                      onClick={() => onLineHeightChange(lh.value)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs transition-colors",
                        lineHeight === lh.value
                          ? "bg-[#007AFF] text-white"
                          : "bg-[#f0f0f0] text-[#666] hover:bg-[#e0e0e0] dark:bg-[#2a2a2a] dark:text-[#999] dark:hover:bg-[#333]"
                      )}
                    >
                      {lh.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Content Width */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-[#666] dark:text-[#999]">内容宽度</label>
                <div className="flex gap-1">
                  {contentWidthOptions.map((w) => (
                    <button
                      key={w.value}
                      onClick={() => onContentWidthChange(w.value)}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs transition-colors",
                        contentWidth === w.value
                          ? "bg-[#007AFF] text-white"
                          : "bg-[#f0f0f0] text-[#666] hover:bg-[#e0e0e0] dark:bg-[#2a2a2a] dark:text-[#999] dark:hover:bg-[#333]"
                      )}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg text-[#666] hover:text-[#1a1a1a] hover:bg-[#f0f0f0] dark:text-[#999] dark:hover:text-white dark:hover:bg-[#2a2a2a]"
                onClick={onToggleDarkMode}
              >
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isDarkMode ? "切换亮色" : "切换暗色"}</TooltipContent>
          </Tooltip>

          <Separator
            orientation="vertical"
            className="h-4 mx-1 bg-[#e0e0e0] dark:bg-[#2a2a2a]"
          />

          {/* 朗读（TTS） */}
          {tts.supported && article && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-9 w-9 rounded-lg text-[#666] hover:text-[#1a1a1a] hover:bg-[#f0f0f0] dark:text-[#999] dark:hover:text-white dark:hover:bg-[#2a2a2a]",
                    tts.speaking && "text-[#007AFF] dark:text-[#0a84ff]"
                  )}
                  onClick={() => {
                    if (isGuest) {
                      onShowRestriction("朗读");
                      return;
                    }
                    if (tts.speaking) {
                      tts.stop();
                    } else {
                      const text = htmlToSpeakableText(
                        article.content || article.description
                      );
                      if (!text) {
                        onShowRestriction("朗读");
                        return;
                      }
                      tts.play(`${article.title}。${text}`);
                    }
                  }}
                >
                  {tts.speaking ? (
                    <VolumeX className="h-4 w-4" />
                  ) : (
                    <Volume2 className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {tts.speaking ? "停止朗读" : "朗读文章"}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Immersive Mode */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg text-[#666] hover:text-[#1a1a1a] hover:bg-[#f0f0f0] dark:text-[#999] dark:hover:text-white dark:hover:bg-[#2a2a2a]"
                onClick={onToggleImmersive}
              >
                {isImmersiveMode ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isImmersiveMode ? "退出沉浸" : "沉浸阅读"}</TooltipContent>
          </Tooltip>

          {/* Actions */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-9 w-9 rounded-lg text-[#666] hover:text-[#1a1a1a] hover:bg-[#f0f0f0] dark:text-[#999] dark:hover:text-white dark:hover:bg-[#2a2a2a]",
                  article?.isFavorited && "text-[#FFB800] dark:text-[#FFB800]"
                )}
                onClick={() => {
                  if (isGuest) {
                    onShowRestriction("收藏");
                    return;
                  }
                  if (article && onToggleFavorite) {
                    onToggleFavorite(article.id, !article.isFavorited);
                  }
                }}
              >
                <Bookmark
                  className={cn(
                    "h-4 w-4",
                    article?.isFavorited && "fill-[#FFB800]"
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{article?.isFavorited ? "取消收藏" : "收藏"}</TooltipContent>
          </Tooltip>

          {/* 文章标签 */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "h-9 w-9 rounded-lg text-[#666] hover:text-[#1a1a1a] hover:bg-[#f0f0f0] dark:text-[#999] dark:hover:text-white dark:hover:bg-[#2a2a2a]",
                      articleTags.length > 0 && "text-[#007AFF]"
                    )}
                  >
                    <TagIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>
                {articleTags.length > 0
                  ? `标签（${articleTags.length}）`
                  : "添加标签"}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-52">
              {allTags.length === 0 && (
                <div className="px-2 py-1.5 text-[12px] text-[#999]">
                  还没有标签，在下方新建
                </div>
              )}
              {allTags.map((tag) => {
                const active = articleTags.some((t) => t.id === tag.id);
                return (
                  <DropdownMenuItem
                    key={tag.id}
                    onSelect={(event) => {
                      event.preventDefault();
                      if (isGuest) {
                        onShowRestriction("标签");
                        return;
                      }
                      if (active) {
                        onDetachTag?.(tag.id);
                      } else {
                        onAttachTag?.(tag);
                      }
                    }}
                  >
                    <span
                      className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="flex-1 truncate text-[13px]">
                      {tag.name}
                    </span>
                    {active && <Check className="h-3.5 w-3.5 text-[#007AFF]" />}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  if (isGuest) {
                    onShowRestriction("标签");
                    return;
                  }
                  // 用 prompt 而不是再开一个弹窗：建标签是个一步操作，
                  // 单独做一个表单弹窗的复杂度会超过它带来的价值。
                  const name = window.prompt("新标签名称（最多 20 字）");
                  if (name && name.trim()) {
                    onCreateTag?.(name.trim());
                  }
                }}
              >
                <Plus className="mr-2 h-3.5 w-3.5" />
                <span className="text-[13px]">新建标签…</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 推送 Kindle */}
          {kindleEnabled && article && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-lg text-[#666] hover:text-[#1a1a1a] hover:bg-[#f0f0f0] dark:text-[#999] dark:hover:text-white dark:hover:bg-[#2a2a2a]"
                  disabled={kindlePushing}
                  onClick={() => {
                    if (isGuest) {
                      onShowRestriction("推送 Kindle");
                      return;
                    }
                    onPushToKindle?.(article.id);
                  }}
                >
                  <BookOpen
                    className={cn(
                      "h-4 w-4",
                      kindlePushing && "animate-pulse text-[#FF9900]"
                    )}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>推送到 Kindle</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg text-[#666] hover:text-[#1a1a1a] hover:bg-[#f0f0f0] dark:text-[#999] dark:hover:text-white dark:hover:bg-[#2a2a2a]"
                onClick={() => {
                  // 复制原文链接给用户，而不是弹「分享成功」。
                  // 这个项目没有接社交平台 SDK，能给的只有链接本身。
                  if (!article?.link) return;
                  void navigator.clipboard
                    ?.writeText(article.link)
                    .then(() => onNotify?.("原文链接已复制", "success"))
                    .catch(() => onNotify?.("复制失败，请手动复制", "error"));
                }}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>复制原文链接</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg text-[#666] hover:text-[#1a1a1a] hover:bg-[#f0f0f0] dark:text-[#999] dark:hover:text-white dark:hover:bg-[#2a2a2a]"
                asChild
              >
                <a
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>原文链接</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Article Content */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        {loading ? (
          <div
            className={cn(
              "mx-auto px-8 py-16 space-y-6",
              getContentWidthClass(contentWidth)
            )}
          >
            {/* 标题骨架 */}
            <div className="space-y-4 text-center">
              <div className="flex items-center justify-center gap-2">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-14 w-full max-w-2xl mx-auto" />
              <div className="flex items-center justify-center gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            {/* 分隔线 */}
            <div className="w-24 h-px bg-gradient-to-r from-transparent via-[#007AFF] to-transparent mx-auto" />
            {/* 内容骨架 */}
            <div className="space-y-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className={cn(
                    "h-4",
                    i % 5 === 0
                      ? "w-full"
                      : i % 5 === 1
                      ? "w-[95%]"
                      : i % 5 === 2
                      ? "w-[90%]"
                      : i % 5 === 3
                      ? "w-[85%]"
                      : "w-full"
                  )}
                />
              ))}
            </div>
          </div>
        ) : (
          <article
            className={cn(
              "mx-auto px-8 py-12",
              getContentWidthClass(contentWidth),
              getFontSizeClass(fontSize),
              getFontFamilyClass(fontFamily),
              getLineHeightClass(lineHeight)
            )}
          >
            {/* Header */}
            <header className="mb-10">
              {/* Source Badge */}
              <div className="flex items-center gap-3 mb-6">
                <span className="px-3 py-1 bg-[#007AFF]/10 text-[#007AFF] rounded-full text-sm font-medium">
                  {article.feed?.title}
                </span>
                {!article.isRead ? (
                  <span className="px-2 py-0.5 bg-[#007AFF] text-white rounded-full text-xs">
                    未读
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-[#4ade80] text-white rounded-full text-xs flex items-center gap-1">
                    已读
                  </span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-6 leading-tight text-[#1a1a1a] dark:text-white">
                {article.title}
              </h1>

              {/* Meta */}
              <div className="flex items-center gap-4 text-sm text-[#666] dark:text-[#999]">
                {article.author && (
                  <span className="font-medium text-[#333] dark:text-[#ccc]">
                    {article.author}
                  </span>
                )}
                {article.author && <span className="text-[#ddd]">·</span>}
                <time>{formatDate(article.pubDate)}</time>
              </div>
            </header>

            {/* Divider */}
            <div className="w-12 h-0.5 bg-[#007AFF] mb-10" />

            {/* Content */}
            <div
              className="article-content prose prose-lg max-w-none dark:prose-invert"
              style={getArticleContentVars(fontSize, fontFamily, lineHeight)}
              dangerouslySetInnerHTML={{
                __html: article.content || article.description || "",
              }}
            />

            {/* Footer */}
            <footer className="mt-16 pt-8 border-t border-[#e0e0e0] dark:border-[#2a2a2a]">
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  className="gap-2 rounded-full px-6 border-[#e0e0e0] dark:border-[#2a2a2a] hover:bg-[#f0f0f0] dark:hover:bg-[#2a2a2a] hover:border-[#007AFF]"
                  onClick={() => {
                    if (isGuest) {
                      onShowRestriction("收藏");
                      return;
                    }
                    if (article && onToggleFavorite) {
                      onToggleFavorite(article.id, !article.isFavorited);
                    }
                  }}
                >
                  <Heart
                    className={cn(
                      "h-4 w-4 text-[#007AFF]",
                      article?.isFavorited && "fill-[#FFB800] text-[#FFB800]"
                    )}
                  />
                  <span className="text-[#333] dark:text-[#ccc]">
                    {article?.isFavorited ? "取消收藏" : "收藏文章"}
                  </span>
                </Button>
                <Button
                  variant="outline"
                  className="gap-2 rounded-full px-6 border-[#e0e0e0] dark:border-[#2a2a2a] hover:bg-[#f0f0f0] dark:hover:bg-[#2a2a2a] hover:border-[#007AFF]"
                  onClick={() => {
                    // 与工具栏那个分享按钮行为一致：复制原文链接。
                    // 之前这个按钮完全没有 onClick，点了什么都不发生。
                    if (!article?.link) {
                      onNotify?.("这篇文章没有原文链接", "error");
                      return;
                    }
                    void navigator.clipboard
                      ?.writeText(article.link)
                      .then(() => onNotify?.("原文链接已复制", "success"))
                      .catch(() => onNotify?.("复制失败，请手动复制", "error"));
                  }}
                >
                  <Share2 className="h-4 w-4 text-[#007AFF]" />
                  <span className="text-[#333] dark:text-[#ccc]">复制原文链接</span>
                </Button>
              </div>

              {/* Article Navigation */}
              <div className="flex items-center justify-between mt-12">
                <button
                  onClick={onPrevArticle}
                  disabled={!hasPrevArticle}
                  className={cn(
                    "flex items-center gap-2 text-sm transition-colors",
                    hasPrevArticle
                      ? "text-[#666] hover:text-[#1a1a1a] dark:text-[#999] dark:hover:text-white"
                      : "text-[#ccc] dark:text-[#444] cursor-not-allowed"
                  )}
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>上一篇</span>
                </button>

                <div className="flex gap-1.5">
                  {articles.slice(0, Math.min(articles.length, 5)).map((a) => (
                    <div
                      key={a.id}
                      className={cn(
                        "w-2 h-2 rounded-full transition-colors",
                        a.id === article.id
                          ? "bg-[#007AFF]"
                          : "bg-[#e0e0e0] dark:bg-[#2a2a2a]"
                      )}
                    />
                  ))}
                </div>

                <button
                  onClick={onNextArticle}
                  disabled={!hasNextArticle}
                  className={cn(
                    "flex items-center gap-2 text-sm transition-colors",
                    hasNextArticle
                      ? "text-[#666] hover:text-[#1a1a1a] dark:text-[#999] dark:hover:text-white"
                      : "text-[#ccc] dark:text-[#444] cursor-not-allowed"
                  )}
                >
                  <span>下一篇</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </footer>
          </article>
        )}
      </ScrollArea>
    </div>
  );
}
