import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// /api/market 必须按请求实时查询数据库。
//
// 不加这条声明时，Next 会在 `next build` 阶段把这个 GET 当成静态路由预先执行，
// 把当时的数据库行烤进 .next/server/app/api/market.body。后果有两个：
//   1. 构建机必须能连上数据库，否则构建产物里是一份错误内容；
//   2. 部署后接口永远返回构建那一刻的数据，新订阅的市场源不会出现。
export const dynamic = "force-dynamic";

// GET /api/market - 获取 RSS 市场列表
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    const userId = auth.user?.id; // 如果未登录，userId 为 undefined

    const marketFeeds = await prisma.marketFeed.findMany({
      where: {
        status: "ACTIVE",
      },
      include: {
        feed: {
          select: {
            id: true,
            url: true,
            title: true,
            description: true,
            icon: true,
            category: true,
          },
        },
      },
      orderBy: [
        { isFeatured: "desc" },
        { subscriberCount: "desc" },
      ],
    });

    // 如果用户已登录，获取用户的订阅信息
    let userSubscriptions: string[] = [];
    if (userId) {
      const subscriptions = await prisma.subscription.findMany({
        where: { userId },
        select: { feedId: true },
      });
      userSubscriptions = subscriptions.map(sub => sub.feedId);
    }

    // 订阅数按实际订阅记录实时统计，不读 MarketFeed.subscriberCount。
    //
    // 那个字段靠 increment/decrement 维护，但维护它的只有
    // /api/subscriptions 一条路径：UI 实际用的 /api/feeds/subscriptions
    // 从来不碰它，取消订阅的两条路径行为也不一致。结果是这个计数器
    // 只会往上飘，实测同一时刻「少数派」显示 0、实际有 1 个订阅。
    // 一次 groupBy 就能拿到全部真实数量，比维护十处配对逻辑可靠。
    const actualCounts = await prisma.subscription.groupBy({
      by: ["feedId"],
      _count: { _all: true },
    });
    const countMap = new Map(
      actualCounts.map((row) => [row.feedId, row._count._all])
    );

    // 添加用户订阅状态
    const enrichedFeeds = marketFeeds.map((mf) => ({
      ...mf,
      subscriberCount: countMap.get(mf.feed.id) ?? 0,
      isSubscribed: userSubscriptions.includes(mf.feed.id),
    }));

    return NextResponse.json({
      success: true,
      data: enrichedFeeds,
    });
  } catch (error) {
    console.error("Get market feeds error:", error);
    return NextResponse.json(
      { success: false, message: "获取市场 RSS 源失败" },
      { status: 500 }
    );
  }
}
