import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

// 返回内容依赖当前登录用户，绝不能被构建期预渲染
export const dynamic = "force-dynamic";

const createTagSchema = z.object({
  name: z.string().trim().min(1, "标签名不能为空").max(20, "标签名最多 20 个字"),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "颜色必须是 #RRGGBB 格式")
    .optional(),
});

/**
 * GET /api/tags
 *
 * 返回当前用户的全部标签，附带每个标签下的文章数。
 *
 * 为什么带计数：用户建了十几个标签之后，「哪个标签是空的、
 * 哪个有几十篇文章」是决定要不要继续用它的主要依据。
 */
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user, isGuest } = auth;

    if (isGuest) {
      return NextResponse.json({
        success: true,
        data: { tags: [] },
      });
    }

    const tags = await prisma.tag.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        color: true,
        createdAt: true,
        _count: { select: { articleTags: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        tags: tags.map((tag) => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          createdAt: tag.createdAt,
          articleCount: tag._count.articleTags,
        })),
      },
    });
  } catch (error) {
    console.error("Get tags error:", error);
    return NextResponse.json(
      { success: false, message: "获取标签失败" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tags
 *
 * 新建标签。同名标签返回已有那个而不是报错 ——
 * 用户在打标签时重复输入同一个名字是很常见的，
 * 报「已存在」等于把一次误操作变成一次失败。
 */
export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user, isGuest } = auth;

    if (isGuest) {
      return NextResponse.json(
        { success: false, message: "访客模式下无法创建标签" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = createTagSchema.parse(body);

    // schema 里 @@unique([userId, name])，先查再建，避免撞唯一约束报 500
    const existing = await prisma.tag.findUnique({
      where: { userId_name: { userId: user.id, name: parsed.name } },
      select: { id: true, name: true, color: true },
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        data: existing,
        message: "已存在同名标签",
      });
    }

    const tag = await prisma.tag.create({
      data: {
        userId: user.id,
        name: parsed.name,
        color: parsed.color || "#3B82F6",
      },
      select: { id: true, name: true, color: true },
    });

    return NextResponse.json({
      success: true,
      data: tag,
      message: "标签已创建",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: error.issues[0]?.message || "标签名无效" },
        { status: 400 }
      );
    }
    console.error("Create tag error:", error);
    return NextResponse.json(
      { success: false, message: "创建标签失败" },
      { status: 500 }
    );
  }
}
