import {
  BookOpen,
  Rss,
  Heart,
  Settings,
  User,
  History,
  Bell,
  HelpCircle,
  Layers,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** 次级入口：不进底部导航，收进「更多」里 */
  secondary?: boolean;
  /** 一句话说明，给「更多」菜单和无障碍用 */
  hint?: string;
}

/**
 * 全站导航的唯一信息源。
 *
 * 注意命名：`lib/reader-config.ts` 里也有一个 `navItems`，那是阅读器
 * 内部的「全部 / 稍后阅读 / 未读」筛选。两者是不同层级的东西，
 * 这里刻意叫 `allNavItems` 以免读代码时混淆。
 *
 * 改动前的情况：`components/mobile-nav.tsx` 里有一套 8 项的清单
 * （而且那个组件全项目没有任何地方引用），`components/bottom-nav.tsx`
 * 里另一套 4 项的清单，7 个页面又各自手写顶栏、各写各的链接。
 * 于是同一个「个人中心」在不同页面有时叫「我的」有时叫「个人中心」，
 * 移动端的收藏页能进历史页，历史页却出不去。
 *
 * 现在按「用得多不多」分两类：
 *   - 主入口（5 个）：阅读 / 市场 / 订阅 / 收藏 / 我的。
 *     这五个构成底部导航，任何页面都能一步到达。
 *   - 次级入口：历史、通知、设置、帮助。它们重要但不是每分钟都要点，
 *     收进「更多」菜单和「我的」页里，不占底部导航的位置。
 */
export const allNavItems: NavItem[] = [
  { href: "/reader", label: "阅读", icon: BookOpen, hint: "看文章" },
  { href: "/market", label: "市场", icon: Rss, hint: "发现新订阅源" },
  { href: "/subscriptions", label: "订阅", icon: Layers, hint: "管理已订阅的源" },
  { href: "/favorites", label: "收藏", icon: Heart, hint: "看过的、想留住的" },
  { href: "/profile", label: "我的", icon: User, hint: "资料与设置" },
  { href: "/history", label: "阅读历史", icon: History, secondary: true },
  { href: "/notifications", label: "消息通知", icon: Bell, secondary: true },
  { href: "/settings", label: "设置", icon: Settings, secondary: true },
  { href: "/help", label: "帮助中心", icon: HelpCircle, secondary: true },
];

/** 底部导航 / 桌面顶栏用的主入口 */
export const primaryNav = allNavItems.filter((item) => !item.secondary);

/** 「更多」菜单用的次级入口 */
export const secondaryNav = allNavItems.filter((item) => item.secondary);

/**
 * 当前路径是否命中某个导航项。
 *
 * 用 startsWith 而不是全等，是为了让 `/reader?articleId=x` 之类
 * 带查询串的情况也算命中——next/link 的 href 不含查询串，
 * 但点击后 usePathname() 也不含，所以这里主要是为了
 * `/subscriptions/123` 这种子路径。
 */
export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
