import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/auth";

// 这些接口的返回内容依赖当前登录用户与数据库实时状态，
// 绝不能被 Next 在构建期预渲染成静态文件（会泄漏构建机的数据快照，
// 并且在部署后永远返回同一份旧数据）。
export const dynamic = "force-dynamic";

// POST /api/articles/:id/read - 标记文章为已读
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "未登录" },
        { status: 401 }
      );
    }

    const articleId = params.id;

    // 验证文章是否存在
    const article = await prisma.article.findUnique({
      where: { id: articleId },
      include: {
        feed: true,
      },
    });

    if (!article) {
      return NextResponse.json(
        { success: false, message: "文章不存在" },
        { status: 404 }
      );
    }

    // 检查用户是否已订阅该RSS源
    const subscription = await prisma.subscription.findUnique({
      where: {
        userId_feedId: {
          userId: user.id,
          feedId: article.feedId,
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, message: "您未订阅该RSS源" },
        { status: 403 }
      );
    }

    // 创建或更新阅读历史
    const readHistory = await prisma.readHistory.upsert({
      where: {
        userId_articleId: {
          userId: user.id,
          articleId: articleId,
        },
      },
      update: {
        readAt: new Date(),
      },
      create: {
        userId: user.id,
        articleId: articleId,
        readAt: new Date(),
      },
    });

    // 关系过滤而不是 notIn：已读数过千时会撞 SQLite 绑定变量上限（P2029）。
    // 这个接口每读一篇文章都要跑两次未读统计，是最高频的路径之一。
    const unreadCount = await prisma.article.count({
      where: {
        feedId: article.feedId,
        readHistories: { none: { userId: user.id } },
      },
    });

    // 获取用户所有未读文章总数
    const totalUnreadCount = await prisma.article.count({
      where: {
        feed: {
          subscriptions: {
            some: {
              userId: user.id,
            },
          },
        },
        readHistories: { none: { userId: user.id } },
      },
    });

    return NextResponse.json({
      success: true,
      message: "已标记为已读",
      data: {
        readHistory,
        articleId,
        feedUnreadCount: unreadCount,
        totalUnreadCount,
      },
    });
  } catch (error) {
    console.error("Mark as read error:", error);
    return NextResponse.json(
      { success: false, message: "标记已读失败" },
      { status: 500 }
    );
  }
}

// DELETE /api/articles/:id/read - 标记文章为未读
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "未登录" },
        { status: 401 }
      );
    }

    const articleId = params.id;

    // 删除阅读历史记录
    await prisma.readHistory.deleteMany({
      where: {
        userId: user.id,
        articleId: articleId,
      },
    });

    // 获取文章信息
    const article = await prisma.article.findUnique({
      where: { id: articleId },
    });

    if (!article) {
      return NextResponse.json(
        { success: false, message: "文章不存在" },
        { status: 404 }
      );
    }

    // 获取该RSS源的未读文章数量
    // 关系过滤而不是 notIn：已读数过千时会撞 SQLite 绑定变量上限（P2029）。
    // 这个接口每读一篇文章都要跑两次未读统计，是最高频的路径之一。
    const unreadCount = await prisma.article.count({
      where: {
        feedId: article.feedId,
        readHistories: { none: { userId: user.id } },
      },
    });

    // 获取用户所有未读文章总数
    const totalUnreadCount = await prisma.article.count({
      where: {
        feed: {
          subscriptions: {
            some: {
              userId: user.id,
            },
          },
        },
        readHistories: { none: { userId: user.id } },
      },
    });

    return NextResponse.json({
      success: true,
      message: "已标记为未读",
      data: {
        articleId,
        feedUnreadCount: unreadCount,
        totalUnreadCount,
      },
    });
  } catch (error) {
    console.error("Mark as unread error:", error);
    return NextResponse.json(
      { success: false, message: "标记未读失败" },
      { status: 500 }
    );
  }
}

// GET /api/articles/:id/read - 检查文章是否已读
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: "未登录" },
        { status: 401 }
      );
    }

    const articleId = params.id;

    const readHistory = await prisma.readHistory.findUnique({
      where: {
        userId_articleId: {
          userId: user.id,
          articleId: articleId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        isRead: !!readHistory,
        readAt: readHistory?.readAt || null,
      },
    });
  } catch (error) {
    console.error("Check read status error:", error);
    return NextResponse.json(
      { success: false, message: "检查阅读状态失败" },
      { status: 500 }
    );
  }
}
