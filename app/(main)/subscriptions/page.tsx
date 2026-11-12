"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";
import { generateInitialIcon } from "@/lib/feed-icon";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Rss,
  Search,
  Folder,
  MoreVertical,
  Plus,
  Settings,
  Trash2,
  Bell,
  BellOff,
  GripVertical,
  X,
  Check,
  FolderPlus,
  Loader2,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Feed {
  id: string;
  title: string;
  icon: string | null;
  url: string;
}

interface Subscription {
  id: string;
  feed: Feed;
  isNotify: boolean;
  unreadCount?: number;
}

interface Group {
  id: string;
  name: string;
}

interface GroupedSubscription {
  group: Group | null;
  subscriptions: Subscription[];
}

export default function SubscriptionsPage() {
  const [groupedSubscriptions, setGroupedSubscriptions] = useState<Record<string, GroupedSubscription>>({});
  const [ungrouped, setUngrouped] = useState<Subscription[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Fetch subscriptions
  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/feeds/subscriptions");
      const data = await response.json();

      if (data.success) {
        setGroupedSubscriptions(data.data.groups || {});
        // Extract ungrouped subscriptions
        if (data.data.groups?.ungrouped) {
          setUngrouped(data.data.groups.ungrouped.subscriptions || []);
        }
      } else {
        toast.error(data.message || "获取订阅失败");
      }
    } catch (error) {
      console.error("Fetch subscriptions error:", error);
      toast.error("获取订阅失败");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;

    try {
      const response = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await response.json();

      if (result.success) {
        toast.success("分组已创建");
        setNewGroupName("");
        setIsAddingGroup(false);
        await fetchSubscriptions();
      } else {
        toast.error(result.message || "创建分组失败");
      }
    } catch (error) {
      console.error("Create group error:", error);
      toast.error("创建分组失败");
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      const response = await fetch(`/api/groups?id=${groupId}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (result.success) {
        // 说清楚订阅去哪了。用户删分组最担心的就是「我的源是不是也没了」。
        toast.success("分组已删除，其中的订阅已移到未分组");
        await fetchSubscriptions();
      } else {
        toast.error(result.message || "删除分组失败");
      }
    } catch (error) {
      console.error("Delete group error:", error);
      toast.error("删除分组失败");
    }
  };

  const handleRenameGroup = async (groupId: string) => {
    const name = editingName.trim();
    if (!name) return;

    try {
      const response = await fetch(`/api/groups?id=${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = await response.json();

      if (result.success) {
        toast.success("分组已重命名");
        setEditingGroup(null);
        setEditingName("");
        await fetchSubscriptions();
      } else {
        toast.error(result.message || "重命名失败");
      }
    } catch (error) {
      console.error("Rename group error:", error);
      toast.error("重命名失败");
    }
  };

  const handleToggleNotify = async (subscriptionId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/feeds/subscriptions/${subscriptionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isNotify: !currentStatus }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(!currentStatus ? "已开启通知" : "已关闭通知");
        fetchSubscriptions();
      } else {
        toast.error(data.message || "更新失败");
      }
    } catch (error) {
      console.error("Toggle notify error:", error);
      toast.error("更新失败");
    }
  };

  const handleUnsubscribe = async (subscriptionId: string) => {
    try {
      const response = await fetch(`/api/feeds/subscriptions/${subscriptionId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (data.success) {
        toast.success("取消订阅成功");
        fetchSubscriptions();
      } else {
        toast.error(data.message || "取消订阅失败");
      }
    } catch (error) {
      console.error("Unsubscribe error:", error);
      toast.error("取消订阅失败");
    }
  };

  // Filter subscriptions based on search query
  const filterSubscriptions = (subscriptions: Subscription[]) => {
    return subscriptions.filter((sub) =>
      sub.feed.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const filteredGroups = Object.entries(groupedSubscriptions)
    .filter(([groupId]) => groupId !== "ungrouped")
    .map(([groupId, data]) => ({
      id: groupId,
      group: data.group,
      subscriptions: filterSubscriptions(data.subscriptions),
    }))
    .filter((g) => g.subscriptions.length > 0);

  const filteredUngrouped = filterSubscriptions(ungrouped);

  const totalFeeds = Object.values(groupedSubscriptions).reduce(
    (acc, group) => acc + group.subscriptions.length,
    0
  );
  const totalUnread = Object.values(groupedSubscriptions).reduce(
    (acc, group) =>
      acc +
      group.subscriptions.reduce(
        (a, sub) => a + (sub.unreadCount || 0),
        0
      ),
    0
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <PageShell
      title="订阅管理"
      subtitle={`${totalFeeds} 个订阅 · ${totalUnread} 篇未读`}
      icon={Layers}
      iconClassName="bg-emerald-50 text-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-400"
      actions={
        <Link href="/market">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1" />
            添加
          </Button>
        </Link>
      }
    >
        <div className="flex gap-8">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <div className="sticky top-4 space-y-6">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索订阅..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Stats */}
              <div className="bg-card p-4 rounded-xl border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">总订阅</span>
                  <span className="font-semibold">{totalFeeds}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">未读</span>
                  <span className="font-semibold text-primary">{totalUnread}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">分组</span>
                  <span className="font-semibold">{filteredGroups.length}</span>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-2">
                <Link href="/market">
                  <Button variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    添加订阅
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsAddingGroup(true)}
                >
                  <FolderPlus className="h-4 w-4 mr-2" />
                  新建分组
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 space-y-8">
            {/* Add Group Form */}
            {isAddingGroup && (
              <div className="bg-card p-4 rounded-xl border flex items-center gap-4">
                <Folder className="h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="分组名称"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
                <Button size="sm" onClick={handleAddGroup}>
                  <Check className="h-4 w-4 mr-1" />
                  确认
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setIsAddingGroup(false);
                    setNewGroupName("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Groups */}
            {filteredGroups.map(({ id: groupId, group, subscriptions }) => (
              <div key={groupId} className="bg-card rounded-xl border">
                {/* Group Header */}
                <div className="p-4 border-b flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Folder className="h-5 w-5 text-primary" />
                    {editingGroup === groupId ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-8 w-40"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          className="h-8 px-2"
                          onClick={() => handleRenameGroup(groupId)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          onClick={() => {
                            setEditingGroup(null);
                            setEditingName("");
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <h3 className="font-semibold">{group?.name || "未命名分组"}</h3>
                        <span className="text-sm text-muted-foreground">
                          {subscriptions.length} 个订阅
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setEditingGroup(groupId);
                        setEditingName(group?.name || "");
                      }}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDeleteGroup(groupId)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Feeds */}
                <div className="divide-y">
                  {subscriptions.map((subscription) => (
                    <div
                      key={subscription.id}
                      className="p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
                    >
                      <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                      <img
                        src={subscription.feed.icon || generateInitialIcon(subscription.feed.title)}
                        alt={subscription.feed.title}
                        className="w-10 h-10 rounded-lg"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{subscription.feed.title}</h4>
                          {subscription.unreadCount && subscription.unreadCount > 0 && (
                            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                              {subscription.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {subscription.feed.url}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleToggleNotify(subscription.id, subscription.isNotify)}
                        >
                          {subscription.isNotify ? (
                            <Bell className="h-4 w-4" />
                          ) : (
                            <BellOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleUnsubscribe(subscription.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Ungrouped Feeds */}
            {filteredUngrouped.length > 0 && (
              <div className="bg-card rounded-xl border">
                <div className="p-4 border-b">
                  <h3 className="font-semibold text-muted-foreground">
                    未分组
                  </h3>
                </div>
                <div className="divide-y">
                  {filteredUngrouped.map((subscription) => (
                    <div
                      key={subscription.id}
                      className="p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
                    >
                      <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                      <img
                        src={subscription.feed.icon || generateInitialIcon(subscription.feed.title)}
                        alt={subscription.feed.title}
                        className="w-10 h-10 rounded-lg"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{subscription.feed.title}</h4>
                          {subscription.unreadCount && subscription.unreadCount > 0 && (
                            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                              {subscription.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {subscription.feed.url}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleToggleNotify(subscription.id, subscription.isNotify)}
                        >
                          {subscription.isNotify ? (
                            <Bell className="h-4 w-4" />
                          ) : (
                            <BellOff className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleUnsubscribe(subscription.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {filteredGroups.length === 0 && filteredUngrouped.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Rss className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-4">
                  {searchQuery ? "没有找到匹配的订阅" : "您还没有订阅任何 RSS 源"}
                </p>
                {!searchQuery && (
                  <Link href="/market">
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      去添加订阅
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
    </PageShell>
  );
}
