"use client";

import { useEffect, useRef } from "react";

/**
 * 滚动即已读。
 *
 * QiReader 等成熟阅读器都有这个行为：不是「点开就算读过」，
 * 而是用户真的把正文滚下去了才算 —— 这样在列表里快速翻找
 * 目标文章时，不会把路过的每一篇都变成已读。
 *
 * 判定规则：
 *   - 正文滚动进度超过阈值（默认 60%）即视为读完；
 *   - 极短的文章一屏就能看完，滚动进度可能永远到不了 60%，
 *     所以额外要求「已滚动距离 > 80px」作为补偿路径；
 *   - 每篇文章只会触发一次。
 *
 * 注意 ScrollArea（Radix）的滚动容器不是 window，而是内部的
 * viewport 元素，必须从传进来的容器上找。
 */
export function useScrollToRead({
  containerRef,
  articleId,
  enabled,
  threshold = 0.6,
  onRead,
}: {
  containerRef: React.RefObject<HTMLElement>;
  articleId: string | null | undefined;
  enabled: boolean;
  threshold?: number;
  onRead: (articleId: string) => void;
}) {
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const root = containerRef.current;
    if (!enabled || !root || !articleId) return;
    if (firedRef.current.has(articleId)) return;

    // Radix ScrollArea 的真正的滚动元素是 [data-radix-scroll-area-viewport]
    const viewport =
      (root.querySelector(
        "[data-radix-scroll-area-viewport]"
      ) as HTMLElement | null) ?? root;

    const check = () => {
      if (firedRef.current.has(articleId)) return;

      const scrollTop = viewport.scrollTop;
      const scrollHeight = viewport.scrollHeight;
      const clientHeight = viewport.clientHeight;

      // 内容比视口还短：用户一眼就看完，直接算已读
      if (scrollHeight <= clientHeight + 40) {
        firedRef.current.add(articleId);
        onRead(articleId);
        return;
      }

      const scrollable = scrollHeight - clientHeight;
      const progress = scrollTop / scrollable;

      const passedThreshold = progress >= threshold;
      // 补偿：短文章滚一点点就到底了，进度条可能卡在 0.4
      const scrolledEnough =
        scrollTop > 80 && scrollTop + clientHeight >= scrollHeight - 120;

      if (passedThreshold || scrolledEnough) {
        firedRef.current.add(articleId);
        onRead(articleId);
      }
    };

    viewport.addEventListener("scroll", check, { passive: true });
    // 切换文章时先判一次：太短的文章不需要滚动
    check();

    return () => viewport.removeEventListener("scroll", check);
  }, [containerRef, articleId, enabled, threshold, onRead]);

  /** 切换文章时清空「已触发」记录，让新文章能重新判定 */
  const reset = () => firedRef.current.clear();

  return { reset };
}
