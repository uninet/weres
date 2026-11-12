"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { primaryNav, isNavActive } from "@/lib/navigation";

/**
 * 移动端底部导航。
 *
 * 之前的问题：只在 `pathname` 命中这 4 个 href 时才渲染
 * （`showBottomNav` 判断）。于是订阅管理、历史、通知、设置页
 * 在手机上**完全没有导航** —— 用户点进「历史」之后就出不来，
 * 只能靠浏览器返回键。这不是「少了个入口」，是把用户困住了。
 *
 * 现在改为：只要在 (main) 布局里就渲染，5 个主入口常驻。
 * 次级入口（历史/通知/设置/帮助）不占这里的位置，
 * 它们放在「我的」页和顶栏的「更多」里 —— 底部导航每多一项，
 * 剩下每项的点击区域就小一分，5 项是手指舒适度的上限。
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-black/[0.06] bg-white/95 backdrop-blur-md md:hidden dark:border-white/[0.08] dark:bg-[#1c1c1e]/95"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="主导航"
    >
      <div className="flex h-14 items-center justify-around">
        {primaryNav.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              className={cn(
                "flex h-full flex-1 flex-col items-center justify-center gap-0.5 transition-colors duration-150",
                // 触控目标要够大：h-full + flex-1 让每格约 72×56，
                // 满足 44×44 的最小可点区域
                active
                  ? "text-[#c9a962] dark:text-[#d9bd82]"
                  : "text-gray-400 dark:text-gray-500"
              )}
            >
              <Icon
                className={cn("h-5 w-5", active && "scale-105")}
                strokeWidth={active ? 2.2 : 1.8}
                aria-hidden="true"
              />
              <span className="text-[10px] leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
