"use client";

import Link from "next/link";
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
import { Check, Menu, Palette, PanelLeftClose, PanelLeftOpen, Settings, User } from "lucide-react";
import { READER_THEMES, type ReaderThemeId } from "@/hooks/use-reader-theme";
import { navItems } from "@/lib/reader-config";
import { cn } from "@/lib/utils";
import type { ArticleFilterType } from "@/types/reader";

interface ReaderDockProps {
  activeNav: ArticleFilterType;
  unreadCount: number;
  onNavChange: (nav: ArticleFilterType) => void;
  readerTheme: ReaderThemeId;
  onThemeChange: (theme: ReaderThemeId) => void;
  showUnreadBadge?: boolean;
  /** 侧栏是否已折叠；不传则不显示折叠项（沉浸模式下用不到） */
  sidebarCollapsed?: boolean;
  /** 切换侧栏折叠 */
  onToggleSidebar?: () => void;
}

/**
 * 阅读器左下角的入口。
 *
 * 原来顶部有一条 h-14 的顶栏，装着 logo、全部/稍后阅读/未读、
 * 主题、设置、个人中心。它和正文、列表是上下排列的，等于整块
 * 屏幕顶部被横切掉 56px —— 而这一栏里的东西都不是「读文章时
 * 每秒钟都要看」的：筛选切换一天几次，主题和设置更少。
 *
 * 所以整条顶栏取消，这些入口收到左下角一个按钮里，展开是
 * 一个纵向菜单。顶部的空间全部还给内容。
 */
export function ReaderDock({
  activeNav,
  unreadCount,
  onNavChange,
  readerTheme,
  onThemeChange,
  showUnreadBadge = true,
  sidebarCollapsed,
  onToggleSidebar,
}: ReaderDockProps) {
  const current = navItems.find((item) => item.id === activeNav) ?? navItems[0];
  const CurrentIcon = current.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          // 绝对定位在左下角：左下角是整块界面里唯一一处「一直空着」的地方
          // ——侧栏列表滚到底就结束了，正文也不会延伸到那里。
          className={cn(
            // 不再 absolute：作为侧栏 flex 布局的最后一行占位，
            // 这样它永远不压住源列表——滚到底时最后一条就在它上面。
            "mx-2 mb-2 flex h-10 shrink-0 items-center gap-2 rounded-xl",
            "border border-black/[0.08] bg-white/95 backdrop-blur-md",
            "text-[13px] font-medium text-[#444] shadow-sm",
            "transition-all duration-150 hover:bg-white hover:shadow-md active:scale-95",
            "dark:border-white/[0.1] dark:bg-[#252525]/95 dark:text-[#ddd] dark:hover:bg-[#2a2a2a]",
            // 侧栏收起时宽度只有 64px，按钮必须缩成一个图标，
            // 否则会横向溢出压到列表栏上。
            sidebarCollapsed ? "justify-center px-0" : "justify-start px-3"
          )}
          title="导航与设置"
          aria-label="导航与设置"
        >
          <Menu className="h-4 w-4 shrink-0" />
          {!sidebarCollapsed && (
            <>
              <span className="flex flex-1 items-center gap-1.5 truncate">
                <CurrentIcon className="h-3.5 w-3.5 shrink-0" />
                {current.label}
              </span>
              {activeNav === "unread" && showUnreadBadge && unreadCount > 0 && (
                <span className="rounded-full bg-[#c9a962] px-1.5 py-0.5 text-[10px] leading-none text-white">
                  {unreadCount}
                </span>
              )}
            </>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-52"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <DropdownMenuItem
              key={item.id}
              onClick={() => onNavChange(item.id as ArticleFilterType)}
              className="gap-2.5 cursor-pointer"
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.id === "unread" && showUnreadBadge && unreadCount > 0 && (
                <span className="rounded-full bg-[#c9a962] px-1.5 py-0.5 text-[10px] leading-none text-white">
                  {unreadCount}
                </span>
              )}
              {isActive && <Check className="h-3.5 w-3.5" />}
            </DropdownMenuItem>
          );
        })}

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2.5">
            <Palette className="h-4 w-4" />
            <span className="flex-1">外观</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-40">
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
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {onToggleSidebar && (
          <DropdownMenuItem
            onClick={onToggleSidebar}
            className="gap-2.5 cursor-pointer"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
            <span className="flex-1">
              {sidebarCollapsed ? "展开侧栏" : "收起侧栏"}
            </span>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild className="gap-2.5 cursor-pointer">
          <Link href="/settings">
            <Settings className="h-4 w-4" />
            设置
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="gap-2.5 cursor-pointer">
          <Link href="/profile">
            <User className="h-4 w-4" />
            个人中心
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
