import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseRSSFeed, extractFavicon } from "@/lib/rss-parser";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { sanitizeArticleHtml } from "@/lib/sanitize";

// 这些接口的返回内容依赖当前登录用户与数据库实时状态，
// 绝不能被 Next 在构建期预渲染成静态文件（会泄漏构建机的数据快照，
// 并且在部署后永远返回同一份旧数据）。
export const dynamic = "force-dynamic";

const subscribeSchema = z.object({
  url: z.string().url(),
  groupId: z.string().optional(),
  isNotify: z.boolean().default(true),
});

// Get user subscriptions
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user } = auth;

    const subscriptions = await prisma.subscription.findMany({
      where: { userId: user.id },
      include: {
        feed: true,
        group: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // 补上每个源的未读文章数。
    // 订阅管理页顶部要显示「共 N 篇未读」，并按源显示未读角标；
    // 这里不返回的话前端只能算成 0（改动前页面确实一直显示「共 0 篇未读」，
    // 而阅读器侧栏同一批源却显示各 1 篇，两处数字对不上）。
    const readHistories = await prisma.readHistory.findMany({
      where: { userId: user.id },
      select: { articleId: true },
    });
    const readIds = readHistories.map((h) => h.articleId);

    const feedIds = subscriptions.map((sub) => sub.feedId);

    // groupBy 一次拿到所有源的未读数，避免在循环里逐个 count
    const unreadByFeed = feedIds.length
      ? await prisma.article.groupBy({
          by: ["feedId"],
          where: {
            feedId: { in: feedIds },
            id: { notIn: readIds.length > 0 ? readIds : [""] },
          },
          _count: { _all: true },
        })
      : [];

    const unreadMap = new Map(
      unreadByFeed.map((row) => [row.feedId, row._count._all])
    );

    const subscriptionsWithUnread = subscriptions.map((sub) => ({
      ...sub,
      unreadCount: unreadMap.get(sub.feedId) ?? 0,
    }));

    // Group by group
    // 用查询结果里元素的真实类型做累加器，避免 any：
    // 这样前端拿到的 group / subscriptions 字段改了名，这里会立刻报错。
    type SubscriptionWithRelations = (typeof subscriptionsWithUnread)[number];

    const grouped = subscriptionsWithUnread.reduce<Record<string, {
      group: SubscriptionWithRelations["group"];
      subscriptions: SubscriptionWithRelations[];
    }>>((acc, sub) => {
      const groupId = sub.groupId || "ungrouped";
      if (!acc[groupId]) {
        acc[groupId] = {
          group: sub.group,
          subscriptions: [],
        };
      }
      acc[groupId].subscriptions.push(sub);
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      data: { groups: grouped },
    });
  } catch (error) {
    console.error("Get subscriptions error:", error);
    return NextResponse.json(
      { success: false, message: "获取订阅失败" },
      { status: 500 }
    );
  }
}

// Add subscription
export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user } = auth;

    const body = await req.json();
    const { url, groupId, isNotify } = subscribeSchema.parse(body);

    // Parse RSS to get feed info
    const parsed = await parseRSSFeed(url);

    // Create or update feed
    const feed = await prisma.feed.upsert({
      where: { url },
      update: {
        title: parsed.title || url,
        description: parsed.description || '',
        icon: parsed.icon || extractFavicon(url),
        lastSyncAt: new Date(),
        syncStatus: "SUCCESS",
      },
      create: {
        url,
        title: parsed.title || url,
        description: parsed.description || '',
        icon: parsed.icon || extractFavicon(url),
        lastSyncAt: new Date(),
        syncStatus: "SUCCESS",
      },
    });

    // Import articles
    for (const item of parsed.items.slice(0, 20)) {
      if (!item.title || !item.link) continue;

      // guid 只在单个源内唯一（同源内可能被别的源用同样的值），
      // 所以 upsert 的条件必须带上 feedId，不能只用 guid。
      const guid = item.guid || item.link;
      await prisma.article.upsert({
        where: { feedId_guid: { feedId: feed.id, guid } },
        update: {},
        create: {
          feedId: feed.id,
          title: item.title,
          link: item.link,
          description: item.description || '',
          content: sanitizeArticleHtml(item.content || ''),
          author: item.author || '',
          pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
          imageUrl: item.imageUrl,
          guid,
        },
      });
    }

    // 决定这条订阅挂到哪个分组下。
    //
    // 为什么必须有这一步：/api/groups（阅读器左栏的唯一数据源）
    // 只返回「分组下的订阅」。市场页订阅时不传 groupId，订阅记录
    // 就带着 groupId=null 落库，左栏永远看不到它 —— 用户会以为
    // 订阅没成功。所以没指定分组时落到用户的第一个分组；
    // 一个分组都没有就建一个「默认分组」。
    let targetGroupId = groupId;
    if (!targetGroupId) {
      const firstGroup = await prisma.group.findFirst({
        where: { userId: user.id },
        orderBy: { sortOrder: "asc" },
        select: { id: true },
      });
      targetGroupId = firstGroup
        ? firstGroup.id
        : (
            await prisma.group.create({
              data: { userId: user.id, name: "默认分组", sortOrder: 0 },
              select: { id: true },
            })
          ).id;
    }

    // Create subscription
    //
    // 用 create 会撞 (userId, feedId) 唯一约束 —— 用户在市场页
    // 手快点两下就会 500。这里先查一次，已订阅就直接返回成功
    // 并说明原因，前端会刷新成「已订阅」状态。
    const existing = await prisma.subscription.findUnique({
      where: { userId_feedId: { userId: user.id, feedId: feed.id } },
      include: { feed: true },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        data: { subscription: existing },
        message: "已经订阅过这个源了",
      });
    }

    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        feedId: feed.id,
        groupId: targetGroupId,
        isNotify,
      },
      include: {
        feed: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: { subscription },
      message: "订阅成功",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: "输入数据无效" },
        { status: 400 }
      );
    }

    console.error("Subscribe error:", error);

    // 把「这个源本身有问题」和「服务端崩了」区分开。
    //
    // 之前无论什么错都返回一句「订阅失败」+ 500，用户在界面上
    // 既看不到原因也不知道该不该重试 —— 实测点机核的订阅按钮
    // 就是这种体验：按钮转一下，什么都没有。
    const message =
      error instanceof Error && error.message
        ? `订阅失败：${error.message}`
        : "订阅失败，请稍后重试";

    return NextResponse.json(
      { success: false, message },
      { status: 400 }
    );
  }
}
