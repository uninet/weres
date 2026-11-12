"use client";

import { useEffect, useRef } from "react";
import { useScrollToRead } from "@/hooks/use-scroll-to-read";
import { useTextToSpeech, htmlToSpeakableText } from "@/hooks/use-text-to-speech";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Heart,
  Maximize2,
  Minimize2,
  Bookmark,
  Share2,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ReaderMoreMenu } from "@/components/reader/reader-more-menu";
import { pageScroll, scrollReaderTo } from "@/lib/reader-paging";
import type { ReaderThemeId } from "@/hooks/use-reader-theme";
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
  /** 小屏上从正文返回列表（桌面走折叠按钮，不需要这个）。 */
  onBackToList?: () => void;
  onToggleDarkMode: () => void;
  onPrevArticle: () => void;
  onNextArticle: () => void;
  onShowSettingsChange: (open: boolean) => void;
  onFontSizeChange: (value: string) => void;
  onFontFamilyChange: (value: string) => void;
  onLineHeightChange: (value: string) => void;
  onContentWidthChange: (value: string) => void;
  /** 当前阅读主题（浅色 / 米黄 / 电子墨水 / 深色） */
  readerTheme: ReaderThemeId;
  onReaderThemeChange: (theme: ReaderThemeId) => void;
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
  onBackToList,
  onToggleDarkMode,
  onPrevArticle,
  onNextArticle,
  onShowSettingsChange,
  onFontSizeChange,
  onFontFamilyChange,
  onLineHeightChange,
  onContentWidthChange,
  readerTheme,
  onReaderThemeChange,
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

  // 空格键翻页。
  //
  // 滚动容器在 ArticleContent 内部（Radix ScrollArea），父组件的快捷键
  // 处理器拿不到它，所以这里监听一个自定义事件由父组件派发。
  // 比往上提 ref 简单：不需要改 ArticleContent 的对外接口，也不用
  // forwardRef + useImperativeHandle 那套仪式。
  useEffect(() => {
    const handlePage = (event: Event) => {
      const direction = (event as CustomEvent<"down" | "up">).detail;
      pageScroll(scrollRef.current, direction);
    };
    window.addEventListener("reader:page", handlePage);
    return () => window.removeEventListener("reader:page", handlePage);
  }, []);

  // 切换文章时把正文滚回顶部。
  // 不这么做的话，读到第 3 屏时按 n，新文章会从第 3 屏开始显示 ——
  // 用户看到的是文章中间某段，还以为内容坏了。
  useEffect(() => {
    scrollReaderTo(scrollRef.current, "top");
  }, [article?.id]);

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
      <div className="h-12 border-b border-[#e0e0e0] dark:border-[#2a2a2a] bg-white dark:bg-[#1c1c1e] flex items-center justify-between px-3 shrink-0">
        <div className="flex items-center gap-1">
          {/* Collapse Feed List Button (mobile/tablet) */}
          {/* 小屏：回到文章列表；md 以上：折叠/展开列表栏 */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg text-[#666] transition-all duration-150 hover:bg-black/[0.05] active:scale-90 dark:text-[#999] dark:hover:bg-white/[0.08] md:hidden"
            onClick={onBackToList ?? onToggleFeedList}
            title="返回列表"
            aria-label="返回列表"
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="hidden h-9 w-9 rounded-lg text-[#666] transition-all duration-150 hover:bg-black/[0.05] active:scale-90 dark:text-[#999] dark:hover:bg-white/[0.08] md:inline-flex"
            onClick={onToggleFeedList}
            title={feedListCollapsed ? "展开列表" : "折叠列表"}
            aria-label={feedListCollapsed ? "展开列表" : "折叠列表"}
          >
            {feedListCollapsed ? (
              <ChevronRight className="h-[18px] w-[18px]" />
            ) : (
              <ChevronLeft className="h-[18px] w-[18px]" />
            )}
          </Button>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg text-[#666] transition-all duration-150 hover:text-[#1a1a1a] hover:bg-black/[0.05] active:scale-90 dark:text-[#999] dark:hover:text-white dark:hover:bg-white/[0.08]"
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
                className="h-9 w-9 rounded-lg text-[#666] transition-all duration-150 hover:text-[#1a1a1a] hover:bg-black/[0.05] active:scale-90 dark:text-[#999] dark:hover:text-white dark:hover:bg-white/[0.08]"
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

        <div className="flex items-center gap-0.5">
          {/* 收藏：跟「这篇内容」直接相关，留在工具栏 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-9 w-9 rounded-lg text-[#666] transition-all duration-150 hover:bg-black/[0.05] hover:text-[#1a1a1a] active:scale-90 dark:text-[#999] dark:hover:bg-white/[0.08] dark:hover:text-white",
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
                    "h-[18px] w-[18px]",
                    article?.isFavorited && "fill-[#FFB800]"
                  )}
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{article?.isFavorited ? "取消收藏" : "收藏"}</TooltipContent>
          </Tooltip>

          {/* 沉浸：一个按钮切换阅读器的整个外壳，高频 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg text-[#666] transition-all duration-150 hover:bg-black/[0.05] hover:text-[#1a1a1a] active:scale-90 dark:text-[#999] dark:hover:bg-white/[0.08] dark:hover:text-white"
                onClick={onToggleImmersive}
              >
                {isImmersiveMode ? (
                  <Minimize2 className="h-[18px] w-[18px]" />
                ) : (
                  <Maximize2 className="h-[18px] w-[18px]" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isImmersiveMode ? "退出沉浸" : "沉浸阅读"}</TooltipContent>
          </Tooltip>

          {/* 更多：字号、字体、行距、页宽、外观、朗读、标签、Kindle、分享、原文 */}
          <ReaderMoreMenu
            open={showSettings}
            onOpenChange={onShowSettingsChange}
            fontSize={fontSize}
            fontFamily={fontFamily}
            lineHeight={lineHeight}
            contentWidth={contentWidth}
            readerTheme={readerTheme}
            onFontSizeChange={onFontSizeChange}
            onFontFamilyChange={onFontFamilyChange}
            onLineHeightChange={onLineHeightChange}
            onContentWidthChange={onContentWidthChange}
            onThemeChange={onReaderThemeChange}
            ttsSupported={tts.supported}
            ttsSpeaking={tts.speaking}
            onToggleTts={() => {
              if (isGuest) {
                onShowRestriction("朗读");
                return;
              }
              if (tts.speaking) {
                tts.stop();
                return;
              }
              if (!article) return;
              const text = htmlToSpeakableText(article.content || article.description);
              if (!text) {
                onShowRestriction("朗读");
                return;
              }
              tts.play(`${article.title}。${text}`);
            }}
            articleTags={articleTags}
            allTags={allTags}
            onAttachTag={onAttachTag}
            onDetachTag={onDetachTag}
            onCreateTag={onCreateTag}
            kindleEnabled={kindleEnabled}
            kindlePushing={kindlePushing}
            onPushToKindle={() => {
              if (isGuest) {
                onShowRestriction("推送 Kindle");
                return;
              }
              if (article) onPushToKindle?.(article.id);
            }}
            onShare={() => {
              if (!article?.link) return;
              void navigator.clipboard
                ?.writeText(article.link)
                .then(() => onNotify?.("原文链接已复制", "success"))
                .catch(() => onNotify?.("复制失败，请手动复制", "error"));
            }}
            onOpenOriginal={
              article?.link
                ? () =>
                    window.open(article.link, "_blank", "noopener,noreferrer")
                : undefined
            }
            onToggleDarkMode={onToggleDarkMode}
            isDarkMode={isDarkMode}
          />
        </div>
      </div>

      {/* Article Content */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        {loading ? (
          <div
            className={cn(
              "mx-auto w-full px-4 sm:px-8 lg:px-12 py-10 space-y-6",
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
            key={article.id}
            className={cn(
              "mx-auto w-full px-4 sm:px-8 lg:px-12 pt-8 pb-16",
              "animate-content-in",
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
