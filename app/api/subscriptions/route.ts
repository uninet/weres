import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { readJsonBody } from "@/lib/request";

// 这些接口的返回内容依赖当前登录用户与数据库实时状态，
// 绝不能被 Next 在构建期预渲染成静态文件（会泄漏构建机的数据快照，
// 并且在部署后永远返回同一份旧数据）。
export const dynamic = "force-dynamic";

// GET /api/subscriptions - 获取当前登录用户的所有订阅
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
        feed: {
          select: {
            id: true,
            title: true,
            description: true,
            icon: true,
            url: true,
            category: true,
            lastSyncAt: true,
            syncStatus: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      data: subscriptions,
    });
  } catch (error) {
    console.error("Get subscriptions error:", error);
    return NextResponse.json(
      { success: false, message: "获取订阅失败" },
      { status: 500 }
    );
  }
}

// POST /api/subscriptions - 创建新订阅
export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user } = auth;

    const parsed = await readJsonBody<{ feedId?: string; groupId?: string; isNotify?: boolean }>(
      req,
      "请提供 feedId"
    );
    if (!parsed.ok) return parsed.response;
    const { feedId, groupId, isNotify = true } = parsed.data;

    if (!feedId) {
      return NextResponse.json(
        { success: false, message: "RSS源ID不能为空" },
        { status: 400 }
      );
    }

    // 检查RSS源是否存在
    const feed = await prisma.feed.findUnique({
      where: { id: feedId },
    });

    if (!feed) {
      return NextResponse.json(
        { success: false, message: "RSS源不存在" },
        { status: 404 }
      );
    }

    // 检查是否已经订阅
    const existingSubscription = await prisma.subscription.findUnique({
      where: {
        userId_feedId: {
          userId: user.id,
          feedId: feedId,
        },
      },
    });

    if (existingSubscription) {
      return NextResponse.json(
        { success: false, message: "已经订阅过该RSS源" },
        { status: 409 }
      );
    }

    // 如果没有指定分组，使用默认分组
    let targetGroupId = groupId;
    if (!targetGroupId) {
      const defaultGroup = await prisma.group.findFirst({
        where: {
          userId: user.id,
          name: "未分组",
        },
      });
      if (defaultGroup) {
        targetGroupId = defaultGroup.id;
      }
    }

    // 创建订阅
    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        feedId: feedId,
        groupId: targetGroupId,
        isNotify: isNotify,
      },
      include: {
        feed: {
          select: {
            id: true,
            title: true,
            description: true,
            icon: true,
            url: true,
          },
        },
      },
    });

    // 更新marketFeed的订阅数
    await prisma.marketFeed.updateMany({
      where: { feedId: feedId },
      data: {
        subscriberCount: {
          increment: 1,
        },
      },
    });

    // 触发RSS源同步
    await syncFeedArticles(feedId);

    return NextResponse.json({
      success: true,
      data: subscription,
      message: "订阅成功",
    });
  } catch (error) {
    console.error("Create subscription error:", error);
    return NextResponse.json(
      { success: false, message: "订阅失败" },
      { status: 500 }
    );
  }
}

// DELETE /api/subscriptions - 取消订阅
export async function DELETE(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user } = auth;

    const { searchParams } = new URL(req.url);
    const feedId = searchParams.get("feedId");

    if (!feedId) {
      return NextResponse.json(
        { success: false, message: "RSS源ID不能为空" },
        { status: 400 }
      );
    }

    // 删除订阅，并记录实际删除条数
    const deleted = await prisma.subscription.deleteMany({
      where: {
        userId: user.id,
        feedId: feedId,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { success: false, message: "未找到该订阅" },
        { status: 404 }
      );
    }

    // 只有在真的删掉订阅后才递减订阅数，避免计数被减成负数
    await prisma.marketFeed.updateMany({
      where: { feedId: feedId },
      data: {
        subscriberCount: {
          decrement: deleted.count,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: "取消订阅成功",
    });
  } catch (error) {
    console.error("Delete subscription error:", error);
    return NextResponse.json(
      { success: false, message: "取消订阅失败" },
      { status: 500 }
    );
  }
}

// 标记RSS源同步状态
//
// 说明：这里原本有一段「假装同步成功」的占位逻辑，会在没有真正抓取任何内容
// 的情况下把 syncStatus 置为 SUCCESS，造成「界面上显示同步成功、实际没有新文章」。
// 真正的抓取逻辑在 lib/rss-parser.ts 里，由 /api/sync 负责调用。
async function syncFeedArticles(feedId: string) {
  try {
    await prisma.feed.update({
      where: { id: feedId },
      data: {
        syncStatus: "PENDING",
        lastSyncAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Mark feed pending error:", error);
  }
}
