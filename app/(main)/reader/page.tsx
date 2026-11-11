"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GuestBanner, GuestRestrictionModal } from "@/components/guest-banner";
import { Header } from "@/components/reader/header";
import { Sidebar } from "@/components/reader/sidebar";
import { ArticleList } from "@/components/reader/article-list";
import { ArticleContent } from "@/components/reader/article-content";
import { ShortcutHelp } from "@/components/reader/shortcut-help";
import { useReaderShortcuts } from "@/hooks/use-reader-shortcuts";
import { useKindlePush } from "@/hooks/use-kindle-push";
import { useTags } from "@/hooks/use-tags";
import { usePreferences } from "@/hooks/use-preferences";
import { useReaderTheme } from "@/hooks/use-reader-theme";
import { useFeedViewSettings } from "@/hooks/use-feed-view-settings";
import { toast } from "sonner";
import { useReadingSettings } from "@/hooks/use-reading-settings";
import { useArticles } from "@/hooks/use-articles";
import { useFeeds } from "@/hooks/use-feeds";
import type { Article, ArticleFilterType } from "@/types/reader";
import "@/app/article-content.css";

export default function ReaderPage() {
  // UI 状态
  const [selectedFeed, setSelectedFeed] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
  const [activeNav, setActiveNav] = useState<ArticleFilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [feedListCollapsed, setFeedListCollapsed] = useState(false);
  const [isImmersiveMode, setIsImmersiveMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [articleLoading, setArticleLoading] = useState(false);
  // 排序：用户在列表头切换「最新在前 / 从旧到新」
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  // 快捷键帮助面板
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);

  // 游客模式状态
  const [isGuest, setIsGuest] = useState(false);
  const [showRestrictionModal, setShowRestrictionModal] = useState(false);
  const [restrictionFeature, setRestrictionFeature] = useState("");

  // 自定义 Hooks
  const { settings, setFontSize, setFontFamily, setLineHeight, setContentWidth, toggleDarkMode } =
    useReadingSettings();

  // 四档阅读主题：浅色 / 米黄 / 电子墨水 / 深色
  const { theme: readerTheme, setTheme: setReaderTheme } = useReaderTheme();

  // 每个源独立的视图设置：切到某个源时优先用它的专属字号/页宽
  const currentFeedId = selectedArticle?.feed?.id ?? selectedFeed ?? null;
  const { override: feedViewOverride, save: saveFeedView } =
    useFeedViewSettings(currentFeedId);

  // 生效值 = 源专属设置 ?? 全局设置
  const effectiveFontSize = feedViewOverride.fontSize ?? settings.fontSize;
  const effectiveFontFamily = feedViewOverride.fontFamily ?? settings.fontFamily;
  const effectiveLineHeight = feedViewOverride.lineHeight ?? settings.lineHeight;
  const effectiveContentWidth = feedViewOverride.contentWidth ?? settings.contentWidth;

  // 用户在这个源下调字号/页宽时，同时写一份到该源的专属设置
  const setFontSizeForFeed = useCallback(
    (value: string) => {
      setFontSize(value);
      saveFeedView({ fontSize: value });
    },
    [setFontSize, saveFeedView]
  );
  const setContentWidthForFeed = useCallback(
    (value: string) => {
      setContentWidth(value);
      saveFeedView({ contentWidth: value });
    },
    [setContentWidth, saveFeedView]
  );
  const setFontFamilyForFeed = useCallback(
    (value: string) => {
      setFontFamily(value);
      saveFeedView({ fontFamily: value });
    },
    [setFontFamily, saveFeedView]
  );
  const setLineHeightForFeed = useCallback(
    (value: string) => {
      setLineHeight(value);
      saveFeedView({ lineHeight: value });
    },
    [setLineHeight, saveFeedView]
  );
  const {
    articles,
    loading,
    totalArticles,
    unreadCount,
    fetchArticles,
    markArticleAsRead,
    markArticleAsUnread,
    patchArticle,
  } = useArticles({
    selectedFeed,
    searchQuery,
    activeNav,
    sortOrder,
  });
  const { groups, refreshingFeeds, refreshFeed, refreshAllFeeds } = useFeeds();
  const { preferences } = usePreferences();
  const {
    enabled: kindleEnabled,
    pushing: kindlePushing,
    push: pushToKindle,
  } = useKindlePush();
  const {
    allTags,
    articleTags,
    createTag,
    attach: attachTag,
    detach: detachTag,
  } = useTags(selectedArticle?.id ?? null);

  // 检查是否游客模式
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        setIsGuest(!res.ok);
      } catch (error) {
        console.error("检查登录状态失败:", error);
        setIsGuest(true);
      }
    };
    checkAuth();
  }, []);

  // 自动选中第一篇文章
  useEffect(() => {
    if (articles.length > 0 && !selectedArticle) {
      setSelectedArticle(articles[0]);
    }
  }, [articles, selectedArticle]);

  // 处理文章选择
  const handleSelectArticle = useCallback(
    async (article: Article) => {
      setArticleLoading(true);
      setSelectedArticle(article);

      // 标记为已读 —— 只在用户开启了「自动标记已读」时。
      // 关掉这个开关的人通常是「只想先扫标题、不想污染未读状态」，
      // 之前代码无条件标记，等于这个开关根本没接。
      if (!article.isRead && preferences.autoMarkRead) {
        await markArticleAsRead(article.id);
      }

      // 获取完整内容
      if (!article.content) {
        try {
          const res = await fetch(`/api/articles/${article.id}`);
          const data = await res.json();
          if (data.success && data.data) {
            setSelectedArticle(data.data);
          }
        } catch (error) {
          console.error("Failed to fetch article:", error);
        }
      }

      setArticleLoading(false);
    },
    [markArticleAsRead, preferences.autoMarkRead]
  );

  // 获取当前文章索引
  const getCurrentArticleIndex = useCallback(() => {
    if (!articles.length || !selectedArticle) return -1;
    return articles.findIndex((a) => a.id === selectedArticle.id);
  }, [articles, selectedArticle]);

  // 上一篇
  const handlePrevArticle = useCallback(() => {
    const currentIndex = getCurrentArticleIndex();
    if (currentIndex > 0) {
      handleSelectArticle(articles[currentIndex - 1]);
    }
  }, [getCurrentArticleIndex, articles, handleSelectArticle]);

  // 下一篇
  const handleNextArticle = useCallback(() => {
    const currentIndex = getCurrentArticleIndex();
    if (currentIndex >= 0 && currentIndex < articles.length - 1) {
      handleSelectArticle(articles[currentIndex + 1]);
    }
  }, [getCurrentArticleIndex, articles, handleSelectArticle]);

  // 全部标记为已读
  const handleMarkAllRead = useCallback(async () => {
    const unreadArticles = articles.filter((a) => !a.isRead);
    for (const article of unreadArticles) {
      await markArticleAsRead(article.id);
    }
  }, [articles, markArticleAsRead]);

  // 自动同步：进入阅读器时以及按设定间隔后台刷新
  //
  // 之前「自动同步」和「同步间隔」两个开关在设置页里能拨，
  // 但全项目没有一处代码读取它们 —— 拨到 15 分钟和关掉没区别。
  // 这里用挂载时的首次同步 + setInterval 实现，刷新失败静默
  // （后台任务失败不该打断正在读文章的人，下拉手动刷新时才会报错）。
  useEffect(() => {
    if (isGuest || !preferences.autoSync) return;

    let cancelled = false;
    const runSync = async () => {
      if (cancelled) return;
      try {
        await refreshAllFeeds();
        if (!cancelled) await fetchArticles();
      } catch (error) {
        console.error("自动同步失败:", error);
      }
    };

    void runSync();

    // 下限 5 分钟：再短就变成对源站的骚扰了
    const intervalMs = Math.max(5, preferences.syncInterval) * 60 * 1000;
    const timer = window.setInterval(runSync, intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [isGuest, preferences.autoSync, preferences.syncInterval, refreshAllFeeds, fetchArticles]);

  // 刷新订阅源
  const handleRefresh = useCallback(async () => {
    if (isGuest) {
      setRestrictionFeature("同步更新");
      setShowRestrictionModal(true);
      return;
    }
    await refreshAllFeeds();
    await fetchArticles();
  }, [isGuest, refreshAllFeeds, fetchArticles]);

  // 刷新单个订阅源
  const handleRefreshFeed = useCallback(
    async (feedId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (isGuest) {
        setRestrictionFeature("刷新订阅源");
        setShowRestrictionModal(true);
        return;
      }
      await refreshFeed(feedId);
      await fetchArticles();
    },
    [isGuest, refreshFeed, fetchArticles]
  );

  // 显示限制弹窗
  const handleShowRestriction = useCallback((feature: string) => {
    setRestrictionFeature(feature);
    setShowRestrictionModal(true);
  }, []);

  // 打开原文
  const handleOpenOriginal = useCallback(() => {
    if (selectedArticle?.link) {
      window.open(selectedArticle.link, "_blank", "noopener,noreferrer");
    } else {
      toast.error("这篇文章没有原文链接");
    }
  }, [selectedArticle]);

  // 收藏 / 取消收藏
  //
  // 接收 id/next 是为了让正文里的按钮能直接表达「我要把这篇文章设成什么状态」，
  // 而不是依赖「当前选中就是它」这个隐含前提。快捷键调用时不传参，
  // 退回用 selectedArticle。
  const handleToggleFavorite = useCallback(
    async (articleId?: string, nextStarred?: boolean) => {
    const target = articleId ?? selectedArticle?.id;
    if (!target) return;
    if (isGuest) {
      handleShowRestriction("收藏");
      return;
    }

    const current =
      selectedArticle?.id === target
        ? Boolean(selectedArticle?.isFavorited)
        : false;
    const next = nextStarred ?? !current;
    try {
      const res = await fetch(`/api/articles/${target}/favorite`, {
        method: next ? "POST" : "DELETE",
      });
      if (!res.ok) {
        toast.error(next ? "收藏失败" : "取消收藏失败");
        return;
      }
      setSelectedArticle((prev) =>
        prev && prev.id === target ? { ...prev, isFavorited: next } : prev
      );
      patchArticle(target, { isFavorited: next });
      toast.success(next ? "已收藏" : "已取消收藏");
    } catch (error) {
      console.error("Toggle favorite error:", error);
      toast.error("操作失败");
    }
    },
    [selectedArticle, isGuest, handleShowRestriction, patchArticle]
  );

  // 标记已读 / 未读（双向切换）
  const handleToggleRead = useCallback(async () => {
    if (!selectedArticle) return;
    const next = !selectedArticle.isRead;
    try {
      if (next) {
        await markArticleAsRead(selectedArticle.id);
      } else {
        await markArticleAsUnread(selectedArticle.id);
      }
      setSelectedArticle((prev) => (prev ? { ...prev, isRead: next } : prev));
      toast.success(next ? "已标记为已读" : "已标记为未读");
    } catch (error) {
      console.error("Toggle read error:", error);
      toast.error("操作失败");
    }
  }, [selectedArticle, markArticleAsRead, markArticleAsUnread]);

  // 键盘快捷键
  //
  // 单一入口，键位定义在 hooks/use-reader-shortcuts.ts：
  //   m/k 上一篇，n/j/Space 下一篇，o 打开原文，s 收藏，v 已读切换，
  //   t 主题，f 沉浸，r 刷新，, 设置，? 帮助，Esc 退出。
  // 弹窗打开时禁用，避免 Esc 与面板关闭打架。
  useReaderShortcuts({
    enabled: !showRestrictionModal,
    onPrev: handlePrevArticle,
    onNext: handleNextArticle,
    onOpenOriginal: handleOpenOriginal,
    onToggleFavorite: handleToggleFavorite,
    onToggleRead: handleToggleRead,
    onToggleTheme: toggleDarkMode,
    onToggleImmersive: () => setIsImmersiveMode((v) => !v),
    onRefresh: handleRefresh,
    onOpenSettings: () => setShowSettings((v) => !v),
    onShowHelp: () => setShowShortcutHelp(true),
    onEscape: () => {
      setShowShortcutHelp(false);
      setShowSettings(false);
      setIsImmersiveMode(false);
    },
  });

  return (
    <TooltipProvider>
      <div className={cn("h-screen flex flex-col", settings.isDarkMode ? "dark" : "")}>
        <div className="h-screen flex flex-col bg-[#f8f6f3] dark:bg-[#1a1a1a]">
          {/* Header */}
          {!isImmersiveMode && (
            <Header
              activeNav={activeNav}
              unreadCount={unreadCount}
              isDarkMode={settings.isDarkMode}
              onNavChange={setActiveNav}
              onToggleDarkMode={toggleDarkMode}
              readerTheme={readerTheme}
              onThemeChange={setReaderTheme}
              showUnreadBadge={preferences.showUnreadBadge}
            />
          )}

          {/* Main Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar */}
            {!isImmersiveMode && (
              <Sidebar
                groups={groups}
                selectedFeed={selectedFeed}
                searchQuery={searchQuery}
                sidebarCollapsed={sidebarCollapsed}
                refreshingFeeds={refreshingFeeds}
                onSelectFeed={setSelectedFeed}
                onSearchChange={setSearchQuery}
                onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
                onRefreshFeed={handleRefreshFeed}
              />
            )}

            {/* Article List */}
            {!isImmersiveMode && (
              <ArticleList
                articles={articles}
                selectedArticle={selectedArticle}
                loading={loading}
                totalArticles={totalArticles}
                syncing={refreshingFeeds.size > 0}
                feedListCollapsed={feedListCollapsed}
                onSelectArticle={handleSelectArticle}
                onRefresh={handleRefresh}
                onMarkAllRead={handleMarkAllRead}
                onToggleCollapse={() => setFeedListCollapsed(!feedListCollapsed)}
                sortOrder={sortOrder}
                onToggleSort={() =>
                  setSortOrder((v) => (v === "newest" ? "oldest" : "newest"))
                }
                compactView={preferences.compactView}
              />
            )}

            {/* Article Content */}
            <ArticleContent
              article={selectedArticle}
              articles={articles}
              loading={articleLoading}
              isImmersiveMode={isImmersiveMode}
              feedListCollapsed={feedListCollapsed}
              showSettings={showSettings}
              fontSize={effectiveFontSize}
              fontFamily={effectiveFontFamily}
              lineHeight={effectiveLineHeight}
              contentWidth={effectiveContentWidth}
              isDarkMode={settings.isDarkMode}
              isGuest={isGuest}
              onToggleImmersive={() => setIsImmersiveMode(!isImmersiveMode)}
              onToggleFeedList={() => setFeedListCollapsed(!feedListCollapsed)}
              onToggleDarkMode={toggleDarkMode}
              onPrevArticle={handlePrevArticle}
              onNextArticle={handleNextArticle}
              onShowSettingsChange={setShowSettings}
              onFontSizeChange={setFontSizeForFeed}
              onFontFamilyChange={setFontFamilyForFeed}
              onLineHeightChange={setLineHeightForFeed}
              onContentWidthChange={setContentWidthForFeed}
              onShowRestriction={handleShowRestriction}
              onMarkReadByScroll={(id) => {
                // 滚动读完后标记已读，并同步更新列表状态
                markArticleAsRead(id);
                setSelectedArticle((prev) =>
                  prev && prev.id === id ? { ...prev, isRead: true } : prev
                );
              }}
              onToggleFavorite={handleToggleFavorite}
              allTags={allTags}
              articleTags={articleTags}
              onAttachTag={async (tag) => {
                const okResult = await attachTag(tag);
                toast[okResult ? "success" : "error"](
                  okResult ? `已添加标签「${tag.name}」` : "添加标签失败"
                );
              }}
              onDetachTag={async (tagId) => {
                const okResult = await detachTag(tagId);
                toast[okResult ? "success" : "error"](
                  okResult ? "已移除标签" : "移除标签失败"
                );
              }}
              onCreateTag={async (name) => {
                const tag = await createTag(name);
                if (!tag) {
                  toast.error("创建标签失败");
                  return;
                }
                // 新建后顺手打到当前文章上，省一次点击
                const okResult = await attachTag(tag);
                toast[okResult ? "success" : "error"](
                  okResult ? `已添加标签「${tag.name}」` : "标签已创建，但未能添加到文章"
                );
              }}
              kindleEnabled={kindleEnabled}
              kindlePushing={kindlePushing}
              onPushToKindle={async (id) => {
                const result = await pushToKindle(id);
                if (result.ok) {
                  toast.success(result.message);
                } else {
                  toast.error(result.message);
                }
              }}
              onNotify={(message, kind) => {
                if (kind === "success") toast.success(message);
                else toast.error(message);
              }}
            />
          </div>
        </div>

        {/* 快捷键帮助 */}
        <ShortcutHelp isOpen={showShortcutHelp} onClose={() => setShowShortcutHelp(false)} />

        {/* 游客模式提示横幅 */}
        <GuestBanner />

        {/* 游客限制弹窗 */}
        <GuestRestrictionModal
          isOpen={showRestrictionModal}
          onClose={() => setShowRestrictionModal(false)}
          feature={restrictionFeature}
        />
      </div>
    </TooltipProvider>
  );
}
