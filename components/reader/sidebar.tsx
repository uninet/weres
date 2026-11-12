"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Rss,
  Bookmark,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Group } from "@/types/reader";

interface SidebarProps {
  groups: Group[];
  selectedFeed: string | null;
  searchQuery: string;
  sidebarCollapsed: boolean;
  refreshingFeeds: Set<string>;
  onSelectFeed: (feedId: string | null) => void;
  onSearchChange: (query: string) => void;
  onToggleCollapse: () => void;
  onRefreshFeed: (feedId: string, e: React.MouseEvent) => void;
}

// 顶部导航项
const topNavItems = [
  { id: "all", label: "全部", icon: Rss, count: 0 },
  { id: "starred", label: "稍后阅读", icon: Bookmark, count: 0 },
];

export function Sidebar({
  groups,
  selectedFeed,
  searchQuery,
  sidebarCollapsed,
  refreshingFeeds,
  onSelectFeed,
  onSearchChange,
  onToggleCollapse,
  onRefreshFeed,
}: SidebarProps) {
  // 计算总未读数
  const totalUnread = groups.reduce(
    (sum, group) =>
      sum + (group.feeds || []).reduce((feedSum, feed) => feedSum + (feed.unread || 0), 0),
    0
  );

  return (
    <div
      className={cn(
        // 小屏上侧栏占满整宽（由 page 用覆盖层控制显隐）；
        // 从 md 起才回到「可折叠的固定窄栏」。
        "bg-[#f5f5f5] dark:bg-[#1a1a1a] border-r border-[#e0e0e0] dark:border-[#2a2a2a] flex flex-col transition-all duration-300 ease-in-out",
        "w-full md:w-auto",
        sidebarCollapsed ? "md:w-16" : "md:w-64"
      )}
    >
      {/* Header */}
      {!sidebarCollapsed && (
        <div className="p-4 border-b border-[#e0e0e0] dark:border-[#2a2a2a]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#999]" />
            <Input
              placeholder="搜索..."
              className="pl-9 bg-white dark:bg-[#252525] border-0 rounded-lg text-sm h-9 focus-visible:ring-1 focus-visible:ring-[#007AFF]"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        {/* Top Navigation */}
        {!sidebarCollapsed && (
          <div className="p-2">
            {topNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = selectedFeed === item.id;
              const count = item.id === "all" ? totalUnread : 0;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectFeed(item.id === "all" ? null : item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200",
                    isActive
                      ? "bg-[#007AFF] text-white"
                      : "text-[#333] dark:text-[#ccc] hover:bg-[#e8e8e8] dark:hover:bg-[#252525]"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {count > 0 && (
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full",
                      isActive ? "bg-white/20" : "bg-[#007AFF] text-white"
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Divider */}
        {!sidebarCollapsed && <div className="mx-4 h-px bg-[#e0e0e0] dark:bg-[#2a2a2a] my-2" />}

        {/* Feeds Header */}
        {!sidebarCollapsed && (
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#999] uppercase tracking-wider">Feeds</span>
            <Link href="/market">
              <Button variant="ghost" size="icon" className="h-6 w-6 rounded-md hover:bg-[#e8e8e8] dark:hover:bg-[#252525]">
                <Plus className="h-3.5 w-3.5 text-[#666]" />
              </Button>
            </Link>
          </div>
        )}

        {/* Feed List */}
        <div className={cn("space-y-0.5", sidebarCollapsed ? "p-1" : "px-2 pb-2")}>
          {(groups || []).map((group) => (
            <div key={group.id}>
              {!sidebarCollapsed && (
                <div className="px-3 py-1.5 text-[11px] font-medium text-[#999]">
                  {group.name}
                </div>
              )}
              <div className="space-y-0.5">
                {(group.feeds || []).map((feed) => {
                  const isRefreshing = refreshingFeeds.has(feed.id);
                  const isActive = selectedFeed === feed.id;
                  return (
                    <div
                      key={feed.id}
                      className={cn(
                        "group flex items-center rounded-lg transition-all duration-200",
                        sidebarCollapsed ? "justify-center p-2" : "px-2 py-1.5",
                        isActive
                          ? "bg-[#007AFF] text-white"
                          : "hover:bg-[#e8e8e8] dark:hover:bg-[#252525]"
                      )}
                    >
                      <button
                        onClick={() => onSelectFeed(feed.id)}
                        className={cn(
                          "flex items-center gap-3 flex-1 min-w-0",
                          sidebarCollapsed && "justify-center"
                        )}
                      >
                        {/* Feed Icon */}
                        <div
                          className={cn(
                            "shrink-0 rounded-md flex items-center justify-center text-xs font-medium overflow-hidden",
                            sidebarCollapsed ? "w-8 h-8" : "w-6 h-6",
                            isActive
                              ? "bg-white/20"
                              : "bg-gradient-to-br from-[#ddd] to-[#ccc] dark:from-[#333] dark:to-[#444] text-[#666] dark:text-[#999]"
                          )}
                        >
                          {feed.icon ? (
                            <img src={feed.icon} alt="" className="w-full h-full object-cover" />
                          ) : (
                            feed.title.charAt(0).toUpperCase()
                          )}
                        </div>

                        {!sidebarCollapsed && (
                          <>
                            <span className={cn(
                              "flex-1 text-left truncate text-sm",
                              isActive ? "text-white" : "text-[#333] dark:text-[#ccc]"
                            )}>
                              {feed.title}
                            </span>
                            {feed.unread && feed.unread > 0 && (
                              <span className={cn(
                                "text-xs px-1.5 py-0.5 rounded-full shrink-0",
                                isActive ? "bg-white/20 text-white" : "bg-[#007AFF] text-white"
                              )}>
                                {feed.unread}
                              </span>
                            )}
                          </>
                        )}
                      </button>

                      {/* Refresh Button */}
                      {!sidebarCollapsed && (
                        <button
                          onClick={(e) => onRefreshFeed(feed.id, e)}
                          disabled={isRefreshing}
                          className={cn(
                            "p-1 rounded opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0",
                            isActive
                              ? "text-white/70 hover:text-white hover:bg-white/10"
                              : "text-[#999] hover:text-[#666] hover:bg-[#ddd] dark:hover:bg-[#333]",
                            isRefreshing && "opacity-100 animate-spin"
                          )}
                        >
                          <RotateCw className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Bottom Collapse Button */}
      <div className="p-2 border-t border-[#e0e0e0] dark:border-[#2a2a2a]">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center rounded-lg text-[#666] hover:bg-[#e8e8e8] dark:text-[#999] dark:hover:bg-[#252525]"
          onClick={onToggleCollapse}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
