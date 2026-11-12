import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncFeed } from "@/lib/rss-parser";

// 返回内容依赖当前用户与数据库实时状态，不能被预渲染
export const dynamic = "force-dynamic";

/**
 * POST /api/sync/[feedId]
 * 同步单个 RSS 订阅源
 *
 * 这里原本是自己实现的一套解析 + 入库逻辑（133 行），和
 * lib/rss-parser.ts 的 syncFeed() 是两条独立代码路径。问题在于：
 * 自实现的那条**不调用 fetchFullContent()**，于是「RSS 只给摘要的站点」
 * 通过单个源刷新时永远只有一百多字，而全量同步却能拿到全文 ——
 * 用户看到的是「有时候有全文，有时候没有」，完全无法预期。
 *
 * 现在改为薄封装，只负责鉴权与归属校验，真正的同步逻辑复用 syncFeed()。
 * 两套实现并存时，修了一处永远不知道另一处还在犯同样的错。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { feedId: string } }
) {
  try {
    const token = request.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "未登录" },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, message: "无效的 token" },
        { status: 401 }
      );
    }

    const userId = payload.sub;
    const feedId = params.feedId;

    if (!feedId) {
      return NextResponse.json(
        { success: false, message: "缺少订阅源 ID" },
        { status: 400 }
      );
    }

    // 必须先确认这个源在当前用户名下订阅着。
    // 少了这一步，任何人只要拿到一个 feedId 就能触发对任意源的抓取
    // （包括已停更或别人私有的源），把服务端当成免费的抓取代理。
    const subscription = await prisma.subscription.findFirst({
      where: { userId, feedId },
      select: { id: true },
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, message: "订阅源不存在" },
        { status: 404 }
      );
    }

    const result = await syncFeed(feedId);

    return NextResponse.json(
      {
        success: result.success,
        data: { newArticles: result.count },
        message: result.message,
      },
      { status: result.success ? 200 : 500 }
    );
  } catch (error) {
    console.error("Sync single feed error:", error);
    return NextResponse.json(
      { success: false, message: "同步失败，请稍后重试" },
      { status: 500 }
    );
  }
}
