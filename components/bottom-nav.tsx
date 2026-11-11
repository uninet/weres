"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Rss, Heart, User } from "lucide-react";
import { cn } from "@/lib/utils";

const bottomNavItems = [
  { href: "/reader", label: "阅读", icon: BookOpen },
  { href: "/market", label: "市场", icon: Rss },
  { href: "/favorites", label: "收藏", icon: Heart },
  { href: "/profile", label: "我的", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  // 只在特定页面显示底部导航
  const showBottomNav = bottomNavItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  if (!showBottomNav) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t md:hidden z-50 safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {bottomNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              aria-label={item.label}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors duration-200",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
