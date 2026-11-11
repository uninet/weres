"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Rss, ArrowLeft, Mail, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  // 服务端能不能真的发信：决定结果页说的是「去收邮件」还是「找部署者」
  const [unavailable, setUnavailable] = useState(false);
  const [serverMessage, setServerMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error("请输入邮箱地址");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        // 503 = 服务端没配邮件通道。这种情况结果页要换成
        // 「请找部署者」的说明，而不是「去收邮件」。
        setUnavailable(true);
        setServerMessage(data?.message || "服务端暂时无法发送邮件");
        setIsSubmitted(true);
        return;
      }

      setUnavailable(false);
      setIsSubmitted(true);
    } catch (error) {
      console.error("找回密码失败:", error);
      toast.error("操作失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
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
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
              <CardTitle className="text-xl">忘记密码</CardTitle>
            </div>
            <CardDescription>
              输入注册邮箱，我们会发一封带重置链接的邮件
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isSubmitted ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">邮箱地址</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      发送中...
                    </>
                  ) : (
                    "发送重置链接"
                  )}
                </Button>

                <div className="text-center text-sm text-gray-500">
                  <p>想起密码了？</p>
                  <Link
                    href="/login"
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    返回登录
                  </Link>
                </div>
              </form>
            ) : unavailable ? (
              <div className="text-center py-6">
                {/* 这不是一次成功，而是「此路不通，请走另一条」：
                    绿色对勾会让人误以为邮件已经在路上 */}
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Info className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  服务端暂时无法发送邮件
                </h3>
                <p className="text-gray-500 mb-6 text-sm">
                  {serverMessage ||
                    "这个部署没有配置邮件通道，重置链接发不出去。"}
                </p>
                <div className="text-left text-sm text-gray-600 bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
                  <p className="font-medium text-gray-900">你可以这样恢复访问：</p>
                  <p>
                    1. 如果你是部署者：在 <code className="rounded bg-white px-1">.env</code>
                    里填好 SMTP_HOST / SMTP_USER / SMTP_PASSWORD 后重启服务，
                    重置邮件就会走 Kindle 推送那条通道发出去。
                  </p>
                  <p>
                    2. 如果你只是使用者：联系部署这个站点的人，或在数据库里
                    直接重置你的密码哈希。
                  </p>
                </div>
                <div className="space-y-3">
                  <Link href="/register">
                    <Button variant="outline" className="w-full">
                      注册新账号
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button variant="ghost" className="w-full">
                      返回登录
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Mail className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  请查收邮件
                </h3>
                <p className="text-gray-500 mb-4 text-sm">
                  如果 <strong>{email}</strong> 已经注册，重置链接会在一分钟内送达。
                </p>
                <p className="text-xs text-gray-400 mb-6 leading-relaxed">
                  没收到？先看垃圾邮件目录。链接 1 小时内有效，只能使用一次。
                  <br />
                  出于安全考虑，我们不会告诉你这个邮箱是否已注册。
                </p>
                <div className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setIsSubmitted(false);
                      setUnavailable(false);
                    }}
                  >
                    换个邮箱重试
                  </Button>
                  <Link href="/login">
                    <Button variant="ghost" className="w-full">
                      返回登录
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-gray-500 mt-8">
          遇到问题？{" "}
          <Link href="/help" className="text-blue-600 hover:text-blue-700">
            联系客服
          </Link>
        </p>
      </div>
    </div>
  );
}
