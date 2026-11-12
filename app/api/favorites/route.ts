import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { parsePagination } from "@/lib/pagination";
import { readJsonBody } from "@/lib/request";
import { sanitizePlainText } from "@/lib/sanitize";

// 这些接口的返回内容依赖当前登录用户与数据库实时状态，
// 绝不能被 Next 在构建期预渲染成静态文件（会泄漏构建机的数据快照，
// 并且在部署后永远返回同一份旧数据）。
export const dynamic = "force-dynamic";

const toggleFavoriteSchema = z.object({
  articleId: z.string(),
});

// GET /api/favorites - 获取收藏列表
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user } = auth;

    const { searchParams } = new URL(req.url);
    const keyword = searchParams.get("search")?.trim() || "";

    // 分页参数统一夹紧（limit=999999 会一次拉出整表）
    const { page, pageSize: limit, skip } = parsePagination(searchParams, "limit");

    const where = {
      userId: user.id,
      // 注意：这里不能用 `mode: "insensitive"`。SQLite 的 LIKE 本来
      // 就不区分大小写，但 Prisma 的 sqlite provider 不支持这个参数，
      // 传了会直接报 "Unknown argument `mode`" —— 实测 /api/favorites
      // ?search=React 因此一直返回 500。
      ...(keyword && {
        article: {
          title: { contains: keyword },
        },
      }),
    };

    const [favorites, total] = await Promise.all([
      prisma.favorite.findMany({
        where,
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
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.favorite.count({ where }),
    ]);

    return NextResponse.json({
      favorites: favorites.map((f) => ({
        id: f.id,
        articleId: f.articleId,
        createdAt: f.createdAt,
        article: {
          id: f.article.id,
          title: f.article.title,
          // description 来自第三方 RSS，历史数据里可能残留 HTML 片段（写入口
          // 加固前入库的），出库再净化一次，否则列表会显示标签源码。
          description: sanitizePlainText(f.article.description),
          link: f.article.link,
          author: f.article.author,
          pubDate: f.article.pubDate,
          imageUrl: f.article.imageUrl,
          feed: f.article.feed,
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
    console.error("Get favorites error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "参数错误", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "获取收藏列表失败" },
      { status: 500 }
    );
  }
}

// POST /api/favorites - 添加/取消收藏
export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user } = auth;

    const parsed = await readJsonBody(req, "请提供 articleId");
    if (!parsed.ok) return parsed.response;
    const { articleId } = toggleFavoriteSchema.parse(parsed.data);

    // 检查是否已收藏
    const existingFavorite = await prisma.favorite.findUnique({
      where: {
        userId_articleId: {
          userId: user.id,
          articleId,
        },
      },
    });

    if (existingFavorite) {
      // 取消收藏
      await prisma.favorite.delete({
        where: {
          id: existingFavorite.id,
        },
      });

      return NextResponse.json({
        isFavorited: false,
        message: "已取消收藏",
      });
    } else {
      // 添加收藏
      const favorite = await prisma.favorite.create({
        data: {
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
        isFavorited: true,
        favorite: {
          id: favorite.id,
          articleId: favorite.articleId,
          createdAt: favorite.createdAt,
          article: favorite.article,
        },
        message: "收藏成功",
      });
    }
  } catch (error) {
    console.error("Toggle favorite error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "参数错误", details: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "操作失败" },
      { status: 500 }
    );
  }
}

// DELETE /api/favorites - 批量删除收藏
export async function DELETE(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user } = auth;

    const { searchParams } = new URL(req.url);
    const ids = searchParams.get("ids")?.split(",") || [];

    if (ids.length === 0) {
      return NextResponse.json(
        { error: "请选择要删除的收藏" },
        { status: 400 }
      );
    }

    await prisma.favorite.deleteMany({
      where: {
        userId: user.id,
        id: {
          in: ids,
        },
      },
    });

    return NextResponse.json({
      message: `已删除 ${ids.length} 个收藏`,
    });
  } catch (error) {
    console.error("Delete favorites error:", error);
    return NextResponse.json(
      { error: "删除失败" },
      { status: 500 }
    );
  }
}
