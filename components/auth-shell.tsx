import Link from "next/link";
import { Rss } from "lucide-react";

/**
 * 登录 / 注册 / 忘记密码 / 重置密码四个页面的统一外壳。
 *
 * 之前这四个页面各写了一套：登录和注册用纯色 Rss 图标 + `bg-muted/50`
 * 背景，忘记密码和重置密码用渐变 Logo + 蓝紫渐变背景 + Card 组件。
 * 访客第一眼看到的就是这几页，四页三种长相，很像四个不同的产品拼起来。
 *
 * 这里只做一件事：把背景、品牌区、卡片框统一掉，内容仍由各页自己填。
 * 视觉沿用产品内部的语言 —— 暖灰底 + 白色卡片 + 金色点缀，和阅读器、
 * 个人中心是一套，而不是另起一套渐变蓝紫。
 */
interface AuthShellProps {
  /** 卡片主标题，如「登录您的账号」 */
  title: string;
  /** 一句话说明，可选 */
  subtitle?: string;
  /** 标题左侧的返回入口，不传则不显示 */
  backHref?: string;
  children: React.ReactNode;
  /** 卡片下方的补充内容（联系方式、切换注册等） */
  footer?: React.ReactNode;
  /** 卡片宽度，登录/注册默认 28rem，重置类可窄一点 */
  widthClassName?: string;
}

export function AuthShell({
  title,
  subtitle,
  backHref,
  children,
  footer,
  widthClassName = "max-w-md",
}: AuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-4 py-10 dark:bg-[#151517]">
      <div className={`w-full ${widthClassName}`}>
        {/* 品牌区：和侧栏/导航用的是同一个标记，不做第二套 */}
        <div className="mb-7 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[#1c1c1e] transition-opacity hover:opacity-80 dark:text-[#f5f5f7]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#c9a962] shadow-sm">
              <Rss className="h-5 w-5 text-white" strokeWidth={2.2} />
            </span>
            <span className="text-xl font-semibold tracking-tight">WeRSS</span>
          </Link>
          <p className="mt-3 text-[13px] text-[#8a8a8e] dark:text-[#8e8e93]">
            自托管 RSS 阅读器
          </p>
        </div>

        <div className="rounded-2xl border border-black/[0.07] bg-white p-6 shadow-sm sm:p-8 dark:border-white/[0.08] dark:bg-[#1c1c1e]">
          <div className="mb-5">
            <div className="flex items-center gap-2">
              {backHref && (
                <Link
                  href={backHref}
                  aria-label="返回"
                  className="-ml-1 flex h-7 w-7 items-center justify-center rounded-md text-[#8a8a8e] transition-colors hover:bg-black/[0.04] hover:text-[#1c1c1e] dark:hover:bg-white/[0.06] dark:hover:text-white"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path d="m15 18-6-6 6-6" />
                  </svg>
                </Link>
              )}
              <h1 className="text-[17px] font-semibold text-[#1c1c1e] dark:text-[#f5f5f7]">
                {title}
              </h1>
            </div>
            {subtitle && (
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#8a8a8e] dark:text-[#8e8e93]">
                {subtitle}
              </p>
            )}
          </div>

          {children}
        </div>

        {footer && (
          <div className="mt-6 text-center text-[13px] text-[#8a8a8e] dark:text-[#8e8e93]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
