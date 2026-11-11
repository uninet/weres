"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 每个订阅源独立的视图设置。
 *
 * 为什么需要：不同源的内容形态差别很大 —— 技术博客大量代码块，
 * 需要宽一点、字小一点；公众号转载的短文适合窄栏大字。
 * 只给一套全局设置，用户每次切源都要手动调回来。
 * QiReader 把「每个源独立视图配置」当作卖点，就是因为它确实省事。
 *
 * 存储：localStorage，键 `werss:feed-view:<feedId>`。
 * 不落库是刻意的 —— 这是纯展示偏好，换设备重建一次成本很低，
 * 而每改一次字号就发一个写请求并不值得。
 */

export interface FeedViewSettings {
  fontSize?: string;
  fontFamily?: string;
  lineHeight?: string;
  contentWidth?: string;
}

const KEY_PREFIX = "werss:feed-view:";

function read(feedId: string): FeedViewSettings {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + feedId);
    return raw ? (JSON.parse(raw) as FeedViewSettings) : {};
  } catch {
    return {};
  }
}

export function useFeedViewSettings(feedId: string | null | undefined) {
  const [override, setOverride] = useState<FeedViewSettings>({});

  useEffect(() => {
    if (!feedId) {
      setOverride({});
      return;
    }
    setOverride(read(feedId));
  }, [feedId]);

  const save = useCallback(
    (patch: FeedViewSettings) => {
      if (!feedId) return;
      setOverride((prev) => {
        const next = { ...prev, ...patch };
        try {
          window.localStorage.setItem(KEY_PREFIX + feedId, JSON.stringify(next));
        } catch {
          // localStorage 满/被禁用时静默失败：视图设置不值得打断阅读
        }
        return next;
      });
    },
    [feedId]
  );

  const clear = useCallback(() => {
    if (!feedId) return;
    try {
      window.localStorage.removeItem(KEY_PREFIX + feedId);
    } catch {
      // 同上
    }
    setOverride({});
  }, [feedId]);

  return { override, save, clear, hasOverride: Object.keys(override).length > 0 };
}
