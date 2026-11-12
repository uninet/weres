import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { parsePagination } from "@/lib/pagination";

// 这些接口的返回内容依赖当前登录用户与数据库实时状态，
// 绝不能被 Next 在构建期预渲染成静态文件（会泄漏构建机的数据快照，
// 并且在部署后永远返回同一份旧数据）。
export const dynamic = "force-dynamic";

// GET /api/notifications - 获取通知列表
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user } = auth;

    const { searchParams } = new URL(req.url);
    // 分页参数统一夹紧，其余参数仍走 zod 校验
    const { page, pageSize: limit, skip } = parsePagination(searchParams, "limit");
    const unreadOnly = searchParams.get("unreadOnly") === "true";

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

// PATCH /api/notifications - 标记通知为已读
export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user } = auth;

    // 空 body 会让 req.json() 抛 SyntaxError，落到下面的 catch 变成 500 ——
    // 但这是调用方少传了参数，属于 400。改成自己兜住。
    let body: { ids?: string[]; markAll?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "请提供要标记的通知 ID，或设置 markAll" },
        { status: 400 }
      );
    }
    const { ids, markAll } = body || {};

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
      const result = await prisma.notification.updateMany({
        where: {
          userId: user.id,
          id: { in: ids },
        },
        data: { isRead: true },
      });

      // 用实际改动条数而不是请求里的 id 数量：传了别人的 id 时
      // where 会把它过滤掉，`ids.length` 会报出一个并不存在的战绩。
      return NextResponse.json({
        message: `已标记 ${result.count} 条通知为已读`,
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
      const result = await prisma.notification.deleteMany({
        where: {
          userId: user.id,
          id: { in: ids },
        },
      });

      // 同上：报实际删除条数。传了不属于自己的 id 时这里是 0，
      // 而不是请求里有几个 id 就报几个。
      return NextResponse.json({
        message: result.count > 0 ? `已删除 ${result.count} 条通知` : "没有可删除的通知",
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
