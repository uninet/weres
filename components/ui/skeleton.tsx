import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * 骨架屏变体
   * - default: 默认矩形
   * - circle: 圆形（头像等）
   * - text: 文本行
   * - card: 卡片
   */
  variant?: "default" | "circle" | "text" | "card";
  /**
   * 是否显示动画
   */
  animate?: boolean;
}

/**
 * 骨架屏组件
 * 用于在内容加载时显示占位符
 */
function Skeleton({
  className,
  variant = "default",
  animate = true,
  ...props
}: SkeletonProps) {
  const baseClasses = "bg-muted";
  const animateClasses = animate ? "animate-pulse" : "";

  const variantClasses = {
    default: "rounded-md",
    circle: "rounded-full",
    text: "rounded-sm",
    card: "rounded-xl",
  };

  return (
    <div
      className={cn(baseClasses, animateClasses, variantClasses[variant], className)}
      {...props}
    />
  );
}

/**
 * 文章卡片骨架屏
 */
function ArticleCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("p-4 border rounded-lg space-y-3", className)}>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-2/3" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

/**
 * RSS源卡片骨架屏
 */
function FeedCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("p-4 border rounded-lg space-y-3", className)}>
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" className="h-10 w-10" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <div className="flex justify-between items-center pt-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

/**
 * 文章列表骨架屏
 */
function ArticleListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <ArticleCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * RSS源列表骨架屏
 */
function FeedListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <FeedCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * 阅读器骨架屏
 */
function ReaderSkeleton() {
  return (
    <div className="flex h-full">
      {/* 左侧订阅源列表 */}
      <div className="w-64 border-r p-4 space-y-3 hidden md:block">
        <Skeleton className="h-8 w-full" />
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>

      {/* 中间文章列表 */}
      <div className="w-80 border-r p-4 space-y-3 hidden lg:block">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>

      {/* 右侧阅读区 */}
      <div className="flex-1 p-6 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <div className="flex gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export {
  Skeleton,
  ArticleCardSkeleton,
  FeedCardSkeleton,
  ArticleListSkeleton,
  FeedListSkeleton,
  ReaderSkeleton,
};
