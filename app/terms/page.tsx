import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "使用条款与隐私说明 · WeRSS",
};

/**
 * 使用条款 / 隐私说明。
 *
 * 为什么要有这页：注册表单里有一个必须勾选的「我已阅读并同意」，而那两个
 * 链接原本是 `href="#"` —— 勾选框是真的，协议内容不存在，点上去什么都不发生。
 * 要么别让用户勾，要么就把话说清楚。
 *
 * 内容按这个项目的实际情况写，不套 SaaS 模板：
 *   - 它是 MIT 开源的软件，不是托管服务，条款主要约束的是「你部署的那份」
 *   - 数据在部署者自己的机器上，项目本身没有后台服务器，也收不到任何数据
 *   - 文章是抓来的第三方内容，版权和转载范围归原作者与来源站
 *   - 邮件（Kindle 推送、密码重置）走部署者自己配的 SMTP
 *
 * 放在 app/terms 而不是 (main) 路由组里：注册页在那个路由组之外，
 * 用户还没登录，放进 (main) 会被 AuthGuard 弹回登录页 —— 等于还是看不到。
 */
export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#f5f5f7] px-4 py-10 dark:bg-[#151517]">
      <div className="mx-auto max-w-2xl">
        <div className="mb-7">
          <Link
            href="/register"
            className="text-[13px] text-[#8a8a8e] transition-colors hover:text-[#1c1c1e] dark:hover:text-white"
          >
            ← 返回注册
          </Link>
          <h1 className="mt-3 text-[22px] font-semibold text-[#1c1c1e] dark:text-[#f5f5f7]">
            使用条款与隐私说明
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-[#8a8a8e] dark:text-[#8e8e93]">
            WeRSS 是一个开源（MIT）的自托管 RSS 阅读器。下面写的是它实际的行为，
            不是一份可以套在任何产品上的模板。
          </p>
        </div>

        <section
          id="terms"
          className="rounded-2xl border border-black/[0.07] bg-white p-6 dark:border-white/[0.08] dark:bg-[#1c1c1e]"
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#c9a962]/15">
              <ScrollText className="h-4 w-4 text-[#a8894a] dark:text-[#d9bd82]" />
            </span>
            <h2 className="text-[15px] font-semibold text-[#1c1c1e] dark:text-[#f5f5f7]">
              使用条款
            </h2>
          </div>

          <div className="space-y-4 text-[13px] leading-relaxed text-[#4a4a4e] dark:text-[#c4c4c8]">
            <div>
              <h3 className="mb-1 font-medium text-[#1c1c1e] dark:text-[#f5f5f7]">
                1. 软件许可
              </h3>
              <p>
                本项目以 MIT 协议开源，你可以自由使用、修改、分发，甚至用于商业用途，
                条件是保留版权声明与许可文本。软件按「原样」提供，不附带任何担保，
                作者不对因使用本软件产生的任何损失负责。
              </p>
            </div>

            <div>
              <h3 className="mb-1 font-medium text-[#1c1c1e] dark:text-[#f5f5f7]">
                2. 你用的那一份由谁负责
              </h3>
              <p>
                WeRSS 没有官方托管服务。你访问的这个站点通常是某个人（可能是你自己）
                在自己机器或服务器上部署的。账号体系、数据保管、备份、可用性、
                是否对外开放注册，都由部署者决定并负责。
              </p>
            </div>

            <div>
              <h3 className="mb-1 font-medium text-[#1c1c1e] dark:text-[#f5f5f7]">
                3. 内容版权
              </h3>
              <p>
                阅读器里的文章来自你或部署者订阅的 RSS 源，版权归原作者与来源站所有。
                本软件只做抓取、清洗与展示，不主张任何权利。个人阅读以外的用途
                （转载、二次发布、商业使用）请自行确认来源站的授权范围。
              </p>
            </div>

            <div>
              <h3 className="mb-1 font-medium text-[#1c1c1e] dark:text-[#f5f5f7]">
                4. 合理使用
              </h3>
              <p>
                请勿用它批量抓取对抓取频率有明确限制的站点，也不要把它当作内容农场
                的采集器。同步频率、单次抓取数量都可以在部署侧调整，默认值已经
                比较克制。
              </p>
            </div>

            <div>
              <h3 className="mb-1 font-medium text-[#1c1c1e] dark:text-[#f5f5f7]">
                5. 条款变更
              </h3>
              <p>
                这页内容随代码一起走版本管理，改动会体现在仓库的提交记录里。
                部署者如果自行修改了这份文档，以他部署的那一份为准。
              </p>
            </div>
          </div>
        </section>

        <section
          id="privacy"
          className="mt-4 rounded-2xl border border-black/[0.07] bg-white p-6 dark:border-white/[0.08] dark:bg-[#1c1c1e]"
        >
          <div className="mb-4 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#c9a962]/15">
              <ShieldCheck className="h-4 w-4 text-[#a8894a] dark:text-[#d9bd82]" />
            </span>
            <h2 className="text-[15px] font-semibold text-[#1c1c1e] dark:text-[#f5f5f7]">
              隐私说明
            </h2>
          </div>

          <div className="space-y-4 text-[13px] leading-relaxed text-[#4a4a4e] dark:text-[#c4c4c8]">
            <div>
              <h3 className="mb-1 font-medium text-[#1c1c1e] dark:text-[#f5f5f7]">
                1. 数据存在哪里
              </h3>
              <p>
                全部存在部署者的服务器上，具体是一个本地 SQLite 文件。账号、订阅、
                收藏、阅读历史、标签、通知都在这个文件里，不经过任何第三方服务器。
                本项目没有遥测、没有埋点、没有统计上报。
              </p>
            </div>

            <div>
              <h3 className="mb-1 font-medium text-[#1c1c1e] dark:text-[#f5f5f7]">
                2. 收集了什么
              </h3>
              <p>
                注册时保存邮箱和密码哈希（bcrypt，不可逆）。登录后记录你读过哪些
                文章（用于「已读」状态和阅读历史）、收藏了哪些、订阅了哪些源。
                这些数据的用途只有「让阅读器正常工作」。
              </p>
            </div>

            <div>
              <h3 className="mb-1 font-medium text-[#1c1c1e] dark:text-[#f5f5f7]">
                3. 什么会离开这台服务器
              </h3>
              <p>
                只有两件事：①订阅与同步时向 RSS 源发起请求（这是抓取文章本身必需的，
                会带上你的服务器 IP）；②如果你配置了 SMTP 并主动点了「推送到 Kindle」
                或「忘记密码」，邮件会经由你配置的邮件服务商发出。
              </p>
            </div>

            <div>
              <h3 className="mb-1 font-medium text-[#1c1c1e] dark:text-[#f5f5f7]">
                4. Cookie
              </h3>
              <p>
                只有一个 HttpOnly 的登录令牌 Cookie，用于识别当前登录状态，
                不用于广告或跨站追踪。退出登录即清除。
              </p>
            </div>

            <div>
              <h3 className="mb-1 font-medium text-[#1c1c1e] dark:text-[#f5f5f7]">
                5. 删除你的数据
              </h3>
              <p>
                个人中心 → 账号安全 → 注销账号，会级联删除你的订阅、收藏、历史、
                标签和通知，不留副本。数据库文件本身由部署者定期备份，那些备份
                里的历史副本需要联系部署者处理。
              </p>
            </div>

            <div>
              <h3 className="mb-1 font-medium text-[#1c1c1e] dark:text-[#f5f5f7]">
                6. 开源可核对
              </h3>
              <p>
                以上每一条都可以在仓库里核对：没有第三方分析脚本，没有向外部
                发送数据的接口，图片与图标全部本地生成或来自文章本身。
                不信任文字的话，读代码就行。
              </p>
            </div>
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-[#8a8a8e] dark:text-[#8e8e93]">
          WeRSS · 自托管 RSS 阅读器 · MIT License
        </p>
      </div>
    </div>
  );
}
