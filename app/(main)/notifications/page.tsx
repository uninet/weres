"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Bell,
  Rss,
  Shield,
  Info,
  Trash2,
  Check,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: "FEED_UPDATE" | "SYSTEM" | "SECURITY";
  title: string;
  content: string | null;
  /**
   * 通知附带的额外跳转信息。
   *
   * 服务端返回的是 JSON 列，形状由各通知类型自行约定，
   * 这里只声明本项目实际会读的字段，而不是 any ——
   * 用 any 的话 `n.data.feedUrl` 拼错也不会报错，只会静默跳转失败。
   */
  data: {
    feedId?: string;
    feedName?: string;
    articleId?: string;
    url?: string;
  } | null;
  isRead: boolean;
  createdAt: string;
}

const typeConfig = {
  FEED_UPDATE: {
    icon: Rss,
    label: "订阅更新",
    color: "bg-blue-100 text-blue-700",
  },
  SYSTEM: {
    icon: Info,
    label: "系统通知",
    color: "bg-gray-100 text-gray-700",
  },
  SECURITY: {
    icon: Shield,
    label: "安全提醒",
    color: "bg-red-100 text-red-700",
  },
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1,
  });

  // 加载通知列表
  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        unreadOnly: activeTab === "unread" ? "true" : "false",
      });

      const response = await fetch(`/api/notifications?${params}`);
      if (!response.ok) throw new Error("加载失败");

      const data = await response.json();
      setNotifications(data.notifications);
      setPagination(data.pagination);
      setUnreadCount(data.unreadCount);
    } catch (error) {
      toast.error("加载通知列表失败");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [pagination.page, activeTab]);

  // 标记已读
  const handleMarkRead = async (ids: string[]) => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) throw new Error("操作失败");

      setNotifications(
        notifications.map((n) =>
          ids.includes(n.id) ? { ...n, isRead: true } : n
        )
      );
      setUnreadCount(Math.max(0, unreadCount - ids.length));
      setSelectedIds(selectedIds.filter((id) => !ids.includes(id)));
      toast.success(`已标记 ${ids.length} 条通知为已读`);
    } catch (error) {
      toast.error("操作失败");
    }
  };

  // 标记所有已读
  const handleMarkAllRead = async () => {
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });

      if (!response.ok) throw new Error("操作失败");

      setNotifications(notifications.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      setSelectedIds([]);
      toast.success("已标记所有通知为已读");
    } catch (error) {
      toast.error("操作失败");
    }
  };

  // 删除通知
  const handleDelete = async (ids: string[]) => {
    try {
      const response = await fetch(`/api/notifications?ids=${ids.join(",")}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("删除失败");

      const deletedNotifications = notifications.filter((n) =>
        ids.includes(n.id)
      );
      const deletedUnreadCount = deletedNotifications.filter(
        (n) => !n.isRead
      ).length;

      setNotifications(notifications.filter((n) => !ids.includes(n.id)));
      setUnreadCount(Math.max(0, unreadCount - deletedUnreadCount));
      setSelectedIds(selectedIds.filter((id) => !ids.includes(id)));
      toast.success(`已删除 ${ids.length} 条通知`);
    } catch (error) {
      toast.error("删除失败");
    }
  };

  // 清空所有通知
  const handleClearAll = async () => {
    try {
      const response = await fetch("/api/notifications?all=true", {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("清空失败");

      setNotifications([]);
      setUnreadCount(0);
      setSelectedIds([]);
      toast.success("已清空所有通知");
    } catch (error) {
      toast.error("清空失败");
    }
  };

  // 全选/取消全选
  const handleSelectAll = () => {
    if (selectedIds.length === notifications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(notifications.map((n) => n.id));
    }
  };

  // 选择/取消选择
  const handleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((i) => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;

    return date.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 处理通知点击
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      handleMarkRead([notification.id]);
    }

    // 根据通知类型处理跳转
    if (notification.type === "FEED_UPDATE" && notification.data?.articleId) {
      router.push(`/reader?article=${notification.data.articleId}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Bell className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">消息中心</h1>
                <p className="text-sm text-gray-500">
                  {unreadCount > 0
                    ? `你有 ${unreadCount} 条未读通知`
                    : "暂无未读通知"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
                  <Check className="w-4 h-4 mr-1" />
                  全部已读
                </Button>
              )}
              {notifications.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Trash2 className="w-4 h-4 mr-1" />
                      清空
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认清空所有通知？</AlertDialogTitle>
                      <AlertDialogDescription>
                        此操作将删除所有通知记录，无法恢复。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClearAll}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        确认清空
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
              <TabsTrigger
                value="all"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:bg-transparent"
              >
                全部通知
              </TabsTrigger>
              <TabsTrigger
                value="unread"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-purple-500 data-[state=active]:bg-transparent"
              >
                未读通知
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {unreadCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {activeTab === "unread" ? "暂无未读通知" : "暂无通知"}
            </h3>
            <p className="text-gray-500">
              {activeTab === "unread"
                ? "所有通知都已阅读"
                : "当有新的订阅更新或系统消息时，会显示在这里"}
            </p>
          </div>
        ) : (
          <>
            {/* Select All */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={
                    notifications.length > 0 &&
                    selectedIds.length === notifications.length
                  }
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-gray-600">
                  全选 ({selectedIds.length}/{notifications.length})
                </span>
              </div>
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleMarkRead(selectedIds)}
                  >
                    <Check className="w-4 h-4 mr-1" />
                    标记已读
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(selectedIds)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    删除
                  </Button>
                </div>
              )}
            </div>

            {/* Notifications List */}
            <div className="space-y-3">
              {notifications.map((notification) => {
                const config = typeConfig[notification.type];
                const Icon = config.icon;

                return (
                  <Card
                    key={notification.id}
                    className={cn(
                      "p-4 hover:shadow-md transition-shadow cursor-pointer",
                      !notification.isRead && "bg-purple-50/50"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex items-start gap-4">
                      <Checkbox
                        checked={selectedIds.includes(notification.id)}
                        onCheckedChange={() => handleSelect(notification.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                          config.color
                        )}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3
                              className={cn(
                                "font-medium text-gray-900",
                                !notification.isRead && "font-semibold"
                              )}
                            >
                              {notification.title}
                            </h3>
                            {notification.content && (
                              <p className="text-sm text-gray-500 mt-1">
                                {notification.content}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-gray-400">
                              {formatDate(notification.createdAt)}
                            </span>
                            {!notification.isRead && (
                              <span className="w-2 h-2 rounded-full bg-purple-500" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <Badge variant="secondary" className="text-xs">
                            {config.label}
                          </Badge>
                          {notification.type === "FEED_UPDATE" &&
                            notification.data?.feedName && (
                              <Badge variant="outline" className="text-xs">
                                {notification.data.feedName}
                              </Badge>
                            )}
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPagination({ ...pagination, page: pagination.page - 1 })
                  }
                  disabled={pagination.page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-600">
                  第 {pagination.page} / {pagination.totalPages} 页
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPagination({ ...pagination, page: pagination.page + 1 })
                  }
                  disabled={pagination.page === pagination.totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
