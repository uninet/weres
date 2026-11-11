"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Rss, Settings, Palette, Check, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { READER_THEMES, type ReaderThemeId } from "@/hooks/use-reader-theme";
import { cn } from "@/lib/utils";
import { navItems } from "@/lib/reader-config";
import type { ArticleFilterType } from "@/types/reader";

interface HeaderProps {
  activeNav: ArticleFilterType;
  unreadCount: number;
  isDarkMode: boolean;
  onNavChange: (nav: ArticleFilterType) => void;
  /** 兼容旧的亮/暗切换（设置页等处仍在用） */
  onToggleDarkMode: () => void;
  /** 当前阅读主题 */
  readerTheme: ReaderThemeId;
  /** 切换阅读主题（浅色 / 米黄 / 电子墨水 / 深色） */
  onThemeChange: (theme: ReaderThemeId) => void;
}

export function Header({
  activeNav,
  unreadCount,
  isDarkMode,
  onNavChange,
  onToggleDarkMode,
  readerTheme,
  onThemeChange,
}: HeaderProps) {
  return (
    <header className="h-16 border-b border-[#e8e4df] dark:border-[#333] bg-white/80 dark:bg-[#1a1a1a]/90 backdrop-blur-md flex items-center justify-between px-6 shrink-0 sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 bg-gradient-to-br from-[#c9a962] to-[#a08040] rounded-lg flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
            <Rss className="h-5 w-5 text-white" />
          </div>
          <div className="hidden md:block">
            <span className="font-serif-sc font-bold text-xl text-[#1a1a1a] dark:text-[#f8f6f3] tracking-tight">
              WeRSS
            </span>
            <span className="block text-[10px] text-[#6b6b6b] dark:text-[#888] tracking-[0.2em] uppercase">
              Reader
            </span>
          </div>
        </Link>

        {/* Navigation Pills */}
        <div className="hidden lg:flex items-center gap-1 ml-8">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavChange(item.id as ArticleFilterType)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all duration-300",
                  isActive
                    ? "bg-[#1a1a1a] text-white dark:bg-[#f8f6f3] dark:text-[#1a1a1a]"
                    : "text-[#6b6b6b] hover:text-[#1a1a1a] dark:text-[#888] dark:hover:text-[#f8f6f3]"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
                {item.id === "unread" && unreadCount > 0 && (
                  <span className="ml-1 text-xs bg-[#c9a962] text-white px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* 阅读主题：浅色 / 米黄 / 电子墨水 / 深色。
            原来的开关只有亮暗两档，电子墨水屏用户没有可选项。 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-[#6b6b6b] hover:text-[#1a1a1a] hover:bg-[#f0ede8] dark:text-[#888] dark:hover:text-[#f8f6f3] dark:hover:bg-[#2a2a2a]"
              title="阅读主题"
            >
              <Palette className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {READER_THEMES.map((t) => (
              <DropdownMenuItem
                key={t.id}
                onClick={() => onThemeChange(t.id)}
                className="gap-2 cursor-pointer"
              >
                <span
                  className="h-4 w-4 rounded-full border border-black/10"
                  style={{ backgroundColor: t.swatch }}
                />
                <span className="flex-1">{t.label}</span>
                {readerTheme === t.id && <Check className="h-3.5 w-3.5" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-[#6b6b6b] hover:text-[#1a1a1a] hover:bg-[#f0ede8] dark:text-[#888] dark:hover:text-[#f8f6f3] dark:hover:bg-[#2a2a2a]"
              asChild
            >
              <Link href="/settings">
                <Settings className="h-5 w-5" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>设置</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full text-[#6b6b6b] hover:text-[#1a1a1a] hover:bg-[#f0ede8] dark:text-[#888] dark:hover:text-[#f8f6f3] dark:hover:bg-[#2a2a2a]"
              asChild
            >
              <Link href="/profile">
                <User className="h-5 w-5" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>个人中心</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
