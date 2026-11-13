import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/request";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

// 返回内容依赖当前登录用户，绝不能被构建期预渲染
export const dynamic = "force-dynamic";

const attachSchema = z.object({
  tagId: z.string().min(1),
});

/**
 * GET /api/articles/[id]/tags
 *
 * 这篇文章上打了哪些标签。
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user, isGuest } = auth;

    if (isGuest) {
      return NextResponse.json({ success: true, data: { tags: [] } });
    }

    // 只返回属于当前用户的标签 —— ArticleTag 本身不带 userId，
    // 不在这里过滤就会把别人的标签名也显示出来
    const links = await prisma.articleTag.findMany({
      where: { articleId: params.id, tag: { userId: user.id } },
      select: { tag: { select: { id: true, name: true, color: true } } },
    });

    return NextResponse.json({
      success: true,
      data: { tags: links.map((link) => link.tag) },
    });
  } catch (error) {
    console.error("Get article tags error:", error);
    return NextResponse.json(
      { success: false, message: "获取文章标签失败" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/articles/[id]/tags
 *
 * 给文章打一个标签。已经打过就静默成功（幂等）。
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user, isGuest } = auth;

    if (isGuest) {
      return NextResponse.json(
        { success: false, message: "访客模式下无法打标签" },
        { status: 403 }
      );
    }

    const parsedBody = await readJsonBody<{ tagId?: string }>(req, "请提供要关联的标签 ID");
    if (!parsedBody.ok) return parsedBody.response;
    const { tagId } = attachSchema.parse(parsedBody.data);

    // 两件事都必须校验：
    //   1. 标签属于当前用户（否则可以往自己文章上贴别人的标签）
    //   2. 文章属于自己订阅的源（否则可以按 id 给别人的文章打标签）
    const [tag, article] = await Promise.all([
      prisma.tag.findFirst({
        where: { id: tagId, userId: user.id },
        select: { id: true, name: true, color: true },
      }),
      prisma.article.findFirst({
        where: {
          id: params.id,
          feed: { subscriptions: { some: { userId: user.id } } },
        },
        select: { id: true },
      }),
    ]);

    if (!tag) {
      return NextResponse.json(
        { success: false, message: "标签不存在" },
        { status: 404 }
      );
    }
    if (!article) {
      return NextResponse.json(
        { success: false, message: "文章不存在或未订阅该源" },
        { status: 404 }
      );
    }

    const existing = await prisma.articleTag.findUnique({
      where: { articleId_tagId: { articleId: params.id, tagId } },
      select: { id: true },
    });

    if (!existing) {
      await prisma.articleTag.create({
        data: { articleId: params.id, tagId },
      });
    }

    return NextResponse.json({
      success: true,
      data: tag,
      message: existing ? "已经打过这个标签了" : "标签已添加",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: "缺少标签 id" },
        { status: 400 }
      );
    }
    console.error("Attach tag error:", error);
    return NextResponse.json(
      { success: false, message: "添加标签失败" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/articles/[id]/tags?tagId=xxx
 *
 * 取消文章上的某个标签。标签本身不删。
 */
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user, isGuest } = auth;

    if (isGuest) {
      return NextResponse.json(
        { success: false, message: "访客模式下无法修改标签" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const tagId = searchParams.get("tagId");
    if (!tagId) {
      return NextResponse.json(
        { success: false, message: "缺少标签 id" },
        { status: 400 }
      );
    }

    const deleted = await prisma.articleTag.deleteMany({
      where: {
        articleId: params.id,
        tagId,
        // 同样要确认这个标签是自己的
        tag: { userId: user.id },
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        { success: false, message: "这篇文章没有该标签" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "标签已移除",
    });
  } catch (error) {
    console.error("Detach tag error:", error);
    return NextResponse.json(
      { success: false, message: "移除标签失败" },
      { status: 500 }
    );
  }
}
