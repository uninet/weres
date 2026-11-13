"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Loader2, User, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { AuthShell } from "@/components/auth-shell";

// 表单验证函数
const validateEmail = (email: string): string => {
  if (!email) return "请输入邮箱地址";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return "请输入有效的邮箱地址";
  return "";
};

const validatePassword = (password: string): string => {
  if (!password) return "请输入密码";
  if (password.length < 6) return "密码至少需要6位";
  return "";
};

/**
 * 演示账号。
 *
 * 这两个值是 `npm run db:seed` 写进去的，别人 clone 下来跑 seed 就有。
 * 抽成常量而不是散在 JSX 里，是为了改的时候只改一处；如果将来想让
 * 部署者自定义，这里改成读 `process.env.NEXT_PUBLIC_DEMO_EMAIL` 即可。
 */
const DEMO_EMAIL = "test@example.com";
const DEMO_PASSWORD = "123456";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/reader";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});

  // 实时验证
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (touched.email) {
      setFieldErrors(prev => ({ ...prev, email: validateEmail(value) }));
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPassword(value);
    if (touched.password) {
      setFieldErrors(prev => ({ ...prev, password: validatePassword(value) }));
    }
  };

  const handleBlur = (field: "email" | "password") => {
    setTouched(prev => ({ ...prev, [field]: true }));
    if (field === "email") {
      setFieldErrors(prev => ({ ...prev, email: validateEmail(email) }));
    } else {
      setFieldErrors(prev => ({ ...prev, password: validatePassword(password) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 提交前验证所有字段
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    setFieldErrors({ email: emailError, password: passwordError });
    setTouched({ email: true, password: true });

    if (emailError || passwordError) {
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "登录失败");
        return;
      }

      // 登录成功 - 显示成功消息并跳转
      toast.success("登录成功！");
      
      // 延迟跳转，确保 cookie 已设置
      setTimeout(() => {
        const decodedUrl = decodeURIComponent(returnUrl);
        // 使用 window.location 进行硬跳转，确保 cookie 被正确携带
        window.location.href = decodedUrl;
      }, 500);
    } catch {
      setError("网络错误，请重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      title="登录"
      subtitle="用邮箱和密码登录，继续你的订阅"
      footer={
        <>
          还没有账号？{" "}
          <Link href="/register" className="font-medium text-[#a8894a] hover:underline dark:text-[#d9bd82]">
            立即注册
          </Link>
        </>
      }
    >
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                邮箱
              </label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={handleEmailChange}
                onBlur={() => handleBlur("email")}
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "email-error" : "email-hint"}
                className={fieldErrors.email ? "border-destructive" : ""}
              />
              {fieldErrors.email ? (
                <p id="email-error" className="text-sm text-destructive">
                  {fieldErrors.email}
                </p>
              ) : (
                <p id="email-hint" className="text-xs text-muted-foreground">
                  请输入您的注册邮箱地址
                </p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                密码
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="输入密码"
                  value={password}
                  onChange={handlePasswordChange}
                  onBlur={() => handleBlur("password")}
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? "password-error" : "password-hint"}
                  className={fieldErrors.password ? "border-destructive pr-10" : "pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "隐藏密码" : "显示密码"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              {fieldErrors.password ? (
                <p id="password-error" className="text-sm text-destructive">
                  {fieldErrors.password}
                </p>
              ) : (
                <p id="password-hint" className="text-xs text-muted-foreground">
                  密码至少6位字符
                </p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-[#a8894a] hover:underline dark:text-[#d9bd82]"
              >
                忘记密码？
              </Link>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  登录中...
                </>
              ) : (
                "登录"
              )}
            </Button>
          </form>

          {/* Guest Mode Entry */}
          <div className="mt-6 rounded-lg border border-black/[0.07] bg-[#faf8f4] p-4 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <div className="flex items-start gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#c9a962]/15">
                <User className="h-3.5 w-3.5 text-[#a8894a] dark:text-[#d9bd82]" />
              </span>
              <div className="flex-1">
                <p className="text-[13px] font-medium text-[#1c1c1e] dark:text-[#f5f5f7]">游客模式</p>
                <p className="mt-1 text-xs leading-relaxed text-[#8a8a8e] dark:text-[#8e8e93]">
                  不想登录？也可以游客身份浏览，但部分功能会受限。
                </p>
                <Link
                  href="/reader"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#a8894a] hover:underline dark:text-[#d9bd82]"
                >
                  以游客身份进入
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* 演示账号：给个一键填入，别让人照着抄一遍再手打 */}
          <div className="mt-4 rounded-lg bg-muted p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">演示账号</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {DEMO_EMAIL} · {DEMO_PASSWORD}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => {
                  setEmail(DEMO_EMAIL);
                  setPassword(DEMO_PASSWORD);
                  setError("");
                  setFieldErrors({});
                }}
              >
                一键填入
              </Button>
            </div>
          </div>

    </AuthShell>
  );
}
