import { NextResponse } from "next/server";

/**
 * 这个路由已经废弃，只保留一个明确的 410 说明。
 *
 * 历史：项目早期有 /api/subscriptions 和 /api/feeds/subscriptions 两套订阅接口，
 * 语义还不一样 —— 同一件事「重复订阅」前者回 409 错误，后者回 200 + 提示，
 * 前端只用了后者，于是前者成了全仓零调用方的死代码。
 *
 * 但它有两个副作用会继续污染数据：
 *   1. 它是全仓唯一写 MarketFeed.subscriberCount 的地方（increment/decrement），
 *      而这个字段早已不可靠 —— lib/market.ts 改成用 subscription.groupBy
 *      实时统计，正是因为它只有一条写入路径在维护，其余入口从不碰它。
 *   2. 它的 DELETE 也不清理那笔计数，删订阅后计数只增不减。
 *
 * 与其留着两套语义让人继续误用，不如让它明确地失败，并把调用方
 * 指向唯一正确的入口。410 Gone 表达的就是「这里曾经有，现在没有了」。
 */
const GONE = {
  success: false,
  message: "此接口已废弃，请使用 /api/feeds/subscriptions",
  migratedTo: "/api/feeds/subscriptions",
};

export async function GET() {
  return NextResponse.json(GONE, { status: 410 });
}

export async function POST() {
  return NextResponse.json(GONE, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json(GONE, { status: 410 });
}
