import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { BottomNav } from "@/components/bottom-nav";
import { Toaster } from "@/components/toaster";

// 字体策略说明
// -------------
// 这里刻意不使用 next/font/google。
//
// next/font/google 会在 `next build` 期间去 fonts.googleapis.com 下载字体文件，
// 因此构建机必须能访问 Google。在中国大陆、企业内网、离线 CI 环境里这会导致
// 构建直接失败（实测报错：Failed to fetch 'Noto Sans SC' from Google Fonts）。
// 一个「别人拉下来就能跑」的开源项目不应该有这种隐性外网依赖。
//
// 改为纯系统字体栈：无需下载、零阻塞、首屏更快，中文在各平台都有高质量预装字体
// （macOS/iOS 的苹方、Windows 的微软雅黑、Linux 的思源黑体）。
// 字体栈定义在 tailwind.config.ts 与 globals.css 中。

export const metadata: Metadata = {
  title: "WeRSS - Web版RSS阅读平台",
  description: "一款简洁高效的PC端RSS阅读工具，支持自定义订阅和内置RSS市场",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "WeRSS",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* Skip Link for accessibility */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg"
          >
            跳转到主内容
          </a>
          <div id="main-content" className="contents">
            {children}
          </div>
          <BottomNav />
          {/* 全局提示容器。项目里 9 个页面共 61 处调用 toast()，
              没有它的话所有成功/失败提示都会被静默丢弃。 */}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
