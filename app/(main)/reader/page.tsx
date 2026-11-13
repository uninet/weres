"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GuestBanner, GuestRestrictionModal } from "@/components/guest-banner";
import { ReaderDock } from "@/components/reader/reader-dock";
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
  // 用户在小屏上主动「返回列表」后，不要再自动选中第一篇。
  // 否则清空 selection 的下一帧就被 useEffect 填回去，按钮看起来没反应。
  const [listOnly, setListOnly] = useState(false);
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

  // 深链：/reader?articleId=xxx 直接打开某篇文章。
  //
  // 收藏页和历史页原本点标题是 window.open(文章原始链接, "_blank") ——
  // 用户从自己的收藏里点一篇，人就被送出产品了。收藏的价值是
  // 「下次还在这个阅读器里读」，不是「帮你存了个外链」。
  // 现在那两个页面改成跳 /reader?articleId=，由这里接手。
  const router = useRouter();
  // 深链 id 用 window.location 读，不用 useSearchParams：
  // useSearchParams 会让这个页面在 build 期被要求包一层 Suspense
  // 边界，否则 next build 直接报 «useSearchParams() should be wrapped
  // in a suspense boundary»。这个页面本来就是纯客户端的，
  // 挂载后读一次地址栏完全够用。
  const [deepLinkId, setDeepLinkId] = useState<string | null>(null);
  const deepLinkHandled = useRef<string | null>(null);

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
    markAllAsRead,
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


  // 处理文章选择
  const handleSelectArticle = useCallback(
    async (article: Article) => {
      setListOnly(false);
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

  // 挂载后读一次 articleId。
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("articleId");
    if (id) setDeepLinkId(id);
  }, []);

  // 深链：URL 里带了 articleId 就直接打开那篇。
  //
  // 优先于「自动选中第一篇」执行，并且不走列表——收藏页/历史页
  // 链过来时目标文章可能根本不在当前列表（没选源、或者文章比
  // 第一页更旧），只能按 id 单独取。
  useEffect(() => {
    if (!deepLinkId) return;
    if (deepLinkHandled.current === deepLinkId) return;
    deepLinkHandled.current = deepLinkId;

    let cancelled = false;
    (async () => {
      setArticleLoading(true);
      try {
        const res = await fetch(`/api/articles/${deepLinkId}`);
        const payload = await res.json();
        if (cancelled) return;
        if (!res.ok || !payload?.success || !payload.data) {
          toast.error(payload?.message || "文章不存在或无权访问");
          return;
        }
        // 直接落库结果：这条路径拿到的是带全文的对象，
        // 再走 handleSelectArticle 会多打一次 /api/articles/:id。
        setListOnly(false);
        setSelectedArticle(payload.data);
        if (!payload.data.isRead && preferences.autoMarkRead) {
          await markArticleAsRead(payload.data.id);
        }
      } catch (error) {
        console.error("深链打开文章失败:", error);
        if (!cancelled) toast.error("打开文章失败");
      } finally {
        if (!cancelled) setArticleLoading(false);
      }
    })();

    // 把地址栏换回 /reader：不留 ?articleId=，
    // 否则用户在列表里换下一篇时地址栏还是旧 id，刷新会跳回去。
    router.replace("/reader", { scroll: false });

    return () => {
      cancelled = true;
    };
  }, [deepLinkId, router, preferences.autoMarkRead, markArticleAsRead]);

  // 自动选中第一篇文章
  useEffect(() => {
    if (listOnly) return;
    // 深链正在处理时不抢：两件事同时发生会先闪一下第一篇再跳走
    if (deepLinkId) return;
    // 小屏不自动选中：三栏变成三级页面后，自动进正文会让用户
    // 点完源瞬间看不见列表，以为「点了没反应」。
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) return;
    if (articles.length > 0 && !selectedArticle) {
      // 走 handleSelectArticle 而不是直接 setSelectedArticle：
      // 列表接口已经不返回 content（省掉每页几百 KB 的无用负载），
      // 直接塞进去右侧会是空白正文，必须由它去 /api/articles/:id 取全文。
      handleSelectArticle(articles[0]);
    }
  }, [articles, selectedArticle, listOnly, handleSelectArticle, deepLinkId]);

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
  //
  // 改成走服务端批量端点。原来是对当前页的未读逐条 POST：
  // 列表只加载第一页（≤100 条），所以点完之后第二页仍是未读，
  // 用户会以为按钮坏了；而逐条 await 在几百篇时要几十秒。
  const handleMarkAllRead = useCallback(async () => {
    const marked = await markAllAsRead();
    toast.success(
      marked > 0 ? `已标记 ${marked} 篇文章为已读` : "没有未读文章"
    );
    await fetchArticles();
  }, [markAllAsRead, fetchArticles]);

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
  //   空格 向下翻一屏 / Shift+空格 向上翻一屏，
  //   m/k 上一篇，n/j 下一篇，o 打开原文，s 收藏，v 已读切换，
  //   t 外观，f 沉浸，r 刷新，, 更多设置，? 帮助，Esc 退出。
  //
  // 空格与 m/n 必须分开：空格是「这篇文章还没读完，继续往下看」，
  // m/n 是「换一篇文章」。绑在一起的话，读到一半按空格会直接跳到下一篇。
  // 弹窗打开时禁用，避免 Esc 与面板关闭打架。
  useReaderShortcuts({
    enabled: !showRestrictionModal && !showSettings,
    onPrev: handlePrevArticle,
    onNext: handleNextArticle,
    onPageDown: () => {
      window.dispatchEvent(new CustomEvent("reader:page", { detail: "down" }));
    },
    onPageUp: () => {
      window.dispatchEvent(new CustomEvent("reader:page", { detail: "up" }));
    },
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
        {/* pb-14 md:pb-0：移动端底部有一条 56px 的常驻导航（fixed 定位，
            不占文档流），这里必须把这块高度让出来。否则侧栏最底部的
            「导航与设置」入口正好被压在导航条下面 —— 视觉上看得见，点上去
            全被导航接走，等于点不到。桌面端没有底部导航，不预留。 */}
        <div className="relative flex h-screen flex-col bg-[#f8f6f3] pb-14 md:pb-0 dark:bg-[#1a1a1a]">
          {/* 顶栏已取消。
              原来这里是一条 h-14 的横栏（logo / 全部·稍后阅读·未读 /
              主题 / 设置 / 个人中心），和内容上下排列，等于整块屏幕顶部
              被切掉 56px。这些东西都不是阅读时需要一直看着的，所以整条
              收进左下角的 ReaderDock，顶部空间全部还给内容。 */}

          {/* Main Content */}
          {/*
            小屏（< md）一次只显示一栏：侧栏 / 列表 / 正文。
            三栏并排在 390px 上会把正文挤到 0 宽 —— 实测过，
            正文只剩 295px 且列表标题全被截断。
            md 及以上恢复三栏并排。
          */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Sidebar */}
            {!isImmersiveMode && (
              <div
                className={cn(
                  // 保持 flex flex-col（不要用 md:block 覆盖 display）：
                  // 侧栏要 flex-1 撑满、ReaderDock 才能被推到最底部。
                  // h-full min-h-0 是必须的：没有高度约束时这个列会被内容
                  // 撑高，ScrollArea 不再收缩，底部的 ReaderDock 就叠在
                  // 最后几条源上面。
                  "relative flex h-full min-h-0 shrink-0 flex-col",
                  // 小屏：没选源时显示侧栏，选了源就藏起来让位给列表。
                  // md:flex 不能漏——hidden 对所有断点生效，少了它
                  // 桌面端一旦选了源或输入搜索词，整条侧栏就消失了。
                  selectedFeed || searchQuery
                    ? "hidden md:flex"
                    : "flex w-full md:w-auto"
                )}
              >
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

              {/* 导航与设置入口：钉在侧栏这一列的左下角。
                  放在侧栏列内部而不是整页绝对定位，是为了不盖住
                  列表/正文——它是「左边的工具」，就该待在左边。 */}
              {!isImmersiveMode && (
                <ReaderDock
                  activeNav={activeNav}
                  unreadCount={unreadCount}
                  onNavChange={setActiveNav}
                  readerTheme={readerTheme}
                  onThemeChange={setReaderTheme}
                  showUnreadBadge={preferences.showUnreadBadge}
                  sidebarCollapsed={sidebarCollapsed}
                  onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
                />
              )}
              </div>
            )}

            {/* Article List */}
            {!isImmersiveMode && (
              <div
                className={cn(
                  "shrink-0 md:block",
                  // 小屏：选了源才显示列表，且没有选中文章时占满整宽
                  selectedFeed || searchQuery ? "block w-full md:w-auto" : "hidden md:block",
                  selectedArticle && "hidden md:block"
                )}
              >
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
              </div>
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
              onBackToList={() => {
                setListOnly(true);
                setSelectedArticle(null);
              }}
              onToggleDarkMode={toggleDarkMode}
              onPrevArticle={handlePrevArticle}
              onNextArticle={handleNextArticle}
              onShowSettingsChange={setShowSettings}
              onFontSizeChange={setFontSizeForFeed}
              onFontFamilyChange={setFontFamilyForFeed}
              onLineHeightChange={setLineHeightForFeed}
              onContentWidthChange={setContentWidthForFeed}
              readerTheme={readerTheme}
              onReaderThemeChange={setReaderTheme}
              onShowRestriction={handleShowRestriction}
              // 滚动读完标记已读，但要受「自动标记已读」开关约束。
              // 关闭该开关的用户诉求是「别替我改未读状态」——如果只堵住
              // 打开文章那一条路径、滚动这条照旧，开关就等于只关了一半。
              onMarkReadByScroll={
                preferences.autoMarkRead
                  ? (id) => {
                      markArticleAsRead(id);
                      setSelectedArticle((prev) =>
                        prev && prev.id === id ? { ...prev, isRead: true } : prev
                      );
                    }
                  : undefined
              }
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
