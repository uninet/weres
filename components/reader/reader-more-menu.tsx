"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Check,
  Volume2,
  Square,
  Tag as TagIcon,
  BookOpen,
  Share2,
  ExternalLink,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fontSizes,
  fontFamilies,
  lineHeightOptions,
  contentWidthOptions,
} from "@/lib/reader-config";
import { READER_THEMES, type ReaderThemeId } from "@/hooks/use-reader-theme";

/**
 * 「更多」菜单：所有阅读偏好与低频操作都收在这里。
 *
 * 之前工具栏右侧平铺了 11 个图标按钮（字号、字体、行距、宽度、亮暗、朗读、
 * 沉浸、收藏、标签、Kindle、分享、原文）。按钮越多，用户越难找到真正想按的
 * 那个，而且几乎每个都得靠 tooltip 才知道是什么。
 *
 * 现在的分工：
 *   - 工具栏只留「跟这篇内容直接相关且高频」的：收藏、沉浸、更多；
 *   - 调一次用很久的偏好（外观 / 字号 / 字体 / 行距 / 页宽）和低频操作
 *     （朗读 / 标签 / Kindle / 分享 / 原文）全部收进这里。
 *
 * 面板内用「分组 + 当前项高亮」而不是一串二级菜单：调字号时想同时看到行距和
 * 页宽，来回切二级菜单很难判断改动效果。
 */
export interface ReaderMoreMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // 排版
  fontSize: string;
  fontFamily: string;
  lineHeight: string;
  contentWidth: string;
  readerTheme: ReaderThemeId;
  onFontSizeChange: (value: string) => void;
  onFontFamilyChange: (value: string) => void;
  onLineHeightChange: (value: string) => void;
  onContentWidthChange: (value: string) => void;
  onThemeChange: (theme: ReaderThemeId) => void;

  // 操作
  ttsSupported?: boolean;
  ttsSpeaking?: boolean;
  onToggleTts?: () => void;

  articleTags?: Array<{ id: string; name: string; color: string }>;
  allTags?: Array<{ id: string; name: string; color: string }>;
  onAttachTag?: (tag: { id: string; name: string; color: string }) => void;
  onDetachTag?: (tagId: string) => void;
  onCreateTag?: (name: string) => void;

  kindleEnabled?: boolean;
  kindlePushing?: boolean;
  onPushToKindle?: () => void;

  onShare?: () => void;
  onOpenOriginal?: () => void;

  /** 兼容旧的亮/暗切换；外观四档已包含深色，这里保留给外部调用 */
  onToggleDarkMode?: () => void;
  isDarkMode?: boolean;
}

