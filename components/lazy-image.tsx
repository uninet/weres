"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  /**
   * 图片加载失败时的占位图
   */
  fallback?: string;
  /**
   * 是否启用懒加载
   */
  lazy?: boolean;
  /**
   * 图片加载完成前的占位样式
   */
  placeholderClassName?: string;
}

/**
 * 懒加载图片组件
 * 
 * 特性：
 * - 使用 Intersection Observer 实现真正的懒加载
 * - 加载时显示骨架屏占位
 * - 支持加载失败回退
 * - 平滑的淡入动画
 */
export function LazyImage({
  src,
  alt,
  className,
  fallback = "https://api.dicebear.com/7.x/initials/svg?seed=RSS",
  lazy = true,
  placeholderClassName,
  ...props
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(!lazy);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // 使用 Intersection Observer 实现懒加载
  useEffect(() => {
    if (!lazy || isInView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "50px", // 提前 50px 开始加载
        threshold: 0.01,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [lazy, isInView]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  const imageSrc = hasError ? fallback : isInView ? src : undefined;

  return (
    <div
      ref={imgRef}
      className={cn(
        "relative overflow-hidden",
        !isLoaded && "bg-muted",
        className
      )}
    >
      {/* 骨架屏占位 */}
      {!isLoaded && (
        <Skeleton
          className={cn(
            "absolute inset-0",
            placeholderClassName
          )}
        />
      )}

      {/* 实际图片 */}
      {isInView && (
        <img
          src={imageSrc}
          alt={alt}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            isLoaded ? "opacity-100" : "opacity-0",
            className
          )}
          onLoad={handleLoad}
          onError={handleError}
          {...props}
        />
      )}
    </div>
  );
}

/**
 * RSS Feed 图标组件
 * 专门用于 RSS 源的图标展示
 */
interface FeedIconProps {
  src?: string;
  title: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function FeedIcon({
  src,
  title,
  className,
  size = "md",
}: FeedIconProps) {
  const sizeClasses = {
    sm: "w-10 h-10",
    md: "w-12 h-12",
    lg: "w-14 h-14",
  };

  const fallbackSrc = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
    title
  )}`;

  return (
    <LazyImage
      src={src || fallbackSrc}
      alt={title}
      className={cn(
        sizeClasses[size],
        "rounded-lg",
        className
      )}
      fallback={fallbackSrc}
    />
  );
}
