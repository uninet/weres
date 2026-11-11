"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { User, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 游客模式提示横幅
 * 在游客访问时显示，提醒用户登录以获取完整功能
 */
export function GuestBanner() {
  const [isGuest, setIsGuest] = useState(true); // 默认为游客，等待验证
  const [isVisible, setIsVisible] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 检查用户登录状态 - 调用 API 验证
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          // 用户已登录
          setIsGuest(false);
        } else {
          // 未登录或 token 无效
          setIsGuest(true);
        }
      } catch (error) {
        console.error("检查登录状态失败:", error);
        setIsGuest(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    // 检查是否之前关闭过
    const dismissed = sessionStorage.getItem("guestBannerDismissed");
    if (dismissed) {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    sessionStorage.setItem("guestBannerDismissed", "true");
  };

  if (isLoading || !isGuest || isDismissed || !isVisible) {
    return null;
  }

  return (
    <div className={cn(
      "fixed bottom-20 left-1/2 -translate-x-1/2 z-50",
      "bg-gradient-to-r from-purple-600 to-blue-600",
      "text-white px-6 py-3 rounded-full shadow-lg",
      "flex items-center gap-4 animate-in slide-in-from-bottom-4",
      "transition-all duration-300"
    )}>
      <div className="flex items-center gap-2">
        <User className="h-4 w-4" />
        <span className="text-sm font-medium">
          您正在以游客身份浏览，登录后可订阅更多RSS源
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/login">
          <Button 
            size="sm" 
            variant="secondary"
            className="h-7 text-xs bg-white/20 hover:bg-white/30 text-white border-0"
          >
            登录
          </Button>
        </Link>
        <button
          onClick={handleDismiss}
          aria-label="关闭提示"
          className="p-1 hover:bg-white/20 rounded-full transition-colors"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * 游客模式限制提示
 * 当游客尝试使用受限功能时显示
 */
export function GuestRestrictionModal({ 
  isOpen, 
  onClose, 
  feature 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  feature: string;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-sm mx-4 shadow-2xl animate-in zoom-in-95">
        <div className="text-center">
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold mb-2">需要登录</h3>
          <p className="text-sm text-muted-foreground mb-6">
            {feature}功能需要登录后才能使用。登录后可享受完整的RSS阅读体验。
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              稍后再说
            </Button>
            <Link href="/login" className="flex-1">
              <Button className="w-full">立即登录</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
