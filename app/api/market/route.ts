import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { toBoundedInt } from "@/lib/pagination";
import {
  DEFAULT_PREVIEW_SIZE,
  MAX_GROUP_SIZE,
  loadAllMarketFeeds,
  loadMarketGroups,
} from "@/lib/market";

// /api/market 必须按请求实时查询数据库。
//
// 不加这条声明时，Next 会在 `next build` 阶段把这个 GET 当成静态路由预先执行，
// 把当时的数据库行烤进 .next/server/app/api/market.body。后果有两个：
//   1. 构建机必须能连上数据库，否则构建产物里是一份错误内容；
//   2. 部署后接口永远返回构建那一刻的数据，新订阅的市场源不会出现。
export const dynamic = "force-dynamic";

/**
 * GET /api/market - 获取 RSS 市场列表
 *
 * 两种形态，用 `grouped=1` 切换：
 *   - 默认（扁平）：返回全部 896 个源，市场页一次拿全后在本地筛选。
 *     响应约 483KB，只有真正要「看全部」的页面才能接受。
 *   - `grouped=1`：按分类分组，每组默认 10 条（`perGroup` 可调，
 *     上限见 `lib/market.ts` 的 `MAX_GROUP_SIZE`）。「添加订阅」页用它
 *     —— 第一屏只需要每类 10 个预览，把 896 条全塞过去等于让用户为
 *     看不到的 886 行付流量。实测 483KB → 24KB。
 *
 * `category=技术` 可只取某一组（配合 `grouped=1&perGroup=1000` 实现
 * 「查看该组全部订阅源」，实测技术组 514/514 全部返回）。
 */
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    // 必须显式判错。requireAuth 的返回类型里 user 是可选的，
    // 只写 `auth.user?.id` 会让「忘了判错」编译通过 ——
    // 这一处就是这么漏的：全仓 20 个调用点里唯一没有 guard 的一个，
    // 于是市场接口成了匿名可打的 390KB 全表扫描（无鉴权、无限流）。
    // 市场页在 (main) 路由组里，本来就要求登录，匿名访问没有任何产品价值。
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const userId = auth.user.id;

    const { searchParams } = new URL(req.url);
    const grouped =
      searchParams.get("grouped") === "1" || searchParams.get("grouped") === "true";

    if (!grouped) {
      const feeds = await loadAllMarketFeeds(userId);
      return NextResponse.json({ success: true, data: feeds });
    }

    const category = searchParams.get("category")?.trim() || undefined;
    const perGroup = toBoundedInt(
      searchParams.get("perGroup"),
      DEFAULT_PREVIEW_SIZE,
      1,
      MAX_GROUP_SIZE
    );

    const { groups, totalFeeds } = await loadMarketGroups({
      userId,
      category,
      perGroup,
    });

    return NextResponse.json({
      success: true,
      data: { groups, totalFeeds },
    });
  } catch (error) {
    console.error("Get market feeds error:", error);
    return NextResponse.json(
      { success: false, message: "获取市场 RSS 源失败" },
      { status: 500 }
    );
  }
}
