"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  User,
  Mail,
  Heart,
  History,
  Bell,
  Settings,
  HelpCircle,
  LogOut,
  KeyRound,
  Trash2,
  Loader2,
  ChevronRight,
  Layers,
  RefreshCw,
  Camera,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ProfileData {
  id: string;
  email: string | null;
  phone: string | null;
  nickname: string | null;
  avatar: string | null;
  bio: string | null;
  kindleEmail: string | null;
  notifyNewArticles: boolean;
  emailDigest: boolean;
  createdAt: string;
  isGuest: boolean;
  _count: {
    subscriptions: number;
    favorites: number;
    readHistories: number;
  };
}

/**
 * 个人中心。
 *
 * 改造前这个页面有 536 行，但**没有一行是真的**：
 * 昵称写死「用户名」、邮箱写死 user@example.com、手机号写死
 * 138****8000、简介写死「热爱阅读，关注科技」，四个 tab 里
 * 的通知/显示开关拨了刷新就还原，四个按钮全部只弹一句
 * 「xxx功能开发中」。
 *
 * 一个全是假数据的面板比没有这个页面更糟：用户会以为自己改过了。
 *
 * 现在的结构按「用得多不多」重排：
 *   第一屏（2 步内可达）：头像昵称简介（就地编辑保存）、
 *     三个统计数字（点击直达收藏/历史/订阅）、以及最常用的
 *     四个跳转（收藏/历史/通知/设置）。
 *   收起来的低频功能：改密码、注销账号、通知偏好 —— 前者在
 *     「账号安全」抽屉里，后者在卡片底部，都不是每天要碰的。
 */
