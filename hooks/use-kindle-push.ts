"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Kindle 推送相关的客户端状态。
 *
 * 两件事：读/写用户的 Kindle 邮箱，以及把单篇文章推过去。
 * 服务端有没有配 SMTP 由接口返回的 `enabled` 决定 —— 前端不猜，
 * 因为「配置在服务端」这件事前端无从得知。
 */
export interface KindleDelivery {
  id: string;
  toEmail: string;
  status: string;
  error: string | null;
  createdAt: string;
  article: { id: string; title: string } | null;
}

export function useKindlePush() {
  const [enabled, setEnabled] = useState(false);
  const [kindleEmail, setKindleEmail] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<KindleDelivery[]>([]);
  const [saving, setSaving] = useState(false);
  const [pushing, setPushing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/kindle/push");
      const json = await res.json();
      if (json?.success) {
        setEnabled(Boolean(json.data?.enabled));
        setKindleEmail(json.data?.kindleEmail ?? null);
        setDeliveries(json.data?.deliveries ?? []);
      }
    } catch (error) {
      // 这里静默失败是刻意的：Kindle 推送是可选功能，
      // 它加载不出来不该在用户刚打开设置页时就弹一个红色的错误。
      console.error("加载 Kindle 推送状态失败:", error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveEmail = useCallback(
    async (email: string): Promise<boolean> => {
      setSaving(true);
      try {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kindleEmail: email.trim() }),
        });
        const json = await res.json();
        if (json?.success) {
          setKindleEmail(json.data?.kindleEmail ?? null);
          return true;
        }
        return false;
      } catch (error) {
        console.error("保存 Kindle 邮箱失败:", error);
        return false;
      } finally {
        setSaving(false);
      }
    },
    []
  );

  /**
   * 推送一篇文章。返回服务端给的提示文案（成功或失败都在里面），
   * 让调用方决定怎么展示 —— 阅读器用 toast，设置页可以内联显示。
   */
  const push = useCallback(
    async (articleId: string): Promise<{ ok: boolean; message: string }> => {
      setPushing(true);
      try {
        const res = await fetch("/api/kindle/push", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId }),
        });
        const json = await res.json().catch(() => null);
        const message =
          json?.message ||
          (res.ok ? "已推送" : `推送失败（HTTP ${res.status}）`);

        // 推送记录变了，顺手刷一下，用户回到设置页能看到结果
        if (json?.success) void load();

        return { ok: Boolean(json?.success), message };
      } catch (error) {
        console.error("推送失败:", error);
        return { ok: false, message: "推送失败，请检查网络" };
      } finally {
        setPushing(false);
      }
    },
    [load]
  );

  return {
    enabled,
    kindleEmail,
    deliveries,
    saving,
    pushing,
    load,
    saveEmail,
    push,
  };
}
