"use client";

import { X } from "lucide-react";
import { SHORTCUT_LIST } from "@/hooks/use-reader-shortcuts";

/**
 * 快捷键帮助面板（按 ? 打开）。
 *
 * 阅读器的快捷键如果没人知道，等于不存在。QiReader 这类阅读器
 * 都会给一个面板把键位列出来。
 */
export function ShortcutHelp({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="键盘快捷键"
    >
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-[#1f1f1f]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#1a1a1a] dark:text-white">
            键盘快捷键
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#888] hover:bg-[#f0f0f0] dark:hover:bg-[#2a2a2a]"
            aria-label="关闭"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          {SHORTCUT_LIST.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-[#f8f6f3] dark:hover:bg-[#2a2a2a]"
            >
              <span className="text-sm text-[#555] dark:text-[#aaa]">{item.label}</span>
              <span className="flex gap-1">
                {item.keys.map((k) => (
                  <kbd
                    key={k}
                    className="min-w-[1.75rem] rounded border border-[#ddd] bg-[#f8f6f3] px-1.5 py-0.5 text-center font-mono text-[11px] text-[#333] dark:border-[#3a3a3a] dark:bg-[#2a2a2a] dark:text-[#ccc]"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-[#999]">
          在输入框中打字时快捷键不会触发；带 Cmd / Ctrl 的组合交给浏览器。
        </p>
      </div>
    </div>
  );
}
