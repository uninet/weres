import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeArticleHtml } from "@/lib/sanitize";
import Parser from "rss-parser";

const rssParser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'WeRSS/1.0 RSS Reader'
  }
});

/**
 * POST /api/sync/[feedId]
 * 同步单个 RSS 订阅源
 * 需要认证
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { feedId: string } }
) {
  try {
    // 验证用户身份
    const token = request.cookies.get("token")?.value;
    if (!token) {
      return NextResponse.json(
        { success: false, message: "未登录" },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, message: "无效的 token" },
        { status: 401 }
      );
    }

    const userId = payload.sub;
    const feedId = params.feedId;

    if (!feedId) {
      return NextResponse.json(
        { success: false, message: "缺少订阅源 ID" },
        { status: 400 }
      );
    }

    // 获取订阅源信息
    const subscription = await prisma.subscription.findFirst({
      where: {
        userId,
        feedId,
      },
      include: {
        feed: true,
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, message: "订阅源不存在" },
        { status: 404 }
      );
    }

    // 解析 RSS feed
    const feedData = await rssParser.parseURL(subscription.feed.url);

    // 同步文章
    let newArticlesCount = 0;
    for (const item of feedData.items || []) {
      try {
        // 检查文章是否已存在
        const existingArticle = await prisma.article.findFirst({
          where: {
            feedId: subscription.feed.id,
            link: item.link || item.guid,
          },
        });

        if (!existingArticle) {
          // 创建新文章
          await prisma.article.create({
            data: {
              feedId: subscription.feed.id,
              title: item.title || "无标题",
              link: item.link || item.guid || "",
              description: item.contentSnippet || item.content || "",
              // 第三方 HTML 必须先净化再入库（不可信输入）
              content: sanitizeArticleHtml(
                item["content:encoded"] || item.content || item.contentSnippet || ""
              ),
              author: item.creator || item.author,
              pubDate: item.pubDate ? new Date(item.pubDate) : new Date(),
              guid: item.guid || item.link,
            },
          });
          newArticlesCount++;
        }
      } catch (error) {
        console.error("保存文章失败:", error);
        // 继续处理下一篇文章
      }
    }

    // 更新订阅源最后同步时间
    await prisma.feed.update({
      where: { id: subscription.feed.id },
      data: {
        lastSyncAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        feedId: subscription.feed.id,
        feedTitle: subscription.feed.title,
        newArticles: newArticlesCount,
        totalArticles: feedData.items?.length || 0,
      },
    });
  } catch (error) {
    console.error("同步订阅源失败:", error);
    return NextResponse.json(
      { success: false, message: "同步失败，请稍后重试" },
      { status: 500 }
    );
  }
}
