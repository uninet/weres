import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import {
  isKindlePushEnabled,
  sendArticleToKindle,
} from "@/lib/kindle";
import { sanitizeArticleHtml } from "@/lib/sanitize";

// 推送要读数据库、写投递记录，绝不能被构建期预渲染
export const dynamic = "force-dynamic";

/**
 * POST /api/kindle/push
 * body: { articleId: string }
 *
 * 把一篇文章作为 HTML 附件发到用户自己的 Kindle 邮箱。
 *
 * 为什么要有这个接口而不是让前端直接拼 mailto：附件必须由服务端生成
 * （浏览器没法带着干净的正文去发信），而且推送记录要落库，用户才能
 * 在设置页看到「上次推送成功/失败」。
 */
export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user, isGuest } = auth;

    if (isGuest) {
      return NextResponse.json(
        { success: false, message: "访客模式下无法推送" },
        { status: 403 }
      );
    }

    // 先看服务端有没有配 SMTP。没配就直接说清楚「缺什么」，
    // 而不是让用户点了以后收到一个看不懂的 500。
    if (!isKindlePushEnabled()) {
      return NextResponse.json(
        {
          success: false,
          message:
            "服务端未配置 SMTP。请设置 SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD / SMTP_FROM 后重启服务。",
        },
        { status: 503 }
      );
    }

    const body = await req.json().catch(() => null);
    const articleId =
      body && typeof body.articleId === "string" ? body.articleId.trim() : "";

    if (!articleId) {
      return NextResponse.json(
        { success: false, message: "缺少文章 id" },
        { status: 400 }
      );
    }

    // Kindle 地址存在用户表上，没设置就提示去设置页填。
    const kindleEmail = user.kindleEmail?.trim();
    if (!kindleEmail) {
      return NextResponse.json(
        {
          success: false,
          message: "还没有设置 Kindle 邮箱，请先到 设置 → Kindle 推送 里填写",
        },
        { status: 400 }
      );
    }

    const article = await prisma.article.findUnique({
      where: { id: articleId },
      include: {
        feed: {
          select: {
            title: true,
            // 只有订阅了这个源的人才能推它 —— 否则任何登录用户
            // 都能按 id 把别人订阅源里的文章推到自己设备上
            subscriptions: {
              where: { userId: user.id },
              select: { id: true },
            },
          },
        },
      },
    });

    if (!article || article.feed.subscriptions.length === 0) {
      // 与文章详情接口一致：不区分「不存在」和「无权访问」，
      // 避免用状态码差异枚举别人的文章 id
      return NextResponse.json(
        { success: false, message: "文章不存在或未订阅该源" },
        { status: 404 }
      );
    }

    const result = await sendArticleToKindle({
      to: kindleEmail,
      title: article.title,
      author: article.author,
      feedTitle: article.feed.title,
      url: article.link,
      // 正文是第三方 HTML，发出去之前必须净化一遍：
      // 邮件客户端对 <script> 的处理各不相同，不能指望它们拦。
      content: sanitizeArticleHtml(article.content || article.description || ""),
      pubDate: article.pubDate,
    });

    // 无论成败都留记录。用户回头能看到「哪篇推过、为什么失败」。
    await prisma.kindleDelivery
      .create({
        data: {
          userId: user.id,
          articleId: article.id,
          toEmail: kindleEmail,
          status: result.ok ? "SENT" : "FAILED",
          error: result.ok ? null : (result.error || "未知错误").slice(0, 500),
        },
      })
      .catch((error) => {
        // 记录失败不该把已经成功的推送变成错误响应
        console.error("[kindle] 写入推送记录失败:", error);
      });

    if (!result.ok) {
      return NextResponse.json(
        { success: false, message: result.error || "推送失败" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `已推送到 ${kindleEmail}，通常几分钟内出现在 Kindle 上`,
    });
  } catch (error) {
    console.error("Kindle push error:", error);
    return NextResponse.json(
      { success: false, message: "推送失败，请稍后重试" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/kindle/push
 *
 * 返回三样东西给设置页：
 *   1. 服务端有没有配 SMTP（决定入口是否可点）
 *   2. 用户填的 Kindle 邮箱
 *   3. 最近 10 条推送记录（含失败原因）
 */
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user, isGuest } = auth;

    if (isGuest) {
      return NextResponse.json(
        {
          success: true,
          data: { enabled: false, kindleEmail: null, deliveries: [] },
        },
        { status: 200 }
      );
    }

    const deliveries = await prisma.kindleDelivery.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        toEmail: true,
        status: true,
        error: true,
        createdAt: true,
        article: { select: { id: true, title: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        enabled: isKindlePushEnabled(),
        kindleEmail: user.kindleEmail || null,
        deliveries,
      },
    });
  } catch (error) {
    console.error("Get kindle status error:", error);
    return NextResponse.json(
      { success: false, message: "获取 Kindle 推送状态失败" },
      { status: 500 }
    );
  }
}
