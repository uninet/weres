import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { parseRSS } from "@/lib/rss-parser";

export const dynamic = "force-dynamic";

/**
 * POST /api/opml/import - 从 OPML 批量导入订阅
 *
 * 请求体是 OPML 的原始文本（Content-Type: text/xml 或 application/xml）。
 * 用自带的轻量解析，不引入 xml 库：OPML 结构极简单，
 * 只需要所有带 xmlUrl 的 outline 和它们的 text 属性。
 *
 * 对每个源：
 *   1. 已存在同 url 的 Feed 就复用，不存在则先解析一次拿标题，
 *      解析失败照样入库（用户至少能看到这条源并手动重试），
 *      标题退回域名；
 *   2. 建立 Subscription，落到「导入」分组下。
 *
 * 单个源失败不影响其余源，最后汇总 succeeded / failed。
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
        { success: false, message: "访客模式下无法导入订阅" },
        { status: 403 }
      );
    }

    const text = await req.text();
    if (!text || !text.includes("<outline")) {
      return NextResponse.json(
        { success: false, message: "这不是有效的 OPML 文件" },
        { status: 400 }
      );
    }

    // 抓出所有 outline 标签
    const outlines: string[] = text.match(/<outline\b[^>]*>/gi) || [];

    const entries: Array<{ url: string; title: string }> = [];
    for (const tag of outlines) {
      const urlMatch = tag.match(/xmlUrl\s*=\s*"([^"]*)"/i);
      if (!urlMatch) continue;
      const url = urlMatch[1].trim();
      if (!/^https?:\/\//i.test(url)) continue;

      const titleMatch = tag.match(/(?:text|title)\s*=\s*"([^"]*)"/i);
      const title = titleMatch ? titleMatch[1].trim() : "";
      entries.push({ url, title });
    }

    // 去重（OPML 里同一源可能出现多次）
    const seen = new Set<string>();
    const unique = entries.filter((e) => {
      if (seen.has(e.url)) return false;
      seen.add(e.url);
      return true;
    });

    if (unique.length === 0) {
      return NextResponse.json(
        { success: false, message: "这个 OPML 里没有找到任何订阅源" },
        { status: 400 }
      );
    }

    // 导入的订阅统一落到「导入」分组
    let importGroup = await prisma.group.findFirst({
      where: { userId: user.id, name: "导入" },
      select: { id: true },
    });
    if (!importGroup) {
      importGroup = await prisma.group.create({
        data: { userId: user.id, name: "导入", sortOrder: 99 },
        select: { id: true },
      });
    }

    let succeeded = 0;
    let failed = 0;

    for (const entry of unique) {
      try {
        let feed = await prisma.feed.findUnique({ where: { url: entry.url } });

        if (!feed) {
          // 先尝试解析拿真实标题；失败也照样建源，标题退回域名
          let resolvedTitle = entry.title;
          let description: string | null = null;
          if (!resolvedTitle) {
            try {
              const parsed = await parseRSS(entry.url);
              resolvedTitle = parsed.title || "";
              description = parsed.description || null;
            } catch {
              // 源暂时抓不到不影响入库
            }
          }
          if (!resolvedTitle) {
            try {
              resolvedTitle = new URL(entry.url).hostname;
            } catch {
              resolvedTitle = entry.url;
            }
          }

          feed = await prisma.feed.create({
            data: {
              url: entry.url,
              title: resolvedTitle,
              description,
              category: "博客",
              syncStatus: "PENDING",
              isActive: true,
            },
          });
        }

        const existing = await prisma.subscription.findUnique({
          where: { userId_feedId: { userId: user.id, feedId: feed.id } },
        });

        if (!existing) {
          await prisma.subscription.create({
            data: {
              userId: user.id,
              feedId: feed.id,
              groupId: importGroup.id,
              isNotify: true,
            },
          });
        }

        succeeded += 1;
      } catch (error) {
        console.error("Import OPML entry failed:", entry.url, error);
        failed += 1;
      }
    }

    return NextResponse.json({
      success: true,
      data: { total: unique.length, succeeded, failed },
      message:
        failed > 0
          ? `导入完成：成功 ${succeeded} 个，失败 ${failed} 个`
          : `成功导入 ${succeeded} 个订阅`,
    });
  } catch (error) {
    console.error("Import OPML error:", error);
    return NextResponse.json(
      { success: false, message: "导入失败" },
      { status: 500 }
    );
  }
}
