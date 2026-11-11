"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error boundary caught error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f6f3] dark:bg-[#0a0a0a]">
      <div className="max-w-md w-full mx-4 p-8 bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        
        <h2 className="text-xl font-semibold text-[#1a1a1a] dark:text-[#f8f6f3] mb-3">
          出错了
        </h2>
        
        <p className="text-[#6b6b6b] dark:text-[#888] mb-6 text-sm">
          {error.message || "页面加载时发生错误，请稍后重试"}
        </p>

        {error.digest && (
          <p className="text-xs text-[#9b9b9b] mb-6 font-mono">
            Error ID: {error.digest}
          </p>
        )}
        
        <div className="flex gap-3 justify-center">
          <Button
            onClick={reset}
            className="bg-[#1a1a1a] hover:bg-[#2a2a2a] text-white dark:bg-[#f8f6f3] dark:text-[#1a1a1a] dark:hover:bg-[#e8e4df]"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            重试
          </Button>
          
          <Button
            variant="outline"
            onClick={() => window.location.href = "/"}
            className="border-[#e8e4df] dark:border-[#333] text-[#1a1a1a] dark:text-[#f8f6f3]"
          >
            返回首页
          </Button>
        </div>
      </div>
    </div>
  );
}
