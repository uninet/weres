/**
 * RSS 市场的公共数据层。
 *
 * 为什么抽出来：市场列表和「添加订阅」页需要的是同一份数据，
 * 只是切法不同 —— 前者一次要全部 896 条，后者按分类每组只要 10 条
 * 预览、点「更多」才要某一组的全部。如果各写一遍查询，那么
 * 「订阅数怎么算」「已订阅状态怎么判」就会出现两套实现，
 * 而这正是本项目反复踩的坑（订阅数计数器只维护了一条路径，
 * 结果市场页显示 0、实际有 1 个订阅）。
 *
 * 所以：订阅数、已订阅状态、排序规则全部只在这里算一次。
 */

import { prisma } from "@/lib/prisma";

/**
 * 单组「更多」一次最多返回多少条。
 *
 * 「更多」的语义是「查看该组的全部订阅源」，所以这个值必须大于
 * 最大的分类条数（当前是技术 514 个），否则按钮写着「查看全部
 * 514 个」却只给 200 个，用户翻到底会以为数据丢了。
 * 1000 留了接近一倍的增长空间，同时仍然是个上界 —— 不至于让
 * 一个畸形请求把整张表拖出来。
 */
export const MAX_GROUP_SIZE = 1000;

/** 分组预览默认条数 */
export const DEFAULT_PREVIEW_SIZE = 10;

/** 市场列表的一行（含实时算出来的订阅数与订阅状态） */
export interface MarketFeedRow {
  id: string;
  feedId: string;
  category: string;
  isFeatured: boolean;
  subscriberCount: number;
  isSubscribed: boolean;
  feed: {
    id: string;
    url: string;
    title: string;
    description: string | null;
    icon: string | null;
    category: string;
  };
}

/** 一个分类分组 */
export interface MarketGroup {
  category: string;
  /** 该分类下的源总数（不受 perGroup 影响） */
  total: number;
  feeds: MarketFeedRow[];
}

const FEED_SELECT = {
  id: true,
  url: true,
  title: true,
  description: true,
  icon: true,
  category: true,
} as const;

/**
 * 订阅数按实际订阅记录实时统计，不读 MarketFeed.subscriberCount。
 *
 * 那个字段靠 increment/decrement 维护，但维护它的只有
 * /api/subscriptions 一条路径：UI 实际用的 /api/feeds/subscriptions
 * 从来不碰它，取消订阅的两条路径行为也不一致。结果是这个计数器
 * 只会往上飘，实测同一时刻「少数派」显示 0、实际有 1 个订阅。
 * 一次 groupBy 就能拿到全部真实数量，比维护十处配对逻辑可靠。
 */
async function getSubscriberCounts(): Promise<Map<string, number>> {
  const rows = await prisma.subscription.groupBy({
    by: ["feedId"],
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.feedId, row._count._all]));
}

async function getSubscribedFeedIds(userId?: string): Promise<Set<string>> {
  if (!userId) return new Set();
  const rows = await prisma.subscription.findMany({
    where: { userId },
    select: { feedId: true },
  });
  return new Set(rows.map((row) => row.feedId));
}

/** 分类 -> 该分类下 ACTIVE 源的总数 */
async function getCategoryTotals(): Promise<Map<string, number>> {
  const rows = await prisma.marketFeed.groupBy({
    by: ["category"],
    where: { status: "ACTIVE" },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.category, row._count._all]));
}

/**
 * 标题升序是为了让顺序稳定。之前按 subscriberCount 排，而那个字段
 * 是错的（见 getSubscriberCounts 注释），等于按一个 known-broken
 * 的值排序，列表顺序每次看起来都随心所欲。
 */
const MARKET_ORDER = [
  { isFeatured: "desc" as const },
  { feed: { title: "asc" as const } },
];

function toRow(
  row: {
    id: string;
    feedId: string;
    category: string;
    isFeatured: boolean;
    feed: MarketFeedRow["feed"];
  },
  countMap: Map<string, number>,
  subscribedIds: Set<string>
): MarketFeedRow {
  return {
    id: row.id,
    feedId: row.feedId,
    category: row.category,
    isFeatured: row.isFeatured,
    subscriberCount: countMap.get(row.feedId) ?? 0,
    isSubscribed: subscribedIds.has(row.feedId),
    feed: row.feed,
  };
}

/**
 * 扁平的全部市场源，供 `/api/market` 使用（市场页要一次拿全）。
 */
export async function loadAllMarketFeeds(
  userId?: string
): Promise<MarketFeedRow[]> {
  const [rows, countMap, subscribedIds] = await Promise.all([
    prisma.marketFeed.findMany({
      where: { status: "ACTIVE" },
      include: { feed: { select: FEED_SELECT } },
      orderBy: MARKET_ORDER,
    }),
    getSubscriberCounts(),
    getSubscribedFeedIds(userId),
  ]);

  return rows.map((row) => toRow(row, countMap, subscribedIds));
}

/**
 * 按分类切成"分组"，供「添加订阅」页使用。
 *
 * 不传 category：返回所有分类，每组最多 perGroup 条 —— 每个分类
 * 各发一次查询，比把 896 行全捞回来再在内存里切更省带宽，
 * 而且 perGroup 只在数据库层生效，不依赖调用方自觉截断。
 *
 * 传 category：只返回该分类（点「更多」时用，perGroup 给大值）。
 */
export async function loadMarketGroups(options: {
  userId?: string;
  category?: string;
  perGroup?: number;
} = {}): Promise<{ groups: MarketGroup[]; totalFeeds: number }> {
  const { userId, category, perGroup = DEFAULT_PREVIEW_SIZE } = options;
  const take = Math.max(1, Math.min(MAX_GROUP_SIZE, Math.floor(perGroup) || 1));

  const [categoryTotals, countMap, subscribedIds] = await Promise.all([
    getCategoryTotals(),
    getSubscriberCounts(),
    getSubscribedFeedIds(userId),
  ]);

  const totalFeeds = Array.from(categoryTotals.values()).reduce(
    (sum, n) => sum + n,
    0
  );

  const categories = category
    ? [category]
    : Array.from(categoryTotals.keys()).sort(
        (a, b) => (categoryTotals.get(b) ?? 0) - (categoryTotals.get(a) ?? 0)
      );

  const groups = await Promise.all(
    categories.map(async (name) => {
      const rows = await prisma.marketFeed.findMany({
        where: { status: "ACTIVE", category: name },
        include: { feed: { select: FEED_SELECT } },
        orderBy: MARKET_ORDER,
        take,
      });
      return {
        category: name,
        total: categoryTotals.get(name) ?? rows.length,
        feeds: rows.map((row) => toRow(row, countMap, subscribedIds)),
      } satisfies MarketGroup;
    })
  );

  return { groups, totalFeeds };
}
