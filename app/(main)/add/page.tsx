"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, Plus, Rss } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FeedRow } from "@/components/add-feed/feed-row";
import { cn } from "@/lib/utils";
import type { MarketFeedRow, MarketGroup } from "@/lib/market";

/** 每组的预览条数与「更多」时一次拉取的条数 */
const PREVIEW_SIZE = 10;
/** 展开时按「全部」理解，给到后端上限（当前最大分类是技术 514 个） */
const EXPANDED_SIZE = 1000;

interface GroupsPayload {
  groups: MarketGroup[];
  totalFeeds: number;
}

/**
 * 添加订阅页。
 *
 * 为什么要有这个页面：原来的「添加」按钮跳去 /market，而市场页是
 * 一张 896 个源的大卡片墙 —— 用户想订一个源，得先滚过几百张卡片
 * 或者记得去搜索框里输关键词。这里把两件事拆开：
 *   上半屏：手里已经有 RSS 链接，直接粘进来订
 *   下半屏：不知道订什么，按分类扫一眼每组 10 个
 *
 * 分组只拉每组 10 条（后端 `grouped=1&perGroup=10`），点「更多」
 * 才去拉该分类的全部 —— 第一屏不替用户为 886 个看不到的源付流量。
 */
export default function AddFeedPage() {
  const [groups, setGroups] = useState<MarketGroup[]>([]);
  const [totalFeeds, setTotalFeeds] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  /** 已经展开全量的分类，以及它们各自的全量数据 */
  const [expanded, setExpanded] = useState<Record<string, MarketFeedRow[]>>({});
  const [expandingCategory, setExpandingCategory] = useState<string | null>(null);
  /** 折叠回去时用的原始预览数据，避免重新请求 */
  const previewCache = useRef<Record<string, MarketGroup>>({});

  /** 正在请求的源（feedId）；同一时刻只允许一个，避免连点打满接口 */
  const [busyFeedId, setBusyFeedId] = useState<string | null>(null);

  /** 上半屏的自定义链接 */
  const [url, setUrl] = useState("");
  const [customBusy, setCustomBusy] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  const loadGroups = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`/api/market?grouped=1&perGroup=${PREVIEW_SIZE}`);
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.message || "获取订阅源失败");
      }
      const data = payload.data as GroupsPayload;
      setGroups(data.groups || []);
      setTotalFeeds(data.totalFeeds || 0);
      previewCache.current = Object.fromEntries(
        (data.groups || []).map((group) => [group.category, group])
      );
    } catch (error) {
      console.error("Load market groups error:", error);
      setLoadError(error instanceof Error ? error.message : "获取订阅源失败");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  /**
   * 就地更新某一行的状态，而不是整页重新拉数据。
   *
   * 重新拉数据会让用户当前所在的滚动位置丢掉 —— 展开某一组、
   * 滚到第 3 组订阅一个源，然后整页跳回顶部，这在长列表上是
   * 很难受的体验。这里只改那一个 feedId 的两份副本（预览 + 展开）。
   */
  const patchFeed = useCallback((feedId: string, isSubscribed: boolean) => {
    const apply = (rows: MarketFeedRow[]) =>
      rows.map((row) => (row.feedId === feedId ? { ...row, isSubscribed } : row));

    setGroups((current) => current.map((group) => ({ ...group, feeds: apply(group.feeds) })));
    setExpanded((current) => {
      const next: Record<string, MarketFeedRow[]> = {};
      for (const [category, rows] of Object.entries(current)) {
        next[category] = apply(rows);
      }
      return next;
    });
  }, []);

  const handleSubscribe = useCallback(
    async (feed: MarketFeedRow) => {
      setBusyFeedId(feed.feedId);
      try {
        const response = await fetch("/api/feeds/subscriptions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: feed.feed.url, isNotify: true }),
        });

        // 网关出错时可能返回 HTML 错误页，先按文本读再解析，
        // 否则 response.json() 抛 SyntaxError，用户只能看到「订阅失败」
        const text = await response.text();
        let payload: { success?: boolean; message?: string } = {};
        try {
          payload = text ? JSON.parse(text) : {};
        } catch {
          toast.error(`订阅失败（HTTP ${response.status}）`);
          return;
        }

        if (payload.success) {
          patchFeed(feed.feedId, true);
          // 已订阅过也走 success，后端 message 是「已经订阅过这个源了」，
          // 直接透出比统一说「订阅成功」更符合实际情况
          toast.success(payload.message || `已订阅 ${feed.feed.title}`);
        } else {
          toast.error(payload.message || `订阅失败（HTTP ${response.status}）`);
        }
      } catch (error) {
        console.error("Subscribe error:", error);
        toast.error(
          error instanceof Error ? `订阅失败：${error.message}` : "订阅失败"
        );
      } finally {
        setBusyFeedId(null);
      }
    },
    [patchFeed]
  );

  const handleUnsubscribe = useCallback(
    async (feed: MarketFeedRow) => {
      setBusyFeedId(feed.feedId);
      try {
        const response = await fetch(`/api/feeds/subscriptions/${feed.feedId}`, {
          method: "DELETE",
        });
        const payload = await response.json();

        if (payload.success) {
          patchFeed(feed.feedId, false);
          toast.success(`已取消订阅 ${feed.feed.title}`);
        } else {
          toast.error(payload.message || "取消订阅失败");
        }
      } catch (error) {
        console.error("Unsubscribe error:", error);
        toast.error("取消订阅失败");
      } finally {
        setBusyFeedId(null);
      }
    },
    [patchFeed]
  );

  /** 「更多」：拉该分类全量；已经展开过就直接折叠回去 */
  const toggleGroup = useCallback(
    async (category: string) => {
      if (expanded[category]) {
        setExpanded((current) => {
          const next = { ...current };
          delete next[category];
          return next;
        });
        return;
      }

      setExpandingCategory(category);
      try {
        const response = await fetch(
          `/api/market?grouped=1&category=${encodeURIComponent(category)}&perGroup=${EXPANDED_SIZE}`
        );
        const payload = await response.json();
        if (!payload.success) {
          throw new Error(payload.message || "加载失败");
        }
        const group = (payload.data as GroupsPayload).groups?.[0];
        setExpanded((current) => ({ ...current, [category]: group?.feeds || [] }));
      } catch (error) {
        console.error("Expand group error:", error);
        toast.error(error instanceof Error ? error.message : "加载该分类失败");
      } finally {
        setExpandingCategory(null);
      }
    },
    [expanded]
  );

  /**
   * 上半屏：粘贴一个 RSS 链接订阅。
   *
   * 先走 /api/feeds/validate 再走订阅接口，而不是直接把 URL 丢给
   * 订阅接口 —— 订阅接口内部会真的去 fetch 这个地址并导入前 20 篇，
   * 一个错链接要在服务端跑完超时才会报错。先校验能立刻告诉用户
   * 「这不是一个 RSS 源」，订阅按钮只在确认是有效源之后才点得动。
   */
  const handleCustomSubscribe = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setCustomError("请输入 RSS 链接");
      return;
    }
    if (!/^https?:\/\//i.test(trimmed)) {
      setCustomError("链接需要以 http:// 或 https:// 开头");
      return;
    }

    setCustomError(null);
    setCustomBusy(true);
    try {
      const validateResponse = await fetch("/api/feeds/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const validatePayload = await validateResponse.json();

      if (!validatePayload.success) {
        setCustomError(validatePayload.message || "这不是一个有效的 RSS 源");
        return;
      }

      const response = await fetch("/api/feeds/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, isNotify: true }),
      });
      const payload = await response.json();

      if (payload.success) {
        toast.success(payload.message || `已订阅 ${validatePayload.data?.feed?.title || ""}`);
        setUrl("");
        // 新订阅的源可能本来就属于某个分类，刷新一次让它的按钮变「已订阅」
        void loadGroups();
      } else {
        setCustomError(payload.message || "订阅失败");
      }
    } catch (error) {
      console.error("Custom subscribe error:", error);
      setCustomError(
        error instanceof Error ? `订阅失败：${error.message}` : "订阅失败"
      );
    } finally {
      setCustomBusy(false);
    }
  }, [url, loadGroups]);

  const summary = useMemo(
    () => (totalFeeds > 0 ? `${groups.length} 个分类 · ${totalFeeds} 个源` : ""),
    [groups.length, totalFeeds]
  );

  return (
    <PageShell
      title="添加订阅"
      subtitle={summary || undefined}
      icon={Plus}
      iconClassName="bg-[#c9a962]/15 text-[#a8894a] dark:bg-[#c9a962]/20 dark:text-[#d9bd82]"
    >
      <div className="mx-auto max-w-2xl space-y-5">
        {/* 上半屏：自定义链接 */}
        <section className="rounded-2xl border border-black/[0.07] bg-white p-4 dark:border-white/[0.08] dark:bg-[#1c1c1e]">
          <label
            htmlFor="feed-url"
            className="mb-2 block text-[13px] font-medium text-[#3a3a3c] dark:text-[#d1d1d6]"
          >
            RSS 链接
          </label>
          <div className="flex gap-2">
            <Input
              id="feed-url"
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://example.com/feed.xml"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                if (customError) setCustomError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !customBusy) {
                  event.preventDefault();
                  void handleCustomSubscribe();
                }
              }}
              className={cn(
                "h-10 flex-1 rounded-xl",
                customError && "border-red-400 focus-visible:ring-red-400"
              )}
              aria-invalid={Boolean(customError)}
              aria-describedby={customError ? "feed-url-error" : undefined}
            />
            <Button
              onClick={() => void handleCustomSubscribe()}
              disabled={customBusy || !url.trim()}
              className="h-10 shrink-0 rounded-xl bg-[#c9a962] px-4 text-white hover:bg-[#b8974f] dark:text-[#1a1a1a] dark:hover:bg-[#d9bd82]"
            >
              {customBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "订阅"}
            </Button>
          </div>
          {customError ? (
            <p id="feed-url-error" className="mt-2 text-[12.5px] text-red-500">
              {customError}
            </p>
          ) : (
            <p className="mt-2 text-[12px] text-[#8a8a8e] dark:text-[#8e8e93]">
              博客一般是 /feed.xml 或 /feed；WordPress 站点用 /feed/
            </p>
          )}
        </section>

        {/* 下半屏：按分类浏览 */}
        {isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-[180px] w-full rounded-2xl" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-black/[0.07] bg-white p-8 text-center dark:border-white/[0.08] dark:bg-[#1c1c1e]">
            <Rss className="mx-auto mb-3 h-8 w-8 text-[#c9a962]" />
            <p className="text-[13px] text-[#8a8a8e]">{loadError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void loadGroups()}>
              重试
            </Button>
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-black/[0.07] bg-white p-8 text-center dark:border-white/[0.08] dark:bg-[#1c1c1e]">
            <p className="text-[13px] text-[#8a8a8e]">市场里还没有可浏览的源</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => {
              const isExpanded = Boolean(expanded[group.category]);
              const rows = isExpanded ? expanded[group.category] : group.feeds;
              const canExpand = group.total > group.feeds.length;
              const isExpanding = expandingCategory === group.category;

              return (
                <section
                  key={group.category}
                  className="overflow-hidden rounded-2xl border border-black/[0.07] bg-white dark:border-white/[0.08] dark:bg-[#1c1c1e]"
                >
                  <header className="flex items-center justify-between gap-2 border-b border-black/[0.05] px-3 py-2.5 dark:border-white/[0.06]">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <h2 className="truncate text-[13.5px] font-semibold text-[#1c1c1e] dark:text-[#f2f2f2]">
                        {group.category}
                      </h2>
                      <span className="shrink-0 text-[11.5px] text-[#8a8a8e] dark:text-[#8e8e93]">
                        {group.total} 个源
                      </span>
                    </div>

                    {canExpand || isExpanded ? (
                      <button
                        type="button"
                        onClick={() => void toggleGroup(group.category)}
                        disabled={isExpanding}
                        aria-expanded={isExpanded}
                        aria-label={
                          isExpanded
                            ? `收起 ${group.category}`
                            : `查看 ${group.category} 全部 ${group.total} 个订阅源`
                        }
                        className="flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-1 text-[12px] text-[#a8894a] transition-colors hover:bg-[#c9a962]/10 disabled:opacity-50 dark:text-[#d9bd82]"
                      >
                        {isExpanding ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            {isExpanded ? "收起" : "更多"}
                            <ChevronDown
                              className={cn(
                                "h-3.5 w-3.5 transition-transform",
                                isExpanded && "rotate-180"
                              )}
                            />
                          </>
                        )}
                      </button>
                    ) : null}
                  </header>

                  <div className="divide-y divide-black/[0.05] dark:divide-white/[0.06]">
                    {rows.map((feed) => (
                      <FeedRow
                        key={feed.id}
                        feed={feed}
                        busy={busyFeedId === feed.feedId}
                        onSubscribe={handleSubscribe}
                        onUnsubscribe={handleUnsubscribe}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </PageShell>
  );
}
