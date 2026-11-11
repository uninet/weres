import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncFeed, syncAllFeeds } from "@/lib/rss-parser";
import { requireAuth } from "@/lib/auth";
import { checkRateLimit, rateLimitConfigs } from "@/lib/rate-limit";

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

    const body = await req.json();
    const { feedId } = body;

    if (feedId) {
      // 同步指定 RSS 源
      const result = await syncFeed(feedId);
      return NextResponse.json(result);
    } else {
      // 同步所有 RSS 源
      const result = await syncAllFeeds();
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

    const feeds = await prisma.feed.findMany({
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
