"use client";

import { useCallback, useEffect } from "react";

/**
 * 阅读器键盘快捷键。
 *
 * 设计原则（参照 QiReader / Reeder / NetNewsWire 的通行做法）：
 *   1. 单键可用 —— 阅读器是个「手不离键盘」的场景，按 j/k 比按 Cmd+↓ 快得多；
 *   2. 输入框里绝不触发 —— 用户在搜索框打字时按 m 不该跳文章；
 *   3. 带修饰键的组合一律放行，不与浏览器/系统快捷键抢（Cmd+R 刷新等）。
 *
 * 键位：
 *   m       上一篇（用户明确要求）
 *   n       下一篇（用户明确要求）
 *   j / k   下一篇 / 上一篇（Vim 习惯，与 m/n 并存）
 *   Space   下一篇（顺滚动方向，符合直觉）
 *   o       打开原文
 *   s       收藏 / 取消收藏
 *   v       标记已读 / 未读
 *   t       切换主题（浅色 / 深色）
 *   f       沉浸模式
 *   r       刷新
 *   ,       打开阅读设置
 *   Esc     退出沉浸 / 关闭设置
 *   ?       显示快捷键帮助
 */
export interface ReaderShortcuts {
  onPrev: () => void;
  onNext: () => void;
  onOpenOriginal: () => void;
  onToggleFavorite: () => void;
  onToggleRead: () => void;
  onToggleTheme: () => void;
  onToggleImmersive: () => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onEscape: () => void;
  onShowHelp: () => void;
  /** 是否启用。弹窗打开时可以临时关掉，避免 Esc 与弹窗冲突 */
  enabled?: boolean;
}

/**
 * 判断当前焦点是否在可输入元素里。
 * 在输入框里按字母键必须是打字，不能变成快捷键。
 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (target.isContentEditable) return true;
  // 富文本编辑器 / 代码块也属于"正在输入"
  if (target.closest('[contenteditable="true"]')) return true;
  return false;
}

export function useReaderShortcuts(handlers: ReaderShortcuts) {
  const { enabled = true, ...rest } = handlers;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // 带 Cmd/Ctrl/Alt 的组合交给浏览器（Cmd+R、Cmd+T 等）
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // 正在输入时不抢按键
      if (isTypingTarget(e.target)) {
        // 唯一例外：Esc 应该能退出输入状态
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      switch (e.key) {
        case "m":
        case "k":
          e.preventDefault();
          rest.onPrev();
          break;
        case "n":
        case "j":
        case " ":
          e.preventDefault();
          rest.onNext();
          break;
        case "o":
          e.preventDefault();
          rest.onOpenOriginal();
          break;
        case "s":
          e.preventDefault();
          rest.onToggleFavorite();
          break;
        case "v":
          e.preventDefault();
          rest.onToggleRead();
          break;
        case "t":
          e.preventDefault();
          rest.onToggleTheme();
          break;
        case "f":
          e.preventDefault();
          rest.onToggleImmersive();
          break;
        case "r":
          e.preventDefault();
          rest.onRefresh();
          break;
        case ",":
          e.preventDefault();
          rest.onOpenSettings();
          break;
        case "?":
          e.preventDefault();
          rest.onShowHelp();
          break;
        case "Escape":
          rest.onEscape();
          break;
        default:
          break;
      }
    },
    [enabled, rest]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

/** 快捷键说明（供帮助面板渲染，键位与上面一一对应） */
export const SHORTCUT_LIST: Array<{ keys: string[]; label: string }> = [
  { keys: ["m", "k"], label: "上一篇" },
  { keys: ["n", "j", "Space"], label: "下一篇" },
  { keys: ["o"], label: "打开原文" },
  { keys: ["s"], label: "收藏 / 取消收藏" },
  { keys: ["v"], label: "标记已读 / 未读" },
  { keys: ["t"], label: "切换主题" },
  { keys: ["f"], label: "沉浸模式" },
  { keys: ["r"], label: "刷新" },
  { keys: [","], label: "阅读设置" },
  { keys: ["?"], label: "快捷键帮助" },
  { keys: ["Esc"], label: "退出沉浸 / 关闭面板" },
];
