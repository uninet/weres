import { Loader2 } from "lucide-react";

/**
 * 主应用区加载占位
 *
 * Next 在服务端渲染页面时，如果外层有 Suspense 边界就会先展示这个文件。
 * 没有 loading.tsx 时，用户点击导航后页面会「卡住」一段时间没有任何反馈，
 * 看起来像没响应，实际是在等数据。
 */
export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#6b6b6b] dark:text-[#888]" />
        <p className="text-sm text-[#6b6b6b] dark:text-[#888]">加载中…</p>
      </div>
    </div>
  );
}
