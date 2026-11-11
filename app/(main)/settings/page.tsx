"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KindleSettings } from "@/components/kindle-settings";
import { usePreferences } from "@/hooks/use-preferences";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Settings, 
  ChevronLeft, 
  Bell, 
  Moon, 
  Type, 
  Globe, 
  Shield, 
  Trash2,
  User,
  Rss,
  Download,
  Upload,
  LogOut,
  BookOpen,
} from "lucide-react";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // 设置项存在 localStorage，阅读器那边用同一个 hook 读，
  // 拨动开关之后行为立刻改变 —— 之前这里是纯局部 state，
  // 开关拨了刷新就没了，而且没有任何代码读它。
  const { preferences: settings, update: updatePreference, toggle: handleToggle } =
    usePreferences();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDarkModeToggle = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    toast.success(`已${newTheme === "dark" ? "启用" : "关闭"}深色模式`);
  };

  /**
   * 导出订阅为 OPML。
   *
   * 改动前这里是假的：等 1.5 秒、写一个全是空数组的 JSON 文件下来，
   * 用户下载到的东西没有任何内容。现在真的去请求 /api/opml，
   * 由服务端按当前用户的分组结构生成标准 OPML 2.0。
   */
  const handleExportData = async () => {
    try {
      const res = await fetch("/api/opml");
      if (!res.ok) {
        toast.error("导出失败，请稍后重试");
        return;
      }
      const text = await res.text();
      const blob = new Blob([text], { type: "text/x-opml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `werss-subscriptions-${new Date().toISOString().split("T")[0]}.opml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("订阅已导出为 OPML");
    } catch (error) {
      console.error("Export OPML error:", error);
      toast.error("导出失败，请重试");
    }
  };

  /**
   * 从 OPML 导入订阅。
   *
   * 用隐藏的 file input 触发系统选文件，读出文本后 POST 给
   * /api/opml/import。服务端逐个解析、去重、落到「导入」分组，
   * 返回成功/失败条数。
   */
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportOpml = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 清空 value，否则选同一个文件第二次不会触发 change
    e.target.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const res = await fetch("/api/opml/import", {
        method: "POST",
        headers: { "Content-Type": "application/xml" },
        body: text,
      });
      const data = await res.json();

      if (data.success) {
        toast.success(data.message || "导入完成");
      } else {
        toast.error(data.message || "导入失败");
      }
    } catch (error) {
      console.error("Import OPML error:", error);
      toast.error("导入失败，请检查文件格式");
    }
  };

  /**
   * 退出登录
   *
   * 登录 Cookie 是 HttpOnly，前端删不掉，必须调用服务端接口清 Cookie。
   * 之前这个按钮没有 onClick，点了没反应 —— 用户以为已退出，
   * 实际 Cookie 还在，在公用电脑上这是实打实的安全问题。
   */
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // 无论接口成功与否都回登录页：即使网络失败，
      // 留在需要登录的页面也没有意义
      window.location.href = "/login";
    }
  };

  const handleClearCache = async () => {
    try {
      toast.loading("正在清除缓存...");
      if (typeof window !== "undefined") {
        localStorage.removeItem("werss-cache");
        localStorage.removeItem("articles-cache");
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
      toast.success("缓存已清除");
    } catch (error) {
      console.error("Clear cache error:", error);
      toast.error("清除缓存失败");
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-gray-900">
      {/* Header */}
      <header className="h-14 border-b bg-white dark:bg-gray-800 flex items-center px-4 sticky top-0 z-10">
        <Button variant="ghost" size="icon" className="mr-3" asChild>
          <Link href="/reader">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="font-semibold text-lg">设置</h1>
      </header>

      <ScrollArea className="h-[calc(100vh-56px)]">
        <div className="max-w-2xl mx-auto p-6 space-y-6">
          {/* Appearance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Moon className="h-5 w-5 text-purple-500" />
                外观设置
              </CardTitle>
              <CardDescription>自定义阅读器的外观和显示方式</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>深色模式</Label>
                  <p className="text-sm text-gray-500">使用深色主题保护眼睛</p>
                </div>
                {mounted && (
                  <Switch 
                    checked={theme === "dark"} 
                    onCheckedChange={handleDarkModeToggle}
                  />
                )}
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>紧凑视图</Label>
                  <p className="text-sm text-gray-500">减小文章列表的间距</p>
                </div>
                <Switch 
                  checked={settings.compactView} 
                  onCheckedChange={() => handleToggle('compactView')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Reading */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5 text-blue-500" />
                阅读设置
              </CardTitle>
              <CardDescription>配置阅读体验和交互方式</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>自动标记已读</Label>
                  <p className="text-sm text-gray-500">打开文章时自动标记为已读</p>
                </div>
                <Switch 
                  checked={settings.autoMarkRead} 
                  onCheckedChange={() => handleToggle('autoMarkRead')}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>显示未读徽章</Label>
                  <p className="text-sm text-gray-500">在导航栏显示未读数量</p>
                </div>
                <Switch 
                  checked={settings.showUnreadBadge} 
                  onCheckedChange={() => handleToggle('showUnreadBadge')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Sync */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Rss className="h-5 w-5 text-green-500" />
                同步设置
              </CardTitle>
              <CardDescription>配置RSS源的自动同步</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>自动同步</Label>
                  <p className="text-sm text-gray-500">自动检查新文章</p>
                </div>
                <Switch 
                  checked={settings.autoSync} 
                  onCheckedChange={() => handleToggle('autoSync')}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>同步间隔</Label>
                  <p className="text-sm text-gray-500">每 {settings.syncInterval} 分钟检查一次</p>
                </div>
                <select
                  className="rounded-md border border-gray-200 dark:border-gray-700 bg-transparent px-2 py-1 text-sm disabled:opacity-50"
                  value={settings.syncInterval}
                  disabled={!settings.autoSync}
                  onChange={(event) =>
                    updatePreference("syncInterval", Number(event.target.value))
                  }
                >
                  {[15, 30, 60, 120, 360].map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} 分钟
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Kindle 推送 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-orange-500" />
                Kindle 推送
              </CardTitle>
              <CardDescription>
                把文章作为电子书推送到你的 Kindle
              </CardDescription>
            </CardHeader>
            <CardContent>
              <KindleSettings />
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-yellow-500" />
                通知设置
              </CardTitle>
              <CardDescription>管理应用通知和提醒</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>启用通知</Label>
                  <p className="text-sm text-gray-500">接收新文章提醒</p>
                </div>
                <Switch 
                  checked={settings.notifications} 
                  onCheckedChange={() => handleToggle('notifications')}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>邮件摘要</Label>
                  <p className="text-sm text-gray-500">每日发送文章摘要邮件</p>
                </div>
                <Switch 
                  checked={settings.emailDigest} 
                  onCheckedChange={() => handleToggle('emailDigest')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Data */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5 text-indigo-500" />
                数据管理
              </CardTitle>
              <CardDescription>导出或清理您的数据</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>导出订阅</Label>
                  <p className="text-sm text-gray-500">
                    下载为 OPML，可导入到其它 RSS 阅读器
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleExportData}>
                  <Download className="h-4 w-4 mr-2" />
                  导出
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>导入订阅</Label>
                  <p className="text-sm text-gray-500">
                    从其它阅读器导出的 OPML 文件批量导入
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  导入
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".opml,.xml,text/xml,application/xml"
                  className="hidden"
                  onChange={handleImportOpml}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-red-600">清除缓存</Label>
                  <p className="text-sm text-gray-500">清除本地存储的文章缓存</p>
                </div>
                <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50" onClick={handleClearCache}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  清除
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-gray-500" />
                账户
              </CardTitle>
              <CardDescription>管理您的账户信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>个人资料</Label>
                  <p className="text-sm text-gray-500">修改昵称、头像等信息</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/profile">
                    管理
                  </Link>
                </Button>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-red-600">退出登录</Label>
                  <p className="text-sm text-gray-500">退出当前账户</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:bg-red-50"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  退出
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* About */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-cyan-500" />
                关于
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Rss className="h-8 w-8 text-white" />
                </div>
                <h3 className="font-bold text-lg">WeRSS</h3>
                <p className="text-sm text-gray-500 mt-1">版本 1.0.0</p>
                <p className="text-sm text-gray-400 mt-2">简洁优雅的 RSS 阅读器</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}
