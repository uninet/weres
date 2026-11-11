"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 标签的客户端状态。
 *
 * 分两层：用户拥有的标签全集（用于下拉选择），
 * 以及当前文章已打的标签（用于显示和取消）。
 * 两者生命周期不同，不该混在一个 state 里。
 */
export interface Tag {
  id: string;
  name: string;
  color: string;
  articleCount?: number;
}

export function useTags(articleId: string | null) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [articleTags, setArticleTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const res = await fetch("/api/tags");
      const json = await res.json();
      if (json?.success) setAllTags(json.data?.tags ?? []);
    } catch (error) {
      console.error("加载标签失败:", error);
    }
  }, []);

  const loadForArticle = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/articles/${id}/tags`);
      const json = await res.json();
      if (json?.success) setArticleTags(json.data?.tags ?? []);
    } catch (error) {
      console.error("加载文章标签失败:", error);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (articleId) {
      void loadForArticle(articleId);
    } else {
      // 切换文章时先清空，否则会短暂显示上一篇文章的标签
      setArticleTags([]);
    }
  }, [articleId, loadForArticle]);

  const createTag = useCallback(
    async (name: string): Promise<Tag | null> => {
      setLoading(true);
      try {
        const res = await fetch("/api/tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const json = await res.json();
        if (json?.success && json.data) {
          const tag = json.data as Tag;
          // 新建后可能已存在（接口幂等），所以按 id 去重再合并
          setAllTags((prev) =>
            prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]
          );
          return tag;
        }
        return null;
      } catch (error) {
        console.error("创建标签失败:", error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const attach = useCallback(
    async (tag: Tag) => {
      if (!articleId) return false;
      try {
        const res = await fetch(`/api/articles/${articleId}/tags`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagId: tag.id }),
        });
        const json = await res.json();
        if (json?.success) {
          setArticleTags((prev) =>
            prev.some((t) => t.id === tag.id) ? prev : [...prev, tag]
          );
          return true;
        }
        return false;
      } catch (error) {
        console.error("添加标签失败:", error);
        return false;
      }
    },
    [articleId]
  );

  const detach = useCallback(
    async (tagId: string) => {
      if (!articleId) return false;
      try {
        const res = await fetch(
          `/api/articles/${articleId}/tags?tagId=${tagId}`,
          { method: "DELETE" }
        );
        const json = await res.json();
        if (json?.success) {
          setArticleTags((prev) => prev.filter((t) => t.id !== tagId));
          return true;
        }
        return false;
      } catch (error) {
        console.error("移除标签失败:", error);
        return false;
      }
    },
    [articleId]
  );

  return {
    allTags,
    articleTags,
    loading,
    createTag,
    attach,
    detach,
    reloadAll: loadAll,
  };
}
