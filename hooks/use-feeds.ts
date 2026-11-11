"use client";

import { useState, useCallback, useEffect } from "react";
import type { Group, Feed } from "@/types/reader";

interface UseFeedsReturn {
  groups: Group[];
  totalUnread: number;
  refreshingFeeds: Set<string>;
  fetchGroups: () => Promise<void>;
  refreshFeed: (feedId: string) => Promise<void>;
  refreshAllFeeds: () => Promise<void>;
}

export function useFeeds(): UseFeedsReturn {
  const [groups, setGroups] = useState<Group[]>([]);
  const [refreshingFeeds, setRefreshingFeeds] = useState<Set<string>>(new Set());

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/groups");
      const data = await res.json();
      if (data.success) {
        // 类型只声明本 hook 真正读的字段。
        // 改动前这里是 `any` + `Math.floor(Math.random() * 10)`：
        // 侧边栏的未读角标其实是随机数，每次刷新都变，
        // 而用户看不出这是假的。
        interface GroupFeedDto {
          id: string;
          title?: string | null;
          icon?: string | null;
          category?: string | null;
        }
        interface GroupSubscriptionDto {
          unreadCount?: number | null;
          feed: GroupFeedDto;
        }
        interface GroupDto {
          id: string;
          name: string;
          subscriptions?: GroupSubscriptionDto[];
        }

        const transformedGroups = (data.data as GroupDto[]).map((group) => ({
          id: group.id,
          name: group.name,
          feeds:
            group.subscriptions?.map((sub) => ({
              id: sub.feed.id,
              // title 在 Feed 类型里是必填 string，但数据库允许为空
              // （RSS 源解析失败时会留下没有标题的记录），这里兜底
              title: sub.feed.title ?? "未命名订阅源",
              icon: sub.feed.icon ?? undefined,
              unread: sub.unreadCount ?? 0,
              category: sub.feed.category ?? undefined,
            })) || [],
        }));
        setGroups(transformedGroups);
      }
    } catch (error) {
      console.error("Failed to fetch groups:", error);
    }
  }, []);

  const refreshFeed = useCallback(async (feedId: string) => {
    setRefreshingFeeds((prev) => new Set(prev).add(feedId));

    try {
      const res = await fetch(`/api/sync/${feedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await res.json();

      if (data.success) {
        await fetchGroups();
      }
    } catch (error) {
      console.error("刷新订阅源失败:", error);
    } finally {
      setRefreshingFeeds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(feedId);
        return newSet;
      });
    }
  }, [fetchGroups]);

  const refreshAllFeeds = useCallback(async () => {
    try {
      const syncRes = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const syncData = await syncRes.json();

      if (syncData.success) {
        await fetchGroups();
      }
    } catch (error) {
      console.error("Refresh failed:", error);
    }
  }, [fetchGroups]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const totalUnread = groups.reduce(
    (sum, group) =>
      sum + (group.feeds || []).reduce((feedSum, feed) => feedSum + (feed.unread || 0), 0),
    0
  );

  return {
    groups,
    totalUnread,
    refreshingFeeds,
    fetchGroups,
    refreshFeed,
    refreshAllFeeds,
  };
}
