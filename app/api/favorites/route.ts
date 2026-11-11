import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";

// 这些接口的返回内容依赖当前登录用户与数据库实时状态，
// 绝不能被 Next 在构建期预渲染成静态文件（会泄漏构建机的数据快照，
// 并且在部署后永远返回同一份旧数据）。
export const dynamic = "force-dynamic";

const toggleFavoriteSchema = z.object({
  articleId: z.string(),
});

const getFavoritesSchema = z.object({
  page: z.string().optional().default("1"),
  limit: z.string().optional().default("20"),
  search: z.string().optional(),
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
    const params = getFavoritesSchema.parse({
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "20",
      search: searchParams.get("search") || undefined,
    });

    const page = parseInt(params.page);
    const limit = parseInt(params.limit);
    const skip = (page - 1) * limit;

    const where = {
      userId: user.id,
      ...(params.search && {
        article: {
          title: {
            contains: params.search,
            mode: "insensitive" as const,
          },
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
          description: f.article.description,
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

    const body = await req.json();
    const { articleId } = toggleFavoriteSchema.parse(body);

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
