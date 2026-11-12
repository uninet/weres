"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageShellProps {
  title: string;
  /** 标题下的一句说明，没有就不占位 */
  subtitle?: string;
  icon?: LucideIcon;
  /** 图标底色，不同页面区分一下 */
  iconClassName?: string;
  /** 顶栏右侧的操作按钮 */
  actions?: ReactNode;
  /** 返回目标；传 null 不显示返回按钮 */
  backHref?: string | null;
  children: ReactNode;
}

/**
 * 次级页面的统一外壳。
 *
 * 为什么需要它：改造前 7 个页面各自手写 `sticky top-0` 顶栏，
 * 样式各写各的 —— 收藏/历史/通知只有标题和图标，订阅/市场/个人中心
 * 是一模一样的三个跳转链接，设置页是返回箭头。于是同一个产品里
 * 有三个不同高度的顶栏、两套导航语言，而阅读器那边已经改成
 * 「没有顶栏」了，风格彻底割裂。
 *
 * 现在统一成：56px 高的顶栏（返回箭头 + 图标 + 标题 + 右侧操作），
 * 内容区居中限宽。移动端底部预留 h-14 给底部导航，不然最后一条
 * 内容会被导航盖住。
 */
export function PageShell({
  title,
  subtitle,
  icon: Icon,
  iconClassName,
  actions,
  backHref = "/reader",
  children,
}: PageShellProps) {
  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-14 md:pb-0 dark:bg-[#151517]">
      <header className="sticky top-0 z-30 border-b border-black/[0.07] bg-white/85 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#1c1c1e]/85">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-3 sm:px-4">
          {backHref && (
            <Link
              href={backHref}
              aria-label="返回"
              className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-black/[0.05] hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.08] dark:hover:text-gray-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
          )}

          {Icon && (
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                iconClassName ?? "bg-gray-100 text-gray-600 dark:bg-white/[0.08] dark:text-gray-300"
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h1>
            {subtitle && (
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {subtitle}
              </p>
            )}
          </div>

          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-5">{children}</main>
    </div>
  );
}
