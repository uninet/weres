"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Rss, CheckCircle2, Info, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

/**
 * 重置密码页。
 *
 * 从邮件链接进来，URL 带 ?token=xxx。
 * 三种状态必须分开：还没提交 / 成功 / 链接无效。
 * 把「无效」也画成成功的样子是这类页面最常见的错误 ——
 * 用户以为改好了，下次登录才发现没改。
 */
function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);

  // 没有 token 就别浪费时间让用户填密码
  const missingToken = !token;

  useEffect(() => {
    if (done) {
      const timer = setTimeout(() => router.push("/login"), 2500);
      return () => clearTimeout(timer);
    }
  }, [done, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (password !== confirm) {
      toast.error("两次输入的密码不一致");
      return;
    }
    if (password.length < 8) {
      toast.error("密码至少 8 位");
      return;
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      toast.error("密码需同时包含字母和数字");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(data?.message || "重置失败，请重新申请");
        return;
      }

      setDone(true);
      toast.success("密码已重置");
    } catch (error) {
      console.error("重置密码失败:", error);
      toast.error("网络错误，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Rss className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              WeRSS
            </span>
          </Link>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">设置新密码</CardTitle>
            <CardDescription>
              {missingToken
                ? "这个链接缺少重置令牌"
                : "输入新密码后，旧密码立即失效"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {missingToken ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Info className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  链接不完整
                </h3>
                <p className="text-gray-500 text-sm mb-6 leading-relaxed">
                  请从邮件里直接点击重置链接进入本页。如果你是从别处复制
                  的地址，可能漏掉了 <code className="rounded bg-gray-100 px-1">?token=</code> 部分。
                </p>
                <Link href="/forgot-password">
                  <Button className="w-full">重新申请重置链接</Button>
                </Link>
              </div>
            ) : done ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  密码已更新
                </h3>
                <p className="text-gray-500 text-sm mb-6">
                  正在跳转到登录页，也可以用新密码手动登录。
                </p>
                <Link href="/login">
                  <Button className="w-full">去登录</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">新密码</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="至少 8 位，含字母和数字"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm">确认新密码</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="confirm"
                      type="password"
                      placeholder="再输入一次"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      className="pl-10"
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    "确认修改"
                  )}
                </Button>

                <div className="text-center text-sm text-gray-500">
                  <Link
                    href="/login"
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    返回登录
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * 外层包一层 Suspense 的原因：
 * useSearchParams() 在构建期无法得知查询串，Next 要求读取它的组件
 * 必须有 Suspense 边界，否则 `next build` 会在预渲染这一步直接失败
 * （报 "Export encountered errors on following paths"）。
 */
export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