/** 一行选项组：标题 + 备选值，当前值高亮 */
function OptionRow<T extends string>({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: Array<{ label: string; value: T; className?: string }>;
  value: string;
  onSelect: (value: T) => void;
}) {
  return (
    <div className="px-2 py-1.5">
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-[#999] dark:text-[#777]">
        {label}
      </div>
      <div className="flex gap-1">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              onClick={() => onSelect(option.value)}
              className={cn(
                "flex-1 rounded-md py-1.5 text-[13px] transition-colors",
                option.className,
                active
                  ? "bg-[#007AFF] text-white"
                  : "bg-black/[0.04] text-[#555] hover:bg-black/[0.08] dark:bg-white/[0.08] dark:text-[#bbb] dark:hover:bg-white/[0.14]"
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ReaderMoreMenu({
  open,
  onOpenChange,
  fontSize,
  fontFamily,
  lineHeight,
  contentWidth,
  readerTheme,
  onFontSizeChange,
  onFontFamilyChange,
  onLineHeightChange,
  onContentWidthChange,
  onThemeChange,
  ttsSupported = false,
  ttsSpeaking = false,
  onToggleTts,
  articleTags = [],
  allTags = [],
  onAttachTag,
  onDetachTag,
  onCreateTag,
  kindleEnabled = false,
  kindlePushing = false,
  onPushToKindle,
  onShare,
  onOpenOriginal,
}: ReaderMoreMenuProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-lg text-[#666] hover:bg-black/[0.05] hover:text-[#1a1a1a] dark:text-[#999] dark:hover:bg-white/[0.08] dark:hover:text-white"
          title="更多设置"
          aria-label="更多设置"
        >
          <MoreHorizontal className="h-[18px] w-[18px]" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[17rem] p-1.5"
        // 点选项时不要自动关闭：调字号往往要连按几下，
        // 每按一次就关掉会让人反复重开
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* ---------- 外观 ---------- */}
        <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-[#999] dark:text-[#777]">
          外观
        </DropdownMenuLabel>
        <div className="grid grid-cols-2 gap-1 px-2 pb-1.5">
          {READER_THEMES.map((theme) => {
            const active = readerTheme === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => onThemeChange(theme.id)}
                className={cn(
                  "flex items-center gap-2 rounded-md border px-2.5 py-2 text-[13px] transition-colors",
                  active
                    ? "border-[#007AFF] bg-[#007AFF]/[0.08] text-[#007AFF]"
                    : "border-black/[0.08] text-[#555] hover:bg-black/[0.04] dark:border-white/[0.12] dark:text-[#bbb] dark:hover:bg-white/[0.06]"
                )}
              >
                <span
                  className="h-4 w-4 shrink-0 rounded-full border border-black/10 dark:border-white/20"
                  style={{ backgroundColor: theme.swatch }}
                />
                <span className="flex-1 text-left">{theme.label}</span>
                {active && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>

        <DropdownMenuSeparator />

        {/* ---------- 排版 ---------- */}
        <OptionRow label="字号" options={fontSizes} value={fontSize} onSelect={onFontSizeChange} />
        <OptionRow label="字体" options={fontFamilies} value={fontFamily} onSelect={onFontFamilyChange} />
        <OptionRow label="行距" options={lineHeightOptions} value={lineHeight} onSelect={onLineHeightChange} />
        <OptionRow label="页宽" options={contentWidthOptions} value={contentWidth} onSelect={onContentWidthChange} />

        <DropdownMenuSeparator />

        {/* ---------- 操作 ---------- */}
        {ttsSupported && onToggleTts && (
          <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onToggleTts(); }}>
            {ttsSpeaking ? (
              <>
                <Square className="mr-2 h-4 w-4" />
                停止朗读
              </>
            ) : (
              <>
                <Volume2 className="mr-2 h-4 w-4" />
                朗读全文
              </>
            )}
          </DropdownMenuItem>
        )}

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <TagIcon className="mr-2 h-4 w-4" />
            标签
            {articleTags.length > 0 && (
              <span className="ml-1 text-xs text-[#999]">{articleTags.length}</span>
            )}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-52">
            {allTags.length === 0 && (
              <div className="px-2 py-1.5 text-[13px] text-[#999]">还没有标签</div>
            )}
            {allTags.map((tag) => {
              const attached = articleTags.some((t) => t.id === tag.id);
              return (
                <DropdownMenuItem
                  key={tag.id}
                  onSelect={(e) => {
                    e.preventDefault();
                    if (attached) {
                      onDetachTag?.(tag.id);
                    } else {
                      onAttachTag?.(tag);
                    }
                  }}
                >
                  <span
                    className="mr-2 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 truncate">{tag.name}</span>
                  {attached && <Check className="h-3.5 w-3.5" />}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                const name = window.prompt("新标签名（最多 20 个字）");
                if (name?.trim()) onCreateTag?.(name.trim());
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              新建标签…
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {kindleEnabled && onPushToKindle && (
          <DropdownMenuItem disabled={kindlePushing} onSelect={() => onPushToKindle()}>
            <BookOpen
              className={cn(
                "mr-2 h-4 w-4",
                kindlePushing && "animate-pulse text-[#FF9900]"
              )}
            />
            {kindlePushing ? "推送中…" : "推送到 Kindle"}
          </DropdownMenuItem>
        )}

        {onShare && (
          <DropdownMenuItem onSelect={() => onShare()}>
            <Share2 className="mr-2 h-4 w-4" />
            复制原文链接
          </DropdownMenuItem>
        )}

        {onOpenOriginal && (
          <DropdownMenuItem onSelect={() => onOpenOriginal()}>
            <ExternalLink className="mr-2 h-4 w-4" />
            在浏览器打开原文
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
