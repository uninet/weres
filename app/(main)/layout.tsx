import { AuthGuard } from "@/components/auth-guard";

/**
 * 主布局 - 包含认证守卫
 * 保护需要登录才能访问的页面
 * 支持游客模式访问特定页面
 */
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGuard>
      {children}
    </AuthGuard>
  );
}
