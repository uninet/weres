/**
 * 阅读器翻页。
 *
 * 空格键在阅读器里应该是「往下翻一屏」而不是「跳到下一篇」——
 * 这是所有长文阅读器的共识（Reeder、Instapaper、Pocket 都是这样）。
 * 换文章是独立动作，绑在 m/n 上。
 *
 * 这里必须按「滚动容器」翻页而不是 window.scrollBy：
 * 正文外面套的是 Radix ScrollArea，真正的滚动元素是它内部的
 * [data-radix-scroll-area-viewport]，window 根本不会滚。
 */

/** 从任意容器找到真正能滚的那一层 */
export function findScrollViewport(root: HTMLElement | null): HTMLElement | null {
  if (!root) return null;
  return (
    (root.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLElement | null) ?? root
  );
}

/**
 * 翻一屏。
 *
 * 用视口高度减去一点余量（而不是整整一屏），让上一屏的最后几行
 * 留在视野里 —— 读者能接上刚才那句话，不用回头找位置。
 */
export function pageScroll(
  root: HTMLElement | null,
  direction: "down" | "up"
): boolean {
  const viewport = findScrollViewport(root);
  if (!viewport) return false;

  const slack = 80;
  const delta = Math.max(160, viewport.clientHeight - slack);
  const target =
    direction === "down"
      ? viewport.scrollTop + delta
      : viewport.scrollTop - delta;

  // smooth 让翻页有连续的位移感，而不是瞬间跳变 ——
  // 瞬时跳变在长文里会让人丢失阅读位置。
  viewport.scrollTo({ top: target, behavior: "smooth" });
  return true;
}

/** 滚到顶部 / 底部，用于切换文章时归位 */
export function scrollReaderTo(root: HTMLElement | null, position: "top" | "bottom") {
  const viewport = findScrollViewport(root);
  if (!viewport) return;
  viewport.scrollTo({
    top: position === "top" ? 0 : viewport.scrollHeight,
    behavior: "auto",
  });
}
