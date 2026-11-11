"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

// 需要登录才能访问的路由
const PROTECTED_ROUTES = [
  "/profile",
  "/settings",
  "/subscriptions",
  "/favorites",
  "/history",
  "/notifications",
];

// 允许游客访问的路由
const GUEST_ALLOWED_ROUTES = [
  "/",
  "/market",
  "/reader",
  "/help",
];

interface AuthGuardProps {
  children: React.ReactNode;
}

/**
 * 认证守卫组件
 * 用于保护需要登录才能访问的页面
 * 支持游客模式访问特定页面
 * 
 * 注意：认证通过 HttpOnly Cookie 实现，不依赖 localStorage
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // 调用 /api/auth/me 验证登录状态
        // 这个 API 会检查 HttpOnly Cookie 中的 token
        const response = await fetch("/api/auth/me");

        if (response.ok) {
          // 用户已登录
          setIsAuthenticated(true);
          setIsLoading(false);
          return;
        }

        // 未登录状态
        setIsAuthenticated(false);

        // 检查当前页面是否需要保护
        const isProtectedRoute = PROTECTED_ROUTES.some(route => 
          pathname === route || pathname.startsWith(`${route}/`)
        );

        const isGuestAllowed = GUEST_ALLOWED_ROUTES.some(route => 
          pathname === route || pathname.startsWith(`${route}/`)
        );

        if (isProtectedRoute) {
          // 需要登录的页面，重定向到登录页
          const returnUrl = encodeURIComponent(pathname);
          router.replace(`/login?returnUrl=${returnUrl}`);
        } else if (!isGuestAllowed && pathname !== "/login" && pathname !== "/register") {
          // 不在允许列表中的页面，也重定向到登录页
          router.replace("/login");
        } else {
          // 游客可以访问的页面
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Auth check error:", error);
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * 检查当前路径是否需要登录
 */
export function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTES.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
}

/**
 * 检查当前路径是否允许游客访问
 */
export function isGuestAllowedRoute(pathname: string): boolean {
  return GUEST_ALLOWED_ROUTES.some(route => 
    pathname === route || pathname.startsWith(`${route}/`)
  );
}
