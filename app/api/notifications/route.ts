import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";

// 这些接口的返回内容依赖当前登录用户与数据库实时状态，
// 绝不能被 Next 在构建期预渲染成静态文件（会泄漏构建机的数据快照，
// 并且在部署后永远返回同一份旧数据）。
export const dynamic = "force-dynamic";

const getNotificationsSchema = z.object({
  page: z.string().optional().default("1"),
  limit: z.string().optional().default("20"),
  unreadOnly: z.string().optional().default("false"),
});

const createNotificationSchema = z.object({
  userId: z.string(),
  type: z.string(),
  title: z.string(),
  content: z.string().optional(),
  data: z.string().optional(),
});

// GET /api/notifications - 获取通知列表
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user } = auth;

    const { searchParams } = new URL(req.url);
    const params = getNotificationsSchema.parse({
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "20",
      unreadOnly: searchParams.get("unreadOnly") || "false",
    });

    const page = parseInt(params.page);
    const limit = parseInt(params.limit);
    const skip = (page - 1) * limit;
    const unreadOnly = params.unreadOnly === "true";

    const where = {
      userId: user.id,
      ...(unreadOnly && { isRead: false }),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId: user.id, isRead: false },
      }),
    ]);

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        content: n.content,
        data: n.data,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    });
  } catch (error) {
    console.error("Get notifications error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "参数错误", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "获取通知列表失败" },
      { status: 500 }
    );
  }
}

// POST /api/notifications - 创建通知（系统内部使用）
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, type, title, content, data } = createNotificationSchema.parse(body);

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        content,
        data,
      },
    });

    return NextResponse.json({
      notification: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        content: notification.content,
        data: notification.data,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      },
    });
  } catch (error) {
    console.error("Create notification error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "参数错误", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "创建通知失败" },
      { status: 500 }
    );
  }
}

// PATCH /api/notifications - 标记通知为已读
export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user } = auth;

    const body = await req.json();
    const { ids, markAll } = body;

    if (markAll) {
      // 标记所有通知为已读
      await prisma.notification.updateMany({
        where: { userId: user.id, isRead: false },
        data: { isRead: true },
      });

      return NextResponse.json({
        message: "已标记所有通知为已读",
      });
    } else if (ids && ids.length > 0) {
      // 标记指定通知为已读
      await prisma.notification.updateMany({
        where: {
          userId: user.id,
          id: { in: ids },
        },
        data: { isRead: true },
      });

      return NextResponse.json({
        message: `已标记 ${ids.length} 条通知为已读`,
      });
    } else {
      return NextResponse.json(
        { error: "请提供通知 ID 或设置 markAll" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Mark notifications read error:", error);
    return NextResponse.json(
      { error: "标记已读失败" },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications - 删除通知
export async function DELETE(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user } = auth;

    const { searchParams } = new URL(req.url);
    const ids = searchParams.get("ids")?.split(",") || [];
    const deleteAll = searchParams.get("all") === "true";

    if (deleteAll) {
      // 删除所有通知
      await prisma.notification.deleteMany({
        where: { userId: user.id },
      });

      return NextResponse.json({
        message: "已清空所有通知",
      });
    } else if (ids.length > 0) {
      // 删除指定通知
      await prisma.notification.deleteMany({
        where: {
          userId: user.id,
          id: { in: ids },
        },
      });

      return NextResponse.json({
        message: `已删除 ${ids.length} 条通知`,
      });
    } else {
      return NextResponse.json(
        { error: "请提供通知 ID 或设置 all=true" },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Delete notifications error:", error);
    return NextResponse.json(
      { error: "删除通知失败" },
      { status: 500 }
    );
  }
}
