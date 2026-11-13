"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateInitialIcon } from "@/lib/feed-icon";
import { cn } from "@/lib/utils";
import type { MarketFeedRow } from "@/lib/market";

/** 订阅成功后回调，让页面刷新该行的状态 */
export interface FeedRowProps {
  feed: MarketFeedRow;
  /** 该行是否正在请求中 */
  busy: boolean;
  onSubscribe: (feed: MarketFeedRow) => void;
  onUnsubscribe: (feed: MarketFeedRow) => void;
}

/**
 * 「添加订阅」页的一行源。
 *
 * 做成列表行而不是卡片：这个页面一次要展示 7 个分类 × 10 个源，
 * 卡片每张占三四行高度，一屏只能看到两三个，用户得一直滚才知道
 * 有哪些源。列表行一行一个源，一屏能看到六七个，扫视成本低得多。
 */
export function FeedRow({ feed, busy, onSubscribe, onUnsubscribe }: FeedRowProps) {
  const title = feed.feed.title || "未知源";
  const description = feed.feed.description?.trim() || "";

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      {/* 图标：优先用源自带 icon，没有就用本地首字图标 */}
      <img
        src={feed.feed.icon || generateInitialIcon(title)}
        alt=""
        aria-hidden="true"
        className="h-9 w-9 shrink-0 rounded-lg object-cover"
        // 源图标 404 时换成首字图标，否则会留一个破图占位
        onError={(event) => {
          const img = event.currentTarget;
          const fallback = generateInitialIcon(title);
          if (img.src !== fallback) img.src = fallback;
        }}
      />

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-medium text-[#1c1c1e] dark:text-[#f2f2f2]">
          {title}
        </div>
        <div className="truncate text-[12px] text-[#8a8a8e] dark:text-[#8e8e93]">
          {description || `${feed.subscriberCount} 人订阅`}
        </div>
      </div>

      <Button
        size="sm"
        variant={feed.isSubscribed ? "outline" : "default"}
        disabled={busy}
        onClick={() => (feed.isSubscribed ? onUnsubscribe(feed) : onSubscribe(feed))}
        className={cn(
          "h-8 shrink-0 rounded-lg px-3 text-[12.5px]",
          feed.isSubscribed
            ? "border-black/[0.12] text-[#666] dark:border-white/[0.14] dark:text-[#aaa]"
            : "bg-[#c9a962] text-white hover:bg-[#b8974f] dark:bg-[#c9a962] dark:text-[#1a1a1a] dark:hover:bg-[#d9bd82]"
        )}
        aria-label={feed.isSubscribed ? `取消订阅 ${title}` : `订阅 ${title}`}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : feed.isSubscribed ? (
          <>
            <Check className="mr-1 h-3.5 w-3.5" />
            已订阅
          </>
        ) : (
          <>
            <Plus className="mr-1 h-3.5 w-3.5" />
            订阅
          </>
        )}
      </Button>
    </div>
  );
}
