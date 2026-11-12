import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { parsePagination } from "@/lib/pagination";
import { readJsonBody } from "@/lib/request";

// 这些接口的返回内容依赖当前登录用户与数据库实时状态，
// 绝不能被 Next 在构建期预渲染成静态文件（会泄漏构建机的数据快照，
// 并且在部署后永远返回同一份旧数据）。
export const dynamic = "force-dynamic";

const addHistorySchema = z.object({
  articleId: z.string(),
});

// GET /api/history - 获取阅读历史
export async function GET(req: Request) {
  try {
    // 验证用户登录
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user } = auth;

    const { searchParams } = new URL(req.url);
    // 分页参数统一夹紧：history 表能有几万行，limit=999999
    // 实测一次返回 253KB。
    const { page, pageSize: limit, skip } = parsePagination(searchParams, "limit");

    const [histories, total] = await Promise.all([
      prisma.readHistory.findMany({
        where: { userId: user.id },
        include: {
          article: {
            include: {
              feed: {
                select: {
                  id: true,
                  title: true,
                  icon: true,
                },
              },
            },
          },
        },
        orderBy: {
          readAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.readHistory.count({
        where: { userId: user.id },
      }),
    ]);

    return NextResponse.json({
      histories: histories.map((h) => ({
        id: h.id,
        articleId: h.articleId,
        readAt: h.readAt,
        article: {
          id: h.article.id,
          title: h.article.title,
          description: h.article.description,
          link: h.article.link,
          author: h.article.author,
          pubDate: h.article.pubDate,
          imageUrl: h.article.imageUrl,
          feed: h.article.feed,
        },
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get history error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "参数错误", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "获取阅读历史失败" },
      { status: 500 }
    );
  }
}

// POST /api/history - 添加阅读历史
export async function POST(req: Request) {
  try {
    // 验证用户登录
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user } = auth;

    const parsed = await readJsonBody(req, "请提供 articleId");
    if (!parsed.ok) return parsed.response;
    const { articleId } = addHistorySchema.parse(parsed.data);

    // 使用 upsert 来更新或创建阅读历史
    const history = await prisma.readHistory.upsert({
      where: {
        userId_articleId: {
          userId: user.id,
          articleId,
        },
      },
      update: {
        readAt: new Date(),
      },
      create: {
        userId: user.id,
        articleId,
      },
      include: {
        article: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return NextResponse.json({
      history: {
        id: history.id,
        articleId: history.articleId,
        readAt: history.readAt,
        article: history.article,
      },
      message: "已记录阅读历史",
    });
  } catch (error) {
    console.error("Add history error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "参数错误", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "记录失败" },
      { status: 500 }
    );
  }
}

// DELETE /api/history - 清空阅读历史
export async function DELETE(req: Request) {
  try {
    // 验证用户登录
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user } = auth;

    const { searchParams } = new URL(req.url);
    const ids = searchParams.get("ids")?.split(",") || [];

    if (ids.length > 0) {
      // 删除指定的历史记录
      await prisma.readHistory.deleteMany({
        where: {
          userId: user.id,
          id: {
            in: ids,
          },
        },
      });

      return NextResponse.json({
        message: `已删除 ${ids.length} 条阅读历史`,
      });
    } else {
      // 清空所有历史记录
      await prisma.readHistory.deleteMany({
        where: { userId: user.id },
      });

      return NextResponse.json({
        message: "已清空阅读历史",
      });
    }
  } catch (error) {
    console.error("Delete history error:", error);
    return NextResponse.json(
      { error: "删除失败" },
      { status: 500 }
    );
  }
}
