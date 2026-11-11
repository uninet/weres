"use client";

import { Suspense } from "react";
import { LoginForm } from "./login-form";

/**
 * 登录页面
 * 使用 Suspense 包裹以支持 useSearchParams
 */
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <div className="inline-flex items-center gap-2">
              <div className="h-8 w-8 bg-primary rounded-lg" />
              <span className="text-2xl font-bold">WeRSS</span>
            </div>
            <p className="mt-2 text-muted-foreground">登录您的账号</p>
          </div>
          <div className="bg-card p-8 rounded-xl border shadow-sm">
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          </div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
