import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Rss, BookOpen, Sparkles, ArrowRight, Github, Server } from "lucide-react";

/**
 * 首页。
 *
 * 之前它是一张固定的营销页：已登录用户访问 `/` 看到的还是「开始使用 / 注册」，
 * 点了又被 AuthGuard 弹回阅读器 —— 对自托管用户来说纯属绕路。
 *
 * 现在分两种情况：
 *   - 带着有效登录 Cookie：直接进阅读器（首页对他们没有意义）
 *   - 没登录：一张如实的介绍页，说清楚它是自托管、开源、数据在你自己机器上
 *
 * 这里不校验 JWT 是否仍然有效，只看 Cookie 在不在：真的失效了，
 * AuthGuard 会把用户送回登录页，代价只是一次跳转，比每次访问首页
 * 都查一次数据库划算。
 */
export default function Home() {
  const hasSession = Boolean(cookies().get("token")?.value);
  if (hasSession) {
    redirect("/reader");
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-[#151517]">
      <header className="sticky top-0 z-50 border-b border-black/[0.07] bg-white/85 backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#1c1c1e]/85">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#c9a962]">
              <Rss className="h-4 w-4 text-white" strokeWidth={2.2} />
            </span>
            <span className="text-[15px] font-semibold text-[#1c1c1e] dark:text-[#f5f5f7]">
              WeRSS
            </span>
          </div>
          <nav className="flex items-center gap-1.5">
            <Link
              href="/login"
              className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-[#4a4a4e] transition-colors hover:bg-black/[0.04] dark:text-[#c4c4c8] dark:hover:bg-white/[0.06]"
            >
              登录
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-[#1c1c1e] px-3 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-85 dark:bg-[#f5f5f7] dark:text-[#1c1c1e]"
            >
              注册
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-black/[0.07] bg-white px-3 py-1 text-xs text-[#8a8a8e] dark:border-white/[0.08] dark:bg-[#1c1c1e] dark:text-[#8e8e93]">
            <Server className="h-3 w-3" />
            自托管 · 数据在你自己的机器上
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#1c1c1e] sm:text-4xl dark:text-[#f5f5f7]">
            把订阅收进一个地方，
            <br className="hidden sm:block" />
            然后安静地读完
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-[#8a8a8e] dark:text-[#8e8e93]">
            一个可以自己部署的 RSS 阅读器。没有推荐算法，没有信息流，
            没有第三方分析——订阅什么，就只有什么。
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#1c1c1e] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-85 dark:bg-[#f5f5f7] dark:text-[#1c1c1e]"
            >
              开始使用
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/market"
              className="inline-flex items-center gap-1.5 rounded-xl border border-black/[0.1] bg-white px-5 py-2.5 text-sm font-medium text-[#1c1c1e] transition-colors hover:bg-black/[0.02] dark:border-white/[0.12] dark:bg-[#1c1c1e] dark:text-[#f5f5f7] dark:hover:bg-white/[0.04]"
            >
              看看 RSS 市场
            </Link>
          </div>
          <p className="mt-3 text-xs text-[#8a8a8e] dark:text-[#8e8e93]">
            已经有部署实例？直接{" "}
            <Link
              href="/login"
              className="font-medium text-[#a8894a] hover:underline dark:text-[#d9bd82]"
            >
              登录
            </Link>
            ，演示账号见登录页
          </p>
        </div>

        <div className="mt-16 grid gap-4 sm:mt-20 sm:grid-cols-3">
          {[
            {
              icon: Rss,
              title: "订阅任意源",
              desc: "RSS / Atom 都支持，内置 890+ 中文源市场，也可以手动粘贴地址。",
            },
            {
              icon: BookOpen,
              title: "只给正文",
              desc: "三栏布局、四档主题、字号行距页宽可调；只给摘要的源会自动回源抓全文。",
            },
            {
              icon: Sparkles,
              title: "没有多余的东西",
              desc: "无推荐、无广告、无埋点。收藏、历史、标签、Kindle 推送，够用就好。",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-black/[0.07] bg-white p-5 dark:border-white/[0.08] dark:bg-[#1c1c1e]"
            >
              <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[#c9a962]/15">
                <f.icon className="h-4 w-4 text-[#a8894a] dark:text-[#d9bd82]" />
              </span>
              <h3 className="text-[14px] font-semibold text-[#1c1c1e] dark:text-[#f5f5f7]">
                {f.title}
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#8a8a8e] dark:text-[#8e8e93]">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-black/[0.07] py-8 dark:border-white/[0.08]">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-4 text-center">
          <p className="text-xs text-[#8a8a8e] dark:text-[#8e8e93]">
            WeRSS · MIT 开源 · 用自己的账号和数据
          </p>
          <Link
            href="/terms"
            className="inline-flex items-center gap-1 text-xs text-[#8a8a8e] transition-colors hover:text-[#1c1c1e] dark:text-[#8e8e93] dark:hover:text-white"
          >
            <Github className="h-3 w-3" />
            使用条款与隐私说明
          </Link>
        </div>
      </footer>
    </div>
  );
}
