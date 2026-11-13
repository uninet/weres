import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUserFromRequest } from "@/lib/auth";

// 这些接口的返回内容依赖当前登录用户与数据库实时状态，
// 绝不能被 Next 在构建期预渲染成静态文件（会泄漏构建机的数据快照，
// 并且在部署后永远返回同一份旧数据）。
export const dynamic = "force-dynamic";

// POST /api/articles/:id/favorite - 收藏文章
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
    });

    if (!article) {
      return NextResponse.json(
        { success: false, message: "文章不存在" },
        { status: 404 }
      );
    }

    // 归属校验：只能对「自己订阅的源」里的文章做收藏操作。
    //
    // 不加这一步时，任何人拿到一个 articleId 就能收藏别人的文章，
    // 再通过 GET /api/favorites 看到它的标题、链接、作者、摘要 ——
    // 收藏夹从这个角度看是一个越权读文章的旁路。
    // 与 read 路由保持同一判据：未订阅一律 404（不是 403），
    // 避免用状态码差异枚举出「这个 id 是否存在」。
    const subscription = await prisma.subscription.findUnique({
      where: {
        userId_feedId: {
          userId: user.id,
          feedId: article.feedId,
        },
      },
      select: { id: true },
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, message: "文章不存在" },
        { status: 404 }
      );
    }

    // 创建收藏记录
    const favorite = await prisma.favorite.upsert({
      where: {
        userId_articleId: {
          userId: user.id,
          articleId: articleId,
        },
      },
      update: {},
      create: {
        userId: user.id,
        articleId: articleId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "已添加到收藏",
      data: {
        favorite,
        articleId,
        isFavorited: true,
      },
    });
  } catch (error) {
    console.error("Add favorite error:", error);
    return NextResponse.json(
      { success: false, message: "添加收藏失败" },
      { status: 500 }
    );
  }
}

// DELETE /api/articles/:id/favorite - 取消收藏
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

    // 删除收藏记录
    await prisma.favorite.deleteMany({
      where: {
        userId: user.id,
        articleId: articleId,
      },
    });

    return NextResponse.json({
      success: true,
      message: "已取消收藏",
      data: {
        articleId,
        isFavorited: false,
      },
    });
  } catch (error) {
    console.error("Remove favorite error:", error);
    return NextResponse.json(
      { success: false, message: "取消收藏失败" },
      { status: 500 }
    );
  }
}

// GET /api/articles/:id/favorite - 检查文章是否已收藏
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

    const favorite = await prisma.favorite.findUnique({
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
        isFavorited: !!favorite,
        favoritedAt: favorite?.createdAt || null,
      },
    });
  } catch (error) {
    console.error("Check favorite status error:", error);
    return NextResponse.json(
      { success: false, message: "检查收藏状态失败" },
      { status: 500 }
    );
  }
}
