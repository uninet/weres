/**
 * 分页参数解析。
 *
 * 这几个值直接决定数据库的 skip/take，不设上界会有两个后果：
 *   1. `?limit=999999` 一次把整表拉出来，内存和带宽都被打满；
 *      history 表在正常使用下能到几万条，实测这个请求返回 253KB。
 *   2. `?page=999999` 会让 skip 变成天文数字，SQLite 仍要扫过前面
 *      所有行才返回空结果。
 *
 * 所以统一夹紧，而不是在十个路由里各写一遍 parseInt。
 */

/** 单页最多返回多少条。列表类接口都用这个上限。 */
export const MAX_PAGE_SIZE = 100;

/** 单页默认条数。 */
export const DEFAULT_PAGE_SIZE = 20;

/** 允许翻到的最深页码，避免超大 skip 拖垮数据库。 */
export const MAX_PAGE = 10000;

/**
 * 把查询参数解析成夹紧在 [min, max] 区间内的整数。
 *
 * 非数字、NaN、Infinity、负数一律落到边界值或默认值，不抛异常——
 * 分页参数填错是常见的客户端失误，返回 400 会让用户看到空白页，
 * 夹到合法范围里继续返回数据体验更好。
 */
export function toBoundedInt(
  raw: string | null | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  if (raw === null || raw === undefined || raw === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/**
 * 从 URLSearchParams 里一次性取出 page / pageSize（或 limit），
 * 并把两者都夹紧。
 *
 * `sizeParam` 允许不同接口用不同的查询参数名：文章列表叫 pageSize，
 * 收藏 / 历史 / 通知叫 limit。
 */
export function parsePagination(
  searchParams: URLSearchParams,
  sizeParam: "pageSize" | "limit" = "pageSize"
): { page: number; pageSize: number; skip: number } {
  const page = toBoundedInt(searchParams.get("page"), 1, 1, MAX_PAGE);
  const pageSize = toBoundedInt(
    searchParams.get(sizeParam),
    DEFAULT_PAGE_SIZE,
    1,
    MAX_PAGE_SIZE
  );
  return { page, pageSize, skip: (page - 1) * pageSize };
}
