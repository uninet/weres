import { prisma } from "./prisma";

/**
 * 为一次同步产生的新文章写站内通知。
 *
 * 为什么需要这个模块：
 *   通知页、通知表、已读标记、清空、跳转链接全都做好了，但从来没有任何
 *   地方**写**通知 —— seed 脚本写死的两条是唯一的数据来源。用户订阅新源
 *   之后通知页永远停在「暂无通知」，看起来像功能坏了。
 *
 * 为什么按「每个源一条」而不是「每篇文章一条」：
 *   一个活跃源一次同步可能新增十几篇。每篇一条通知会把用户收件箱淹掉，
 *   而通知的价值在于「这个源有更新了」，点进去看列表即可。
 *
 * 两级开关：
 *   User.notifyNewArticles  总开关（服务端偏好）
 *   Subscription.isNotify   单源开关
 *   两者都为 true 才写。
 */
export async function notifyFeedUpdates(
  feedId: string,
  newArticles: { id: string; title: string }[]
): Promise<number> {
  if (newArticles.length === 0) return 0;

  try {
    const feed = await prisma.feed.findUnique({
      where: { id: feedId },
      select: { title: true },
    });
    if (!feed) return 0;

    // 找出所有订阅了该源、并且两个开关都开着的用户。
    // 在数据库层过滤而不是取回来再筛：一个热门源可能有成千订阅者，
    // 全量拉进内存再过滤会把同步任务拖慢。
    const targets = await prisma.subscription.findMany({
      where: {
        feedId,
        isNotify: true,
        user: { notifyNewArticles: true },
      },
      select: { userId: true },
    });
    if (targets.length === 0) return 0;

    const count = newArticles.length;
    const latest = newArticles[0];

    await prisma.notification.createMany({
      data: targets.map((t) => ({
        userId: t.userId,
        type: "FEED_UPDATE",
        title: `${feed.title} 有 ${count} 篇新文章`,
        content:
          count === 1
            ? latest.title
            : `${latest.title} 等 ${count} 篇`,
        // 前端点击 FEED_UPDATE 分支要读这两个字段跳转
        data: JSON.stringify({
          feedId,
          feedName: feed.title,
          articleId: latest.id,
        }),
      })),
    });

    return targets.length;
  } catch (error) {
    // 通知写失败不该让整次同步算失败：文章已经入库了，
    // 因为一条通知把 syncStatus 标成 ERROR 会误导用户以为抓取坏了。
    console.error("[notify] 生成订阅更新通知失败:", error);
    return 0;
  }
}
