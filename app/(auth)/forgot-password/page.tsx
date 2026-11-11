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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error("请输入邮箱地址");
      return;
    }

    setIsLoading(true);

    try {
      // 这里原本是一条模拟调用：await 1.5 秒然后弹「重置链接已发送」。
      // 但服务端根本没有重置流程，邮件也发不出去 —— 用户按提示去邮箱等，
      // 永远等不到，还以为是垃圾邮件拦了。与其骗人，不如直接说清楚。
      await new Promise((resolve) => setTimeout(resolve, 400));

      // 不弹「已发送」的红字，而是切到结果页 —— 那里把可行的恢复方式写清楚了。
      // 一个每次都失败的 toast 只会让用户反复重试。
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
              当前版本未接入重置邮件，请按下方说明操作
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
                    "查看重置方式"
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
            ) : (
              <div className="text-center py-6">
                {/* 这里不能用绿色对勾 —— 这不是一次成功，
                    而是「此路不通，请走另一条」 */}
                <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Info className="w-8 h-8 text-amber-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  需要管理员协助
                </h3>
                <p className="text-gray-500 mb-6">
                  当前版本没有接入邮件通道，无法自助重置
                  <strong>{email ? ` ${email} ` : ""}</strong>
                  的密码。
                </p>
                <div className="text-left text-sm text-gray-600 bg-gray-50 rounded-lg p-4 mb-6 space-y-2">
                  <p className="font-medium text-gray-900">你可以这样恢复访问：</p>
                  <p>
                    1. 如果你是部署者：用 <code className="rounded bg-white px-1">npm run db:studio</code>
                    打开数据库，或直接注册一个新账号。
                  </p>
                  <p>
                    2. 如果你只是使用者：联系部署这个站点的人，让他在数据库里
                    重置你的密码哈希。
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
                <p className="text-xs text-gray-400 mt-6">
                  服务端配置 SMTP 后，密码重置邮件可以直接复用这条通道。
                </p>
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
