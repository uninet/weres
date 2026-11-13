import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * 订阅归属校验（单一实现）。
 *
 * 为什么要有这个文件：`groupId`、`articleId` 这类外键在 schema 里是"裸 id"，
 * 数据库不会替你检查它属于谁。同一个校验如果散在多个路由里各写一遍，
 * 必然出现"修了一处、漏了另一处"—— 本项目已经栽过三次：
 *   - `/api/articles/[id]/favorite` 加了闸，`/api/favorites` 没加（收藏页走的是后者）
 *   - `/api/feeds/subscriptions` 的 POST 加了闸，PATCH 没加
 *   - `/api/articles` 的 unread 用了安全写法，另外四处仍是 notIn
 * 所以归属判断只允许从这里走。
 */

/** 未通过归属校验时返回的固定响应：不区分"不存在"与"不属于你"。 */
export const NOT_FOUND_RESPONSE = {
  success: false as const,
  message: "资源不存在",
};

export const NOT_FOUND_STATUS = 404;

/**
 * 判断某个分组是否属于该用户。
 * 不存在、属于别人、id 为空，全部返回 false —— 调用方一律回 404，
 * 不要用 403，因为 404/403 的差异本身就能被用来枚举别人的 id 是否存在。
 */
export async function isGroupOwnedBy(userId: string, groupId: string | null | undefined): Promise<boolean> {
  if (!groupId) return false;
  const group = await prisma.group.findFirst({
    where: { id: groupId, userId },
    select: { id: true },
  });
  return Boolean(group);
}

/**
 * 判断某篇文章是否在当前用户可见范围内。
 *
 * "可见" = 该文章所属的源被当前用户订阅了。这是全站读文章的统一判据：
 * 详情、标记已读、收藏都用它，避免出现"能从收藏读到、但从详情读不到"这种
 * 同一条数据两套结论的情况。
 */
export async function isArticleVisibleTo(userId: string, articleId: string): Promise<boolean> {
  const article = await prisma.article.findFirst({
    where: {
      id: articleId,
      feed: { subscriptions: { some: { userId } } },
    },
    select: { id: true },
  });
  return Boolean(article);
}

/**
 * 组合判断：分组归属校验失败时直接给出待返回的响应，成功则返回 null。
 *
 * 用法：
 *   const denied = await denyUnlessGroupOwned(user.id, groupId);
 *   if (denied) return denied;
 */
export async function denyUnlessGroupOwned(
  userId: string,
  groupId: string | null | undefined
): Promise<NextResponse | null> {
  if (!groupId) return null; // 不指定分组是合法的（落到未分组）
  if (await isGroupOwnedBy(userId, groupId)) return null;
  return NextResponse.json(NOT_FOUND_RESPONSE, { status: NOT_FOUND_STATUS });
}

/** 组合判断：文章不在可见范围内时给出待返回的响应。 */
export async function denyUnlessArticleVisible(
  userId: string,
  articleId: string
): Promise<NextResponse | null> {
  if (await isArticleVisibleTo(userId, articleId)) return null;
  return NextResponse.json(NOT_FOUND_RESPONSE, { status: NOT_FOUND_STATUS });
}
