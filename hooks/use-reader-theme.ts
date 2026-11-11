"use client";

import { useEffect, useState } from "react";

/**
 * 可选的阅读主题。
 *
 * 为什么不用 next-themes 的 dark/light 二档：
 * 阅读器的主题不是「亮/暗」这么简单 —— 电子墨水屏（Kindle、文石、
 * 掌阅）的最佳配色是**低对比度的米黄底 + 深灰字**，纯白底会显得刺眼，
 * 纯黑底在墨水屏上会整体刷黑反而更难读。QiReader 就提供专门的
 * 电子墨水主题，这是它被很多人选择的原因之一。
 *
 * 实现方式：给 <html> 挂 data-reader-theme，配合 article-content.css
 * 里的变量覆盖即可，不需要为每个主题写一套组件样式。
 */
export const READER_THEMES = [
  { id: "light", label: "浅色", swatch: "#f8f6f3", dot: "#1a1a1a" },
  { id: "sepia", label: "米黄", swatch: "#f4ecd8", dot: "#433422" },
  { id: "eink", label: "电子墨水", swatch: "#e8e6e1", dot: "#2b2b2b" },
  { id: "dark", label: "深色", swatch: "#1a1a1a", dot: "#e0e0e0" },
] as const;

export type ReaderThemeId = (typeof READER_THEMES)[number]["id"];

const STORAGE_KEY = "werss:reader-theme";

export function useReaderTheme() {
  const [theme, setThemeState] = useState<ReaderThemeId>("light");
  const [mounted, setMounted] = useState(false);

  // 首屏从 localStorage 恢复。放在 effect 里避免 SSR/CSR 不一致。
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY) as ReaderThemeId | null;
    if (saved && READER_THEMES.some((t) => t.id === saved)) {
      setThemeState(saved);
    }
    setMounted(true);
  }, []);

  // 主题变化时同步到 <html>，样式由 CSS 变量接管
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.dataset.readerTheme = theme;
    root.classList.toggle("dark", theme === "dark");
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, mounted]);

  const setTheme = (next: ReaderThemeId) => setThemeState(next);

  return { theme, setTheme, mounted };
}
