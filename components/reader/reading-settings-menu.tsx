"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  fontSizes,
  fontFamilies,
  lineHeightOptions,
  contentWidthOptions,
} from "@/lib/reader-config";

interface ReadingSettingsMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fontSize: string;
  fontFamily: string;
  lineHeight: string;
  contentWidth: string;
  onFontSizeChange: (value: string) => void;
  onFontFamilyChange: (value: string) => void;
  onLineHeightChange: (value: string) => void;
  onContentWidthChange: (value: string) => void;
}

export function ReadingSettingsMenu({
  open,
  onOpenChange,
  fontSize,
  fontFamily,
  lineHeight,
  contentWidth,
  onFontSizeChange,
  onFontFamilyChange,
  onLineHeightChange,
  onContentWidthChange,
}: ReadingSettingsMenuProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-[#6b6b6b] hover:text-[#1a1a1a] hover:bg-[#f0ede8] dark:text-[#888] dark:hover:text-[#f8f6f3] dark:hover:bg-[#2a2a2a]"
            >
              <Type className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>阅读设置</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56 p-4 space-y-4">
        {/* Font Size */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[#6b6b6b]">字体大小</label>
          <div className="flex gap-1">
            {fontSizes.map((size) => (
              <button
                key={size.value}
                onClick={() => onFontSizeChange(size.value)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-sm transition-colors",
                  fontSize === size.value
                    ? "bg-[#1a1a1a] text-white"
                    : "bg-[#f0ede8] text-[#6b6b6b] hover:bg-[#e8e4df]"
                )}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>

        {/* Font Family */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[#6b6b6b]">字体样式</label>
          <div className="space-y-1">
            {fontFamilies.map((font) => (
              <button
                key={font.value}
                onClick={() => onFontFamilyChange(font.value)}
                className={cn(
                  "w-full px-3 py-2 rounded-lg text-sm text-left transition-colors",
                  fontFamily === font.value
                    ? "bg-[#1a1a1a] text-white"
                    : "hover:bg-[#f0ede8]"
                )}
              >
                <span className={font.className}>{font.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Line Height */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[#6b6b6b]">行间距</label>
          <div className="flex gap-1">
            {lineHeightOptions.map((lh) => (
              <button
                key={lh.value}
                onClick={() => onLineHeightChange(lh.value)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs transition-colors",
                  lineHeight === lh.value
                    ? "bg-[#1a1a1a] text-white"
                    : "bg-[#f0ede8] text-[#6b6b6b] hover:bg-[#e8e4df]"
                )}
              >
                {lh.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Width */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-[#6b6b6b]">内容宽度</label>
          <div className="flex gap-1">
            {contentWidthOptions.map((w) => (
              <button
                key={w.value}
                onClick={() => onContentWidthChange(w.value)}
                className={cn(
                  "flex-1 py-2 rounded-lg text-xs transition-colors",
                  contentWidth === w.value
                    ? "bg-[#1a1a1a] text-white"
                    : "bg-[#f0ede8] text-[#6b6b6b] hover:bg-[#e8e4df]"
                )}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
