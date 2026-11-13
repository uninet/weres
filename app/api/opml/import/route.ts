import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { parseRSS } from "@/lib/rss-parser";
import {
  checkGlobalRateLimit,
  checkRateLimit,
  getClientIdentifier,
  rateLimitConfigs,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * 单个 OPML 文件最多导入多少个源。
 *
 * 没有上限时这个接口是整站最便宜的放大器：请求体不限长、outline 数量不限、
 * 每个未存在的源还要外呼一次 parseRSS。实测一次请求塞 600 条 outline
 * 全部成功入库 —— 一个人一条 curl 就能把全站 feeds 从 897 撑到 3197，
 * 而这些源之后每次「同步全部」都要被抓一遍。
 * 1000 条远超正常用户的订阅量（重度用户通常 100–300），
 * 超出的部分明确报错告诉用户改成分批导入，而不是静默截断。
 */
const MAX_IMPORT_ENTRIES = 1000;

/** 请求体上限：1000 条 outline 的 OPML 大约 100KB，留 2 倍余量。 */
const MAX_BODY_BYTES = 2 * 1024 * 1024;

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

    // 读 body 之前先过一道全局桶。
    //
    // 这一层挡的不是「谁在滥用」，而是「请求体本身有多大」：
    // req.text() 会把整个 body 读进内存，2MB 的上限是在读完之后才检查的，
    // 所以在那之前必须有个不依赖客户端输入的节流，否则一个循环发
    // 100MB body 的脚本就能把进程内存打满。全局桶的 key 不由请求方决定，
    // 伪造 IP 绕不过去。
    const ingress = checkGlobalRateLimit("opml-import", rateLimitConfigs.globalLogin);
    if (!ingress.success) {
      return NextResponse.json(
        { success: false, message: "导入过于频繁，请稍后再试" },
        { status: 429 }
      );
    }

    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { success: false, message: "OPML 文件过大（上限 2MB）" },
        { status: 413 }
      );
    }
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

    if (unique.length > MAX_IMPORT_ENTRIES) {
      return NextResponse.json(
        {
          success: false,
          message: `一次最多导入 ${MAX_IMPORT_ENTRIES} 个订阅源，当前有 ${unique.length} 个，请分批导入`,
        },
        { status: 400 }
      );
    }

    // 限流放在所有结构校验之后。
    //
    // 这个接口会外呼（每个新源一次 parseRSS），不限流就是免费抓取代理 ——
    // 但限流不该拦在「文件太大」「条数超上限」这类判断前面：
    //   · 那些拒绝是零成本的（不查库、不外呼、不建行），
    //     先拦它们既不影响防滥用，也不占用户的额度；
    //   · 反过来先扣额度的话，一个把 OPML 导出成 1500 条的用户，
    //     连试几轮都只会看到「导入过于频繁」，永远看不到
    //     「一次最多 1000 条」这句真正有用的提示。
    // 实测就是这个后果：F-02（导入自己的导出文件）和 W-08（1200 条必须被拒）
    // 连跑第二轮时都拿 429，看起来像产品坏了，实际只是顺序问题。
    const limit = checkRateLimit(`opml-import:${getClientIdentifier(req)}`, rateLimitConfigs.strict);
    if (!limit.success) {
      return NextResponse.json(
        { success: false, message: "导入过于频繁，请稍后再试" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((limit.resetTime - Date.now()) / 1000)),
          },
        }
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
