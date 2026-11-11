import { NextResponse } from "next/server";
import { syncAllFeeds } from "@/lib/rss-parser";
import { requireAuth } from "@/lib/auth";

// 返回内容依赖数据库实时状态，不能被预渲染
export const dynamic = "force-dynamic";

/**
 * POST /api/feeds/sync
 *
 * 兼容旧调用方的薄封装：真正的同步逻辑只有一份，在 lib/rss-parser.ts 的
 * syncAllFeeds() 里。
 *
 * 改动前这个文件自己写了一套同步循环，只把 RSS 里自带的 content 存库，
 * 完全不走 fetchFullContent —— 于是「RSS 只给摘要」的站（少数派、很多
 * 博客）永远只有 100 多字的开头，而线上 UI 一刷新走的正是这条路径。
 * 两套实现并存时，全文抓取那套（/api/sync）只在手动调接口时才跑到。
 */
export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }

    const result = await syncAllFeeds();

    return NextResponse.json({
      success: result.success,
      data: {
        synced: result.results.length,
        results: result.results.map((r) => ({
          feedId: r.feedId,
          title: r.feedTitle,
          status: r.success ? "success" : "error",
          newArticles: r.count,
          error: r.success ? undefined : r.message,
        })),
      },
      message: "同步完成",
    });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { success: false, message: "同步失败" },
      { status: 500 }
    );
  }
}
