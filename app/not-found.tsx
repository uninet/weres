import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion, Home } from "lucide-react";

/**
 * 全局 404 页面
 *
 * 没有这个文件时，访问不存在的路径会落到 Next 默认的英文
 * "This page could not be found"，与整个中文界面割裂，
 * 用户也得不到任何返回入口。
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-md w-full mx-4 p-8 bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
          <FileQuestion className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>

        <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f8f6f3] mb-3">
          页面不存在
        </h2>

        <p className="text-[#6b6b6b] dark:text-[#888] mb-6 text-sm">
          你访问的地址可能已被删除，或者输入有误。
        </p>

        <Button asChild>
          <Link href="/">
            <Home className="w-4 h-4 mr-2" />
            返回首页
          </Link>
        </Button>
      </div>
    </div>
  );
}
