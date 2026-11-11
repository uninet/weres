"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BookOpen, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useKindlePush } from "@/hooks/use-kindle-push";

/**
 * Kindle 推送设置。
 *
 * 单独抽成组件而不是塞进设置页的 JSX：设置页已经 300 多行，
 * 这块有自己的一套状态（是否启用、上次推送结果），
 * 混进去会让那一页更难读。
 */
export function KindleSettings() {
  const { enabled, kindleEmail, saveEmail, saving } = useKindlePush();
  const [draft, setDraft] = useState<string>(kindleEmail ?? "");

  const handleSave = async () => {
    const ok = await saveEmail(draft);
    if (ok) toast.success("Kindle 邮箱已保存");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-lg bg-[#007AFF]/10 flex items-center justify-center shrink-0">
          <BookOpen className="h-4 w-4 text-[#007AFF]" />
        </div>
        <div className="space-y-1">
          <Label>推送到 Kindle</Label>
          <p className="text-sm text-gray-500">
            填好 Kindle 邮箱后，阅读器里每篇文章都能一键推送到设备上阅读。
          </p>
        </div>
      </div>

      {!enabled && (
        <p className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg px-3 py-2">
          服务端尚未配置 SMTP，推送暂不可用。配置 SMTP_HOST / SMTP_PORT /
          SMTP_USER / SMTP_PASSWORD 后重启服务即可启用。
        </p>
      )}

      <div className="flex items-center gap-2 max-w-md">
        <Input
          type="email"
          placeholder="your-name@kindle.com"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={!enabled || saving}
        />
        <Button
          variant="outline"
          className="gap-2 shrink-0"
          onClick={handleSave}
          disabled={!enabled || saving}
        >
          <Send className="h-4 w-4" />
          保存
        </Button>
      </div>

      <p className="text-xs text-gray-400 leading-relaxed">
        国内的 Kindle 邮箱通常是 <code>xxx@kindle.cn</code>，国际版是{" "}
        <code>xxx@kindle.com</code>。推送后如果没收到，请到 Amazon
        「管理我的内容和设备 → 首选项 → 个人文档设置」里，把发件邮箱加入已批准列表。
      </p>
    </div>
  );
}
