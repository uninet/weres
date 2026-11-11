"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Rss,
  User,
  Settings,
  Bell,
  Shield,
  History,
  Star,
  LogOut,
  ChevronRight,
  Camera,
  Mail,
  Phone,
  Key,
  Smartphone,
  Globe,
  Moon,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const menuItems = [
  { id: "profile", name: "个人资料", icon: User },
  { id: "account", name: "账号安全", icon: Shield },
  { id: "notifications", name: "消息通知", icon: Bell },
  { id: "display", name: "显示设置", icon: Settings },
];

export default function ProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("profile");

  /**
   * 退出登录
   *
   * 登录 Cookie 是 HttpOnly，前端删不掉，必须调用服务端接口清。
   * 之前这个按钮没有 onClick，点了没反应 —— Cookie 实际仍然有效。
   */
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      window.location.href = "/login";
    }
  };
  const [profile, setProfile] = useState({
    nickname: "用户名",
    email: "user@example.com",
    phone: "138****8000",
    bio: "热爱阅读，关注科技",
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=user",
  });

  const [notifications, setNotifications] = useState({
    feedUpdate: true,
    emailDigest: false,
    securityAlert: true,
  });

  const [display, setDisplay] = useState({
    theme: "light",
    fontSize: "medium",
    language: "zh",
  });

  const handleSaveProfile = () => {
    toast.success("个人资料已保存");
  };

  const handleChangePassword = () => {
    toast.info("密码修改功能开发中");
  };

  const handleChangePhone = () => {
    toast.info("手机号更换功能开发中");
  };

  const handleChangeEmail = () => {
    toast.info("邮箱更换功能开发中");
  };

  const handleDeleteAccount = () => {
    toast.warning("账号注销功能开发中");
  };

  const handleGoToFavorites = () => {
    router.push("/favorites");
  };

  const handleGoToHistory = () => {
    router.push("/history");
  };

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <img
                  src={profile.avatar}
                  alt="Avatar"
                  className="w-24 h-24 rounded-full border-4 border-background shadow-lg"
                />
                <button className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors">
                  <Camera className="h-4 w-4" />
                </button>
              </div>
              <div>
                <h3 className="text-xl font-semibold">{profile.nickname}</h3>
                <p className="text-muted-foreground">{profile.bio}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">昵称</label>
                  <Input
                    value={profile.nickname}
                    onChange={(e) =>
                      setProfile({ ...profile, nickname: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">简介</label>
                  <Input
                    value={profile.bio}
                    onChange={(e) =>
                      setProfile({ ...profile, bio: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    邮箱
                  </label>
                  <div className="flex gap-2">
                    <Input value={profile.email} disabled className="flex-1" />
                    <Button variant="outline" onClick={handleChangeEmail}>修改</Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    手机号
                  </label>
                  <div className="flex gap-2">
                    <Input value={profile.phone} disabled className="flex-1" />
                    <Button variant="outline" onClick={handleChangePhone}>修改</Button>
                  </div>
                </div>
              </div>

              <Button className="w-full" onClick={handleSaveProfile}>保存修改</Button>
            </div>
          </div>
        );

      case "account":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">账号安全</h3>

            <div className="space-y-4">
              <div className="p-4 border rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Key className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">登录密码</p>
                      <p className="text-sm text-muted-foreground">
                        建议定期更换密码以保护账号安全
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={handleChangePassword}>修改</Button>
                </div>

                <div className="p-4 border rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Smartphone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">手机绑定</p>
                      <p className="text-sm text-muted-foreground">
                        已绑定：{profile.phone}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={handleChangePhone}>更换</Button>
                </div>

                <div className="p-4 border rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">邮箱绑定</p>
                      <p className="text-sm text-muted-foreground">
                        已绑定：{profile.email}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={handleChangeEmail}>更换</Button>
                </div>
            </div>

            <div className="pt-6 border-t">
              <h3 className="text-lg font-semibold text-destructive mb-4">
                危险区域
              </h3>
              <div className="p-4 border border-destructive/20 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">注销账号</p>
                    <p className="text-sm text-muted-foreground">
                      注销后所有数据将被永久删除，无法恢复
                    </p>
                  </div>
                  <Button variant="destructive" onClick={handleDeleteAccount}>注销账号</Button>
                </div>
              </div>
            </div>
          </div>
        );

      case "notifications":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">消息通知设置</h3>

            <div className="space-y-4">
              <div className="p-4 border rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-medium">RSS源更新通知</p>
                  <p className="text-sm text-muted-foreground">
                    当订阅的RSS源有新文章时通知我
                  </p>
                </div>
                <button
                  onClick={() =>
                    setNotifications({
                      ...notifications,
                      feedUpdate: !notifications.feedUpdate,
                    })
                  }
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative",
                    notifications.feedUpdate ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                      notifications.feedUpdate ? "left-7" : "left-1"
                    )}
                  />
                </button>
              </div>

              <div className="p-4 border rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-medium">邮件订阅摘要</p>
                  <p className="text-sm text-muted-foreground">
                    每日发送订阅更新摘要到邮箱
                  </p>
                </div>
                <button
                  onClick={() =>
                    setNotifications({
                      ...notifications,
                      emailDigest: !notifications.emailDigest,
                    })
                  }
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative",
                    notifications.emailDigest ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                      notifications.emailDigest ? "left-7" : "left-1"
                    )}
                  />
                </button>
              </div>

              <div className="p-4 border rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-medium">安全提醒</p>
                  <p className="text-sm text-muted-foreground">
                    当账号发生异常登录时通知我
                  </p>
                </div>
                <button
                  onClick={() =>
                    setNotifications({
                      ...notifications,
                      securityAlert: !notifications.securityAlert,
                    })
                  }
                  className={cn(
                    "w-12 h-6 rounded-full transition-colors relative",
                    notifications.securityAlert ? "bg-primary" : "bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-1 w-4 h-4 rounded-full bg-white transition-all",
                      notifications.securityAlert ? "left-7" : "left-1"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
        );

      case "display":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">显示设置</h3>

            <div className="space-y-4">
              <div className="p-4 border rounded-xl">
                <p className="font-medium mb-3">主题</p>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: "light", name: "浅色", icon: "☀️" },
                    { id: "dark", name: "深色", icon: "🌙" },
                    { id: "system", name: "跟随系统", icon: "⚙️" },
                  ].map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() =>
                        setDisplay({ ...display, theme: theme.id })
                      }
                      className={cn(
                        "p-3 rounded-lg border text-center transition-colors",
                        display.theme === theme.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted"
                      )}
                    >
                      <span className="text-2xl">{theme.icon}</span>
                      <p className="text-sm mt-1">{theme.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 border rounded-xl">
                <p className="font-medium mb-3">阅读字体大小</p>
                <div className="flex gap-2">
                  {[
                    { id: "small", name: "小" },
                    { id: "medium", name: "中" },
                    { id: "large", name: "大" },
                    { id: "xlarge", name: "超大" },
                  ].map((size) => (
                    <button
                      key={size.id}
                      onClick={() =>
                        setDisplay({ ...display, fontSize: size.id })
                      }
                      className={cn(
                        "flex-1 py-2 rounded-lg border transition-colors",
                        display.fontSize === size.id
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted"
                      )}
                    >
                      {size.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 border rounded-xl">
                <p className="font-medium mb-3">语言</p>
                <select
                  value={display.language}
                  onChange={(e) =>
                    setDisplay({ ...display, language: e.target.value })
                  }
                  className="w-full p-2 rounded-lg border"
                >
                  <option value="zh">简体中文</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <Rss className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">WeRSS</span>
            </Link>
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/reader">
              <Button variant="ghost" size="sm">
                阅读器
              </Button>
            </Link>
            <Link href="/market">
              <Button variant="ghost" size="sm">
                RSS市场
              </Button>
            </Link>
            <Link href="/subscriptions">
              <Button variant="ghost" size="sm">
                订阅管理
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <div className="container py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <div className="sticky top-24 space-y-6">
              {/* User Info */}
              <div className="flex items-center gap-4 p-4 bg-card rounded-xl border">
                <img
                  src={profile.avatar}
                  alt="Avatar"
                  className="w-12 h-12 rounded-full"
                />
                <div>
                  <p className="font-semibold">{profile.nickname}</p>
                  <p className="text-sm text-muted-foreground">
                    {profile.email}
                  </p>
                </div>
              </div>

              {/* Menu */}
              <nav className="space-y-1">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm transition-colors",
                        activeTab === item.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.name}
                    </button>
                  );
                })}
              </nav>

              {/* Quick Links */}
              <div className="pt-6 border-t space-y-1">
                <button
                  onClick={handleGoToFavorites}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <Star className="h-4 w-4" />
                  我的收藏
                </button>
                <button
                  onClick={handleGoToHistory}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <History className="h-4 w-4" />
                  阅读历史
                </button>
              </div>

              {/* Logout */}
              <div className="pt-6 border-t">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  退出登录
                </button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-card p-6 rounded-xl border">
              {renderContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
