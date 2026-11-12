import { AuthGuard } from "@/components/auth-guard";
import { BottomNav } from "@/components/bottom-nav";

/**
 * 主布局 - 认证守卫 + 全局底部导航
 *
 * 底部导航挂在这一层而不是根布局：登录/注册等 (auth) 页面
 * 不该有「阅读/市场/收藏」这些入口 —— 用户还没登录，
 * 点进去只会被 AuthGuard 弹回来。
 *
 * 之前它挂在根布局并且在组件内部按 pathname 白名单决定显不显示，
 * 结果是订阅管理/历史/通知/设置四个页面在手机上完全没有导航，
 * 进去就只能按浏览器返回键。
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      {children}
      <BottomNav />
    </AuthGuard>
  );
}
