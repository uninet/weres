import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { sanitizeArticleHtml, stripLeadingDuplicateTitle } from "@/lib/sanitize";

// 这些接口的返回内容依赖当前登录用户与数据库实时状态，
// 绝不能被 Next 在构建期预渲染成静态文件（会泄漏构建机的数据快照，
// 并且在部署后永远返回同一份旧数据）。
export const dynamic = "force-dynamic";

// GET /api/articles/[id] - 获取单篇文章详情
//
// 安全要点：文章正文属于「用户订阅内容」，不是公开资源。
// 此前该接口无任何鉴权，任何人拿到（或遍历）文章 id 就能读到全文。
// 现在要求登录，且校验该文章所属的 RSS 源确实被当前用户订阅。
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user } = auth;

    const { id } = params;

    const article = await prisma.article.findUnique({
      where: { id },
      include: {
        feed: {
          select: {
            id: true,
            title: true,
            icon: true,
            subscriptions: {
              where: { userId: user.id },
              select: { id: true },
            },
          },
        },
      },
    });

    // 文章不存在，或不属于当前用户的订阅范围 —— 统一返回 404，
    // 避免通过状态码差异枚举出「哪些 id 存在」。
    if (!article || article.feed.subscriptions.length === 0) {
      return NextResponse.json(
        { success: false, message: "文章不存在" },
        { status: 404 }
      );
    }

    // 不要把内部关联字段透出去
    const { subscriptions: _ignored, ...feed } = article.feed;

    return NextResponse.json({
      success: true,
      data: {
        ...article,
        feed,
        // 正文来自第三方站点，必须净化后再交给前端
        // dangerouslySetInnerHTML 渲染，否则可被注入任意脚本。
        // 先净化再剥重复标题：净化会拆掉原文的包裹层，
        // 顺序反了会让「标题 + 页头」粘在同一个块里，剥不干净。
        content: stripLeadingDuplicateTitle(
          sanitizeArticleHtml(article.content),
          article.title
        ),
      },
    });
  } catch (error) {
    console.error("Get article error:", error);
    return NextResponse.json(
      { success: false, message: "获取文章失败" },
      { status: 500 }
    );
  }
}
