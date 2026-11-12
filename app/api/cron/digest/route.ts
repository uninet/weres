import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSmtpConfig, getTransporter } from "@/lib/kindle";

// 每天读库、按时间窗筛文章、真发邮件，绝不能被预渲染
export const dynamic = "force-dynamic";

/**
 * POST /api/cron/digest
 *
 * 给打开了「邮件摘要」的用户发一封昨天新增文章的汇总邮件。
 *
 * 为什么是一个需要手工挂定时任务的接口，而不是在应用里跑 setInterval：
 *   Next.js 的 standalone 进程可能被重启、可能多实例，进程内定时器
 *   在部署环境里既不可靠也不好观测。交给系统 cron / GitHub Actions /
 *   k8s CronJob 触发是更符合「拉下来就能跑」这个定位的做法，
 *   README 里给了 crontab 示例。
 *
 * 鉴权用 CRON_SECRET：
 *   这是唯一一个不基于用户 Cookie 的写接口（它要遍历所有用户），
 *   所以必须有自己的凭据。没配 CRON_SECRET 时直接 503 而不是「放行」——
 *   默认放行的定时任务接口等于给攻击者一个免费的发信机。
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      {
        success: false,
        message:
          "未配置 CRON_SECRET。请在环境变量里设置一个随机值，再用同一个值调用此接口。",
      },
      { status: 503 }
    );
  }

  // 支持 Authorization: Bearer <secret> 与 ?key=<secret> 两种写法：
  // 前者是标准做法，后者方便在某些不支持自定义头的调度器里用。
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const queryKey = new URL(req.url).searchParams.get("key") || "";
  if (bearer !== secret && queryKey !== secret) {
    return NextResponse.json(
      { success: false, message: "无效的调用凭据" },
      { status: 401 }
    );
  }

  const smtp = getSmtpConfig();
  if (!smtp) {
    return NextResponse.json(
      {
        success: false,
        message:
          "服务端未配置 SMTP，无法发送摘要邮件。请设置 SMTP_HOST / SMTP_USER / SMTP_PASSWORD / SMTP_FROM。",
      },
      { status: 503 }
    );
  }

  // 统计窗口：最近 24 小时入库的文章。
  // 用 createdAt 而不是 pubDate —— 用户想看的是「我订阅的源昨天抓到了
  // 什么」，一个 2019 年的旧文今天被某个源重新吐出来也算新内容。
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    const recipients = await prisma.user.findMany({
      where: {
        emailDigest: true,
        status: "ACTIVE",
        email: { not: null },
        // 访客账号没有真实邮箱，跳过
        NOT: { id: "guest-user-id" },
      },
      select: { id: true, email: true, nickname: true },
    });

    if (recipients.length === 0) {
      return NextResponse.json({
        success: true,
        message: "没有用户开启邮件摘要",
        data: { sent: 0, skipped: 0 },
      });
    }

    const transporter = getTransporter(smtp);
    let sent = 0;
    let skipped = 0;
    const failures: { email: string; error: string }[] = [];

    for (const user of recipients) {
      if (!user.email) {
        skipped += 1;
        continue;
      }

      // 每个用户单独查：他订阅了哪些源、这些源昨天新增了什么。
      // 不能一次查全部再分给各用户，订阅关系是每人不相同的。
      const articles = await prisma.article.findMany({
        where: {
          createdAt: { gte: since },
          feed: {
            subscriptions: {
              some: { userId: user.id, isNotify: true },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          title: true,
          link: true,
          pubDate: true,
          feed: { select: { title: true } },
        },
      });

      if (articles.length === 0) {
        skipped += 1;
        continue;
      }

      const items = articles
        .map((a) => {
          const title = escapeHtml(a.title);
          const url = escapeAttr(a.link);
          const feed = escapeHtml(a.feed.title || "未知来源");
          return `<li style="margin-bottom:14px">
  <a href="${url}" style="color:#007AFF;text-decoration:none;font-weight:600">${title}</a>
  <div style="color:#888;font-size:12px;margin-top:2px">${feed}</div>
</li>`;
        })
        .join("");

      const html = `<!DOCTYPE html>
<html lang="zh-CN"><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#333;line-height:1.6">
  <h2 style="margin:0 0 4px;font-size:20px">WeRSS 每日摘要</h2>
  <p style="color:#888;font-size:13px;margin:0 0 20px">
    ${escapeHtml(user.nickname || user.email)} 的订阅源在过去 24 小时新增了 ${articles.length} 篇文章
  </p>
  <ul style="list-style:none;padding:0;margin:0">${items}</ul>
  <p style="color:#aaa;font-size:12px;margin-top:28px;border-top:1px solid #eee;padding-top:12px">
    不想再收到这封邮件？到 设置 → 通知设置 里关掉「邮件摘要」。
  </p>
</body></html>`;

      try {
        await transporter.sendMail({
          from: smtp.from,
          to: user.email,
          subject: `WeRSS 每日摘要：${articles.length} 篇新文章`,
          html,
        });
        sent += 1;
      } catch (error) {
        // 单个用户发信失败不该中断整批：可能只是某个邮箱地址
        // 被对方服务器拒收，其余用户还在等着收。
        failures.push({
          email: user.email,
          error: error instanceof Error ? error.message : "发送失败",
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `摘要发送完成：成功 ${sent}，跳过 ${skipped}，失败 ${failures.length}`,
      data: { sent, skipped, failures },
    });
  } catch (error) {
    console.error("[cron/digest] 发送摘要失败:", error);
    return NextResponse.json(
      { success: false, message: "发送摘要失败，请查看服务端日志" },
      { status: 500 }
    );
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(input: string): string {
  return escapeHtml(input);
}
