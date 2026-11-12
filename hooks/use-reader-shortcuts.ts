"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * 阅读器键盘快捷键。
 *
 * 设计原则（参照 QiReader / Reeder / NetNewsWire 的通行做法）：
 *   1. 单键可用 —— 阅读器是个「手不离键盘」的场景，按 j/k 比按 Cmd+↓ 快得多；
 *   2. 输入框里绝不触发 —— 用户在搜索框打字时按 m 不该跳文章；
 *   3. 带修饰键的组合一律放行，不与浏览器/系统快捷键抢（Cmd+R 刷新等）。
 *
 * 键位：
 *   Space       向下翻一屏（不是切换文章 —— 翻页与换文章是两个动作）
 *   Shift+Space 向上翻一屏
 *   m           上一篇（用户明确要求）
 *   n           下一篇（用户明确要求）
 *   j / k       下一篇 / 上一篇（Vim 习惯，与 m/n 并存）
 *   o           打开原文
 *   s           收藏 / 取消收藏
 *   v           标记已读 / 未读
 *   t           切换主题
 *   f           沉浸模式
 *   r           刷新
 *   ,           打开阅读设置
 *   Esc         退出沉浸 / 关闭设置
 *   ?           显示快捷键帮助
 */
export interface ReaderShortcuts {
  onPrev: () => void;
  onNext: () => void;
  /**
   * 翻一屏。
   *
   * 和 onNext 分开是有意的：M/N 是「换一篇文章」，空格是「这篇文章还没读完，
   * 继续往下看」。把两者绑成同一个动作，会在用户读到一半按空格时直接跳到
   * 下一篇，这是很重的误操作 —— 而空格恰恰是阅读时按得最多的键。
   */
  onPageDown: () => void;
  onPageUp: () => void;
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

  // 用 ref 保存最新回调，避免把 rest 放进依赖数组导致每帧重绑监听。
  // 之前是 [enabled, rest]，rest 每次渲染都是新对象 —— 结果是每次状态变化
  // 都要 removeEventListener + addEventListener 一遍。
  const handlersRef = useRef(rest);
  handlersRef.current = rest;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // 带 Cmd/Ctrl/Alt 的组合交给浏览器（Cmd+R、Cmd+T 等）。
      // 注意：Shift 要放行给「Shift+空格＝向上翻页」，所以不在这个判断里。
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // 正在输入时不抢按键
      if (isTypingTarget(e.target)) {
        // 唯一例外：Esc 应该能退出输入状态
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      const h = handlersRef.current;

      // 空格键的 e.key 在不同环境里是 " " 或 "Space"（老浏览器 / 某些自动化
      // 工具给的是后者），两个都认，否则用户在特定浏览器上按空格毫无反应。
      if (e.key === " " || e.key === "Space" || e.code === "Space") {
        e.preventDefault();
        if (e.shiftKey) {
          h.onPageUp();
        } else {
          h.onPageDown();
        }
        return;
      }

      switch (e.key) {
        case "m":
        case "k":
          e.preventDefault();
          h.onPrev();
          break;
        case "n":
        case "j":
          e.preventDefault();
          h.onNext();
          break;
        case "o":
          e.preventDefault();
          h.onOpenOriginal();
          break;
        case "s":
          e.preventDefault();
          h.onToggleFavorite();
          break;
        case "v":
          e.preventDefault();
          h.onToggleRead();
          break;
        case "t":
          e.preventDefault();
          h.onToggleTheme();
          break;
        case "f":
          e.preventDefault();
          h.onToggleImmersive();
          break;
        case "r":
          e.preventDefault();
          h.onRefresh();
          break;
        case ",":
          e.preventDefault();
          h.onOpenSettings();
          break;
        case "?":
          e.preventDefault();
          h.onShowHelp();
          break;
        case "Escape":
          h.onEscape();
          break;
        default:
          break;
      }
    },
    [enabled]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}

/** 快捷键说明（供帮助面板渲染，键位与上面一一对应） */
export const SHORTCUT_LIST: Array<{ keys: string[]; label: string }> = [
  { keys: ["Space"], label: "向下翻一屏" },
  { keys: ["Shift", "Space"], label: "向上翻一屏" },
  { keys: ["m", "k"], label: "上一篇" },
  { keys: ["n", "j"], label: "下一篇" },
  { keys: ["o"], label: "打开原文" },
  { keys: ["s"], label: "收藏 / 取消收藏" },
  { keys: ["v"], label: "标记已读 / 未读" },
  { keys: ["t"], label: "切换外观" },
  { keys: ["f"], label: "沉浸模式" },
  { keys: ["r"], label: "刷新" },
  { keys: [","], label: "更多设置" },
  { keys: ["?"], label: "快捷键帮助" },
  { keys: ["Esc"], label: "退出沉浸 / 关闭面板" },
];
