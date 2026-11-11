"use client";

import Link from "next/link";
import { Rss } from "lucide-react";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4 py-8">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <Rss className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">WeRSS</span>
          </Link>
          <p className="mt-2 text-muted-foreground">创建新账号</p>
        </div>

        {/* Form */}
        <div className="bg-card p-8 rounded-xl border shadow-sm">
          <RegisterForm />

          <div className="mt-6 text-center text-sm">
            已有账号？{" "}
            <Link href="/login" className="text-primary hover:underline">
              立即登录
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
