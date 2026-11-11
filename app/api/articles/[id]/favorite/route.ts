import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

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
    const user = await getCurrentUser();
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
    const user = await getCurrentUser();
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
    const user = await getCurrentUser();
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
