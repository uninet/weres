import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// 导出内容依赖当前用户，不能预渲染
export const dynamic = "force-dynamic";

/** XML 文本转义，避免标题里的 & < > 破坏 OPML 结构 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * GET /api/opml - 导出订阅为 OPML 2.0
 *
 * OPML 是 RSS 阅读器之间通用的订阅清单格式。没有它，用户换设备、
 * 迁移到别的阅读器时只能一条条重新加 —— 这是阅读器的基础能力，
 * QiReader / Feedly / Inoreader 都支持。
 *
 * 分组会导出成嵌套 outline：OPML 规范里 outline 带 xmlUrl 的是源，
 * 不带 xmlUrl 的视为分组容器。
 */
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user } = auth;

    const groups = await prisma.group.findMany({
      where: { userId: user.id },
      orderBy: { sortOrder: "asc" },
      include: {
        subscriptions: {
          // 同 groups 路由：嵌套 include 不会继承父级的 userId 条件。
          // 少了这行，导出的 OPML 里会混进别人的订阅 ——
          // 而这份文件是用户要拿去导入下一个阅读器的。
          where: { userId: user.id },
          include: { feed: true },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const ungrouped = await prisma.subscription.findMany({
      where: { userId: user.id, groupId: null },
      include: { feed: true },
      orderBy: { createdAt: "asc" },
    });

    const lines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<opml version="2.0">',
      "  <head>",
      "    <title>WeRSS 订阅</title>",
      `    <dateCreated>${new Date().toUTCString()}</dateCreated>`,
      "  </head>",
      "  <body>",
    ];

    const feedOutline = (feed: { title: string | null; url: string; icon: string | null }, indent: string) =>
      [
        `${indent}<outline`,
        `${indent}  type="rss"`,
        `${indent}  text="${escapeXml(feed.title || feed.url)}"`,
        `${indent}  title="${escapeXml(feed.title || feed.url)}"`,
        `${indent}  xmlUrl="${escapeXml(feed.url)}"`,
        feed.icon ? `${indent}  htmlUrl="${escapeXml(feed.icon)}"` : null,
        `${indent}/>`,
      ]
        .filter(Boolean)
        .join("\n");

    for (const group of groups) {
      if (group.subscriptions.length === 0) continue;
      lines.push(`    <outline text="${escapeXml(group.name)}" title="${escapeXml(group.name)}">`);
      for (const sub of group.subscriptions) {
        lines.push(feedOutline(sub.feed, "      "));
      }
      lines.push("    </outline>");
    }

    for (const sub of ungrouped) {
      lines.push(feedOutline(sub.feed, "    "));
    }

    lines.push("  </body>", "</opml>");

    const body = lines.join("\n");

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/x-opml; charset=utf-8",
        // 让浏览器直接下载成文件
        "Content-Disposition": `attachment; filename="werss-subscriptions.opml"`,
      },
    });
  } catch (error) {
    console.error("Export OPML error:", error);
    return NextResponse.json(
      { success: false, message: "导出失败" },
      { status: 500 }
    );
  }
}
