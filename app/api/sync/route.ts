import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncFeed, syncAllFeeds } from "@/lib/rss-parser";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit, rateLimitConfigs } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request";

// 这些接口的返回内容依赖当前登录用户与数据库实时状态，
// 绝不能被 Next 在构建期预渲染成静态文件（会泄漏构建机的数据快照，
// 并且在部署后永远返回同一份旧数据）。
export const dynamic = "force-dynamic";

// POST /api/sync - 同步指定 RSS 源或所有源
export async function POST(req: Request) {
  try {
    // 认证检查
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }

    // 速率限制 - 同步操作比较耗时
    const rateLimit = checkRateLimit(`sync:${auth.user.id}`, rateLimitConfigs.generous);
    if (!rateLimit.success) {
      return NextResponse.json(
        {
          error: "同步操作过于频繁",
          message: "请稍后再试",
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
        },
        { status: 429 }
      );
    }

    const parsed = await readJsonBody<{ feedId?: string }>(req, "请提供 feedId，或传空对象同步全部");
    if (!parsed.ok) return parsed.response;
    const { feedId } = parsed.data;

    if (feedId) {
      // 同步指定 RSS 源：必须先确认这个源在当前用户自己的订阅里。
      //
      // 不加这一步时，任何人拿到一个 feedId 就能让服务器去抓那个源
      // （实测：0 订阅的新账号 POST {"feedId": <别人的源>} 返回 200
      // 「同步完成」）。Feed 是全局实体，但「让服务器为你做这件事」
      // 应该只对自己订阅的源开放 —— 否则这是一个免费的、匿名的抓取代理。
      const owned = await prisma.subscription.findFirst({
        where: { userId: auth.user.id, feedId },
        select: { id: true },
      });
      if (!owned) {
        return NextResponse.json(
          { success: false, message: "订阅源不存在" },
          { status: 404 }
        );
      }

      const result = await syncFeed(feedId);
      return NextResponse.json(result);
    } else {
      // 同步「我订阅的」全部源。
      // 传 userId 而不是同步全库：Feed 是全局实体，全库可能有上千个源，
      // 任何人都能触发的话等于开了一个随时可用的全站抓取开关。
      const result = await syncAllFeeds(auth.user.id);
      return NextResponse.json(result);
    }
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { success: false, message: "同步失败" },
      { status: 500 }
    );
  }
}

// GET /api/sync/status - 获取同步状态
export async function GET(req: Request) {
  try {
    // 认证检查
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }

    // 只返回当前用户订阅的源。
    //
    // 原来这里是裸的 feed.findMany()：Feed 是全局实体，于是任何一个注册账号
    // 都能拿到全站源列表（实测演示实例返回 896 条，而该账号只订阅了 32 个），
    // 连带 lastSyncAt / errorCount / lastError 一起暴露 —— 等于把「这个实例
    // 有多少源、哪些源在报错」公开出去。
    const feeds = await prisma.feed.findMany({
      where: {
        subscriptions: { some: { userId: auth.user.id } },
      },
      select: {
        id: true,
        title: true,
        syncStatus: true,
        lastSyncAt: true,
        errorCount: true,
        lastError: true,
      },
      orderBy: {
        lastSyncAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: feeds,
    });
  } catch (error) {
    console.error("Get sync status error:", error);
    return NextResponse.json(
      { success: false, message: "获取同步状态失败" },
      { status: 500 }
    );
  }
}
