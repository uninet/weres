"use client";

import { useState, useCallback, useEffect } from "react";
import type { Article, ArticleFilterType } from "@/types/reader";

interface UseArticlesOptions {
  selectedFeed: string | null;
  searchQuery: string;
  activeNav: ArticleFilterType;
  /** 排序：newest 最新在前（默认），oldest 从旧到新 */
  sortOrder?: "newest" | "oldest";
}

interface UseArticlesReturn {
  articles: Article[];
  loading: boolean;
  totalArticles: number;
  unreadCount: number;
  fetchArticles: () => Promise<void>;
  markArticleAsRead: (articleId: string) => Promise<void>;
  markArticleAsUnread: (articleId: string) => Promise<void>;
  fetchArticleContent: (articleId: string) => Promise<Article | null>;
  /** 局部更新某篇文章的字段（收藏状态等），不触发重新请求 */
  patchArticle: (articleId: string, patch: Partial<Article>) => void;
}

export function useArticles({
  selectedFeed,
  searchQuery,
  activeNav,
  sortOrder = "newest",
}: UseArticlesOptions): UseArticlesReturn {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalArticles, setTotalArticles] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedFeed) params.append("feedId", selectedFeed);
      if (searchQuery) params.append("search", searchQuery);

      if (activeNav === "unread") {
        params.append("type", "unread");
      } else if (activeNav === "starred") {
        params.append("type", "favorite");
      }

      if (sortOrder === "oldest") params.append("order", "oldest");

      params.append("page", "1");
      params.append("pageSize", "50");

      const res = await fetch(`/api/articles?${params}`);
      const data = await res.json();
      if (data.success) {
        setArticles(data.data.articles || []);
        setTotalArticles(data.data.pagination?.total || 0);
        const unread = (data.data.articles || []).filter(
          (a: Article) => !a.isRead
        ).length;
        setUnreadCount(unread);
      }
    } catch (error) {
      console.error("Failed to fetch articles:", error);
    } finally {
      setLoading(false);
    }
  }, [selectedFeed, searchQuery, activeNav, sortOrder]);

  const markArticleAsRead = useCallback(async (articleId: string) => {
    try {
      await fetch(`/api/articles/${articleId}/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      setArticles((prev) =>
        prev.map((a) => (a.id === articleId ? { ...a, isRead: true } : a))
      );
    } catch (error) {
      console.error("Failed to mark article as read:", error);
    }
  }, []);

  /**
   * 标记为未读。
   *
   * 对应 DELETE /api/articles/:id/read。快捷键 v 需要双向切换，
   * 而原来只有「标记已读」这一条路。
   */
  const markArticleAsUnread = useCallback(async (articleId: string) => {
    try {
      await fetch(`/api/articles/${articleId}/read`, { method: "DELETE" });

      setArticles((prev) =>
        prev.map((a) => (a.id === articleId ? { ...a, isRead: false } : a))
      );
    } catch (error) {
      console.error("Failed to mark article as unread:", error);
    }
  }, []);

  const fetchArticleContent = useCallback(
    async (articleId: string): Promise<Article | null> => {
      try {
        const res = await fetch(`/api/articles/${articleId}`);
        const data = await res.json();
        if (data.success && data.data) {
          setArticles((prev) =>
            prev.map((a) =>
              a.id === articleId ? { ...a, ...data.data, isRead: true } : a
            )
          );
          return data.data;
        }
        return null;
      } catch (error) {
        console.error("Failed to fetch article:", error);
        return null;
      }
    },
    []
  );

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  /**
   * 局部更新某篇文章的字段（收藏状态等）。
   *
   * 不暴露 setArticles 本身：调用方拿到裸 setter 就容易顺手写
   * 出「重排列表」「整表替换」这类影响滚动的操作。
   */
  const patchArticle = useCallback(
    (articleId: string, patch: Partial<Article>) => {
      setArticles((prev) =>
        prev.map((a) => (a.id === articleId ? { ...a, ...patch } : a))
      );
    },
    []
  );

  return {
    articles,
    loading,
    totalArticles,
    unreadCount,
    fetchArticles,
    markArticleAsRead,
    markArticleAsUnread,
    fetchArticleContent,
    patchArticle,
  };
}
