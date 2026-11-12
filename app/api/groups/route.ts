import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import { readJsonBody } from "@/lib/request";

// 这些接口的返回内容依赖当前登录用户与数据库实时状态，
// 绝不能被 Next 在构建期预渲染成静态文件（会泄漏构建机的数据快照，
// 并且在部署后永远返回同一份旧数据）。
export const dynamic = "force-dynamic";

const createGroupSchema = z.object({
  name: z.string().min(1).max(50),
  sortOrder: z.number().optional().default(0),
});

// GET /api/groups - 获取用户的所有分组和订阅
export async function GET(req: Request) {
  try {
    // 允许访客访问
    const auth = await requireAuth(req, { allowGuest: true });
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user, isGuest } = auth;

    const groups = await prisma.group.findMany({
      where: { userId: user.id },
      include: {
        subscriptions: {
          include: {
            feed: {
              select: {
                id: true,
                url: true,
                title: true,
                description: true,
                icon: true,
                category: true,
                lastSyncAt: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        sortOrder: "asc",
      },
    });

    // 顺手补上每个源的未读文章数。
    // 前端侧边栏要显示未读数；如果这里不返回，前端就只能瞎猜
    // （改动前它确实是用 Math.random() 造的假数字）。
    const readHistories = await prisma.readHistory.findMany({
      where: { userId: user.id },
      select: { articleId: true },
    });
    const readIds = readHistories.map((h) => h.articleId);

    const feedIds = groups.flatMap((group) =>
      group.subscriptions.map((sub) => sub.feedId)
    );

    // groupBy 一次拿到所有源的未读数，避免在循环里对每个源各发一次 count
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

    const groupsWithUnread = groups.map((group) => ({
      ...group,
      subscriptions: group.subscriptions.map((sub) => ({
        ...sub,
        unreadCount: unreadMap.get(sub.feedId) ?? 0,
      })),
    }));

    // 兜底：把 groupId 为 null 的订阅也返回给左栏。
    //
    // 历史上从市场页订阅的记录没带 groupId（那时代码没做默认分组），
    // 这些订阅在 /api/groups 里查不到，用户在左栏就看不到自己订的源，
    // 会以为订阅失败。这里把它们归到一个虚拟的「未分组」里返回，
    // 既不丢数据，也不强制改库。
    const ungroupedSubs = await prisma.subscription.findMany({
      where: { userId: user.id, groupId: null },
      include: {
        feed: {
          select: {
            id: true,
            url: true,
            title: true,
            description: true,
            icon: true,
            category: true,
            lastSyncAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (ungroupedSubs.length > 0) {
      const ungroupedFeedIds = ungroupedSubs.map((sub) => sub.feedId);
      const ungroupedUnread = await prisma.article.groupBy({
        by: ["feedId"],
        where: {
          feedId: { in: ungroupedFeedIds },
          id: { notIn: readIds.length > 0 ? readIds : [""] },
        },
        _count: { _all: true },
      });
      const ungroupedUnreadMap = new Map(
        ungroupedUnread.map((row) => [row.feedId, row._count._all])
      );

      groupsWithUnread.unshift({
        // 用固定 id 让前端可以把它们当成一个普通分组渲染
        id: "ungrouped",
        name: "未分组",
        userId: user.id,
        sortOrder: -1,
        createdAt: new Date(),
        subscriptions: ungroupedSubs.map((sub) => ({
          ...sub,
          unreadCount: ungroupedUnreadMap.get(sub.feedId) ?? 0,
        })),
      });
    }

    return NextResponse.json({
      success: true,
      data: groupsWithUnread,
      isGuest,
    });
  } catch (error) {
    console.error("Get groups error:", error);
    return NextResponse.json(
      { success: false, message: "获取分组失败" },
      { status: 500 }
    );
  }
}

// POST /api/groups - 创建新分组
export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user, isGuest } = auth;

    // 访客模式不允许创建分组
    if (isGuest) {
      return NextResponse.json(
        { success: false, message: "访客模式下无法创建分组" },
        { status: 403 }
      );
    }

    const parsed = await readJsonBody(req, "请提供分组名称");
    if (!parsed.ok) return parsed.response;
    const { name, sortOrder = 0 } = createGroupSchema.parse(parsed.data);

    const group = await prisma.group.create({
      data: {
        userId: user.id,
        name,
        sortOrder,
      },
    });

    return NextResponse.json({
      success: true,
      data: group,
      message: "分组创建成功",
    });
  } catch (error) {
    console.error("Create group error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: "分组名称无效" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: "创建分组失败" },
      { status: 500 }
    );
  }
}

const updateGroupSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  sortOrder: z.number().optional(),
});

// PATCH /api/groups?id=xxx - 重命名分组或调整排序
//
// 为什么用 query 里的 id 而不是 /api/groups/[id]：
// 前端页面已经按 `?id=` 组织请求，另开一个动态路由只会让同一资源
// 有两套地址，反而容易调错。
export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user, isGuest } = auth;

    if (isGuest) {
      return NextResponse.json(
        { success: false, message: "访客模式下无法修改分组" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { success: false, message: "缺少分组 id" },
        { status: 400 }
      );
    }

    // 必须先确认这个分组属于当前用户。
    // 直接用 update({ where: { id } }) 会允许任何人按 id 改别人的分组。
    const existing = await prisma.group.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "分组不存在" },
        { status: 404 }
      );
    }

    const parsed = await readJsonBody(req, "请提供要修改的分组字段");
    if (!parsed.ok) return parsed.response;
    const data = updateGroupSchema.parse(parsed.data);

    const group = await prisma.group.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      success: true,
      data: group,
      message: "分组已更新",
    });
  } catch (error) {
    console.error("Update group error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: "分组名称无效" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: "更新分组失败" },
      { status: 500 }
    );
  }
}

// DELETE /api/groups?id=xxx - 删除分组
//
// 分组和订阅是一对多关系（Subscription.groupId 可空）。
// 直接 delete 会让 Prisma 把订阅的 groupId 置空（onDelete: SetNull），
// 订阅本身保留 —— 这正是想要的效果：删分组不等于取消订阅。
export async function DELETE(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user, isGuest } = auth;

    if (isGuest) {
      return NextResponse.json(
        { success: false, message: "访客模式下无法删除分组" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { success: false, message: "缺少分组 id" },
        { status: 400 }
      );
    }

    const existing = await prisma.group.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, message: "分组不存在" },
        { status: 404 }
      );
    }

    await prisma.group.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "分组已删除，其中的订阅已移到未分组",
    });
  } catch (error) {
    console.error("Delete group error:", error);
    return NextResponse.json(
      { success: false, message: "删除分组失败" },
      { status: 500 }
    );
  }
}
