"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 用户偏好设置。
 *
 * 为什么需要一个集中的 hook：
 * 这些开关原本只是设置页里的局部 state —— 用户把它关掉、刷新页面、
 * 回到阅读器，一切照旧，因为**没有任何代码读取过它们**。
 * 一个点了不生效的开关比没有这个开关更糟：用户会以为自己已经关掉了。
 *
 * 存储用 localStorage：这些是纯展示/交互偏好，换设备重建成本很低，
 * 不值得为每次拨动开关发一次写请求。
 */
export interface UserPreferences {
  /** 打开文章时自动标记已读 */
  autoMarkRead: boolean;
  /** 导航栏显示未读数量角标 */
  showUnreadBadge: boolean;
  /** 列表紧凑模式（缩小行距、隐藏摘要） */
  compactView: boolean;
  /** 进入阅读器时自动同步订阅源 */
  autoSync: boolean;
  /** 自动同步间隔（分钟） */
  syncInterval: number;
  /** 浏览器通知 */
  notifications: boolean;
  /** 邮件摘要 */
  emailDigest: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  autoMarkRead: true,
  showUnreadBadge: true,
  compactView: false,
  autoSync: false,
  syncInterval: 30,
  notifications: false,
  emailDigest: false,
};

const STORAGE_KEY = "werss:preferences";

// 同步读一次，避免首屏闪烁：如果等 useEffect 再读，
// 用户会先看到默认值再跳成他设置的值。
function readStored(): UserPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    // 逐字段合并而不是整体替换：旧版本存的偏好缺少新字段时，
    // 新字段应该落到默认值而不是 undefined。
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function usePreferences() {
  const [preferences, setPreferences] =
    useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPreferences(readStored());
    setHydrated(true);
  }, []);

  // 跨标签页同步：一个标签页改了设置，另一个标签页也该跟着变
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setPreferences(readStored());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback(
    <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
      setPreferences((prev) => {
        const next = { ...prev, [key]: value };
        try {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (error) {
          console.error("保存设置失败:", error);
        }
        return next;
      });
    },
    []
  );

  const toggle = useCallback((key: keyof UserPreferences) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: !prev[key] } as UserPreferences;
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (error) {
        console.error("保存设置失败:", error);
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("重置设置失败:", error);
    }
  }, []);

  return { preferences, hydrated, update, toggle, reset };
}