export default function ProfilePage() {
  const router = useRouter();

  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 就地编辑：点「编辑」才进入输入态，避免整页永远是输入框
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");

  // 账号安全抽屉
  const [securityOpen, setSecurityOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // 注销
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      const payload = await res.json();
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || "加载失败");
      }
      setData(payload.data);
      setNickname(payload.data.nickname ?? "");
      setBio(payload.data.bio ?? "");
    } catch (error) {
      console.error("Load profile error:", error);
      toast.error("加载个人资料失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  /**
   * 保存资料。
   *
   * 只 PATCH 真正改动过的字段：接口在「没有任何字段」时返回 400，
   * 每次都把所有字段传一遍虽然也能过，但会让「没改东西也点了保存」
   * 变成一个看似成功、实际什么都没发生的操作。
   */
  const handleSaveProfile = async () => {
    if (!data) return;
    const trimmedNickname = nickname.trim();
    const trimmedBio = bio.trim();

    if (trimmedNickname && trimmedNickname.length > 30) {
      toast.error("昵称最多 30 个字");
      return;
    }
    if (trimmedBio.length > 200) {
      toast.error("简介最多 200 个字");
      return;
    }

    const patch: Record<string, string> = {};
    if (trimmedNickname !== (data.nickname ?? "")) patch.nickname = trimmedNickname;
    if (trimmedBio !== (data.bio ?? "")) patch.bio = trimmedBio;

    if (Object.keys(patch).length === 0) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || "保存失败");
      }
      setData((prev) => (prev ? { ...prev, ...payload.data } : prev));
      setEditing(false);
      toast.success("已保存");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  /**
   * 拨动服务端通知开关。
   *
   * 乐观更新 + 失败回滚：这两个开关的读取方是服务端的同步任务，
   * 存在 localStorage 里没有意义（服务端读不到浏览器）。
   */
  const toggleServerPreference = async (
    key: "notifyNewArticles" | "emailDigest",
    value: boolean
  ) => {
    if (!data) return;
    const previous = data[key];
    setData({ ...data, [key]: value });

    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: value }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || "保存失败");
      }
    } catch (error) {
      setData((prev) => (prev ? { ...prev, [key]: previous } : prev));
      toast.error(error instanceof Error ? error.message : "保存失败");
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("两次输入的新密码不一致");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("新密码不能与当前密码相同");
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || "修改失败");
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSecurityOpen(false);
      toast.success("密码已修改，请用新密码重新登录");
      // 密码换了，当前 token 还能用，但主动退出更符合直觉
      setTimeout(() => {
        window.location.href = "/login";
      }, 1200);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "修改失败");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      toast.error("请输入密码");
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch("/api/profile/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword, confirm: "DELETE" }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || "注销失败");
      }
      toast.success("账号已注销");
      setTimeout(() => {
        window.location.href = "/login";
      }, 800);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "注销失败");
      setDeleting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      window.location.href = "/login";
    }
  };

  if (loading) {
    return (
      <PageShell title="我的" icon={User} backHref={null}>
        <div className="mx-auto max-w-2xl space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 w-16 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      </PageShell>
    );
  }

  if (!data) {
    return (
      <PageShell title="我的" icon={User} backHref={null}>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">无法加载个人资料</p>
          <Button variant="outline" size="sm" onClick={loadProfile}>
            <RefreshCw className="mr-1.5 h-4 w-4" />
            重试
          </Button>
        </div>
      </PageShell>
    );
  }

  const displayName = data.nickname?.trim() || data.email?.split("@")[0] || "读者";
  const initial = displayName.slice(0, 1).toUpperCase();
  const joinedAt = new Date(data.createdAt).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
  });

  return (
    <PageShell
      title="我的"
      subtitle={displayName}
      icon={User}
      iconClassName="bg-[#c9a962]/15 text-[#a8894a] dark:bg-[#c9a962]/20 dark:text-[#d9bd82]"
      backHref={null}
    >
      <div className="mx-auto max-w-2xl space-y-3">
      {/* ---------------- 第一屏：我是谁 + 数据概览 ---------------- */}
      <Card className="overflow-hidden">
        <div className="flex items-start gap-3.5 p-4">
          {/* 头像：有则显示，没有就用首字母。
              不再往外请求 dicebear —— 那是一个第三方 SVG 服务，
              它挂掉时头像会变成灰块，而首字母兜底零依赖。 */}
          <div className="relative shrink-0">
            {data.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.avatar}
                alt={displayName}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#c9a962]/15 text-xl font-semibold text-[#a8894a]">
                {initial}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {editing ? (
              <div className="space-y-2">
                <Input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="昵称"
                  maxLength={30}
                  className="h-8 text-sm"
                  autoFocus
                />
                <Input
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="一句话介绍自己（选填）"
                  maxLength={200}
                  className="h-8 text-sm"
                />
              </div>
            ) : (
              <>
                <h2 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">
                  {displayName}
                </h2>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-gray-500 dark:text-gray-400">
                  <Mail className="h-3 w-3 shrink-0" />
                  {data.email || data.phone || "未绑定邮箱"}
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
                  {data.bio || "还没有写简介"}
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-black/[0.06] px-4 py-2.5 dark:border-white/[0.08]">
          {editing ? (
            <div className="flex w-full items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setNickname(data.nickname ?? "");
                  setBio(data.bio ?? "");
                }}
                disabled={saving}
              >
                取消
              </Button>
              <Button size="sm" onClick={handleSaveProfile} disabled={saving}>
                {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                保存
              </Button>
            </div>
          ) : (
            <>
              <span className="text-[11px] text-gray-400">加入于 {joinedAt}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setEditing(true)}
              >
                <Camera className="mr-1 h-3.5 w-3.5" />
                编辑资料
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* ---------------- 数据概览：三个数字都能点进去 ---------------- */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile
          href="/subscriptions"
          icon={Layers}
          value={data._count.subscriptions}
          label="订阅源"
        />
        <StatTile
          href="/favorites"
          icon={Heart}
          value={data._count.favorites}
          label="收藏"
        />
        <StatTile
          href="/history"
          icon={History}
          value={data._count.readHistories}
          label="已读"
        />
      </div>

      {/* ---------------- 常用入口：这里就是「2 步内抵达」 ---------------- */}
      <Card className="divide-y divide-black/[0.06] overflow-hidden dark:divide-white/[0.08]">
        <RowLink href="/favorites" icon={Heart} label="我的收藏" hint="留住想再读的" />
        <RowLink href="/history" icon={History} label="阅读历史" hint="最近读过的" />
        <RowLink href="/notifications" icon={Bell} label="消息通知" hint="新文章提醒" />
        <RowLink href="/settings" icon={Settings} label="偏好设置" hint="外观与阅读" />
      </Card>

      {/* ---------------- 通知偏好（低频，放在下面） ---------------- */}
      <Card className="overflow-hidden">
        <div className="px-4 pb-1 pt-3">
          <h3 className="text-[13px] font-medium text-gray-700 dark:text-gray-200">
            通知偏好
          </h3>
          <p className="mt-0.5 text-[11px] text-gray-400">
            由服务端定时任务使用，换设备也生效
          </p>
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <div className="pr-4">
            <p className="text-sm text-gray-800 dark:text-gray-100">新文章提醒</p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              有新文章时写入站内通知
            </p>
          </div>
          <Switch
            checked={data.notifyNewArticles}
            onCheckedChange={(v) => toggleServerPreference("notifyNewArticles", v)}
          />
        </div>

        <Separator />

        <div className="flex items-center justify-between px-4 py-3">
          <div className="pr-4">
            <p className="text-sm text-gray-800 dark:text-gray-100">每日摘要邮件</p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              需要服务端配置 SMTP 才会真正发送
            </p>
          </div>
          <Switch
            checked={data.emailDigest}
            onCheckedChange={(v) => toggleServerPreference("emailDigest", v)}
          />
        </div>
      </Card>

      {/* ---------------- 低频区：账号安全 / 帮助 / 退出 ---------------- */}
      <Card className="divide-y divide-black/[0.06] overflow-hidden dark:divide-white/[0.08]">
        <button
          type="button"
          onClick={() => setSecurityOpen(true)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
        >
          <KeyRound className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="flex-1 text-sm text-gray-800 dark:text-gray-100">
            账号安全
          </span>
          <ChevronRight className="h-4 w-4 text-gray-300" />
        </button>

        <RowLink href="/help" icon={HelpCircle} label="帮助中心" hint="常见问题" />

        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
        >
          <LogOut className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="flex-1 text-sm text-gray-800 dark:text-gray-100">退出登录</span>
        </button>
      </Card>

      <p className="pt-1 text-center text-[11px] text-gray-400">
        WeRSS · 自托管 RSS 阅读器
      </p>

      {/* ================= 账号安全抽屉 ================= */}
      <Sheet open={securityOpen} onOpenChange={setSecurityOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>账号安全</SheetTitle>
            <SheetDescription>修改密码后需要重新登录</SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current-password">当前密码</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="输入现在的密码"
                autoComplete="current-password"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="new-password">新密码</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="至少 8 位，含字母和数字"
                autoComplete="new-password"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">确认新密码</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再输一次"
                autoComplete="new-password"
              />
            </div>

            <Button
              className="w-full"
              onClick={handleChangePassword}
              disabled={
                changingPassword || !currentPassword || !newPassword || !confirmPassword
              }
            >
              {changingPassword && (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              )}
              修改密码
            </Button>

            <div className="pt-2">
              <Separator className="mb-4" />
              <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="w-full text-red-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10">
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    注销账号
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认注销账号？</AlertDialogTitle>
                    <AlertDialogDescription>
                      订阅、分组、收藏、阅读历史、通知都会被永久删除，无法恢复。
                      如果只是想换个账号，退出登录即可。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-1.5 py-2">
                    <Label htmlFor="delete-password">输入密码确认</Label>
                    <Input
                      id="delete-password"
                      type="password"
                      value={deletePassword}
                      onChange={(e) => setDeletePassword(e.target.value)}
                      placeholder="当前密码"
                      autoComplete="current-password"
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteAccount();
                      }}
                      disabled={deleting}
                      className="bg-red-500 text-white hover:bg-red-600"
                    >
                      {deleting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                      永久删除
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      </div>
    </PageShell>
  );
}

/** 数字磁贴：整块可点，点击直达对应列表 */
function StatTile({
  href,
  icon: Icon,
  value,
  label,
}: {
  href: string;
  icon: typeof Heart;
  value: number;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-black/[0.06] bg-white px-2 py-3 text-center transition-all hover:border-black/[0.12] hover:shadow-sm active:scale-[0.98] dark:border-white/[0.08] dark:bg-[#1f1f21]"
    >
      <Icon className="mx-auto h-4 w-4 text-[#c9a962]" />
      <p className="mt-1 text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-100">
        {value}
      </p>
      <p className="text-[11px] text-gray-500 dark:text-gray-400">{label}</p>
    </Link>
  );
}

/** 单行跳转：左图标 + 标题 + 副标题 + 右箭头 */
function RowLink({
  href,
  icon: Icon,
  label,
  hint,
}: {
  href: string;
  icon: typeof Heart;
  label: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.04]"
    >
      <Icon className="h-4 w-4 shrink-0 text-gray-400" />
      <span className="flex-1 text-sm text-gray-800 dark:text-gray-100">{label}</span>
      {hint && (
        <span className="text-xs text-gray-400 dark:text-gray-500">{hint}</span>
      )}
      <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
    </Link>
  );
}
