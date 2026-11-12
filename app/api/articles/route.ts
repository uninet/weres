import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { sanitizeArticleHtml, sanitizePlainText } from "@/lib/sanitize";

// 这些接口的返回内容依赖当前登录用户与数据库实时状态，
// 绝不能被 Next 在构建期预渲染成静态文件（会泄漏构建机的数据快照，
// 并且在部署后永远返回同一份旧数据）。
export const dynamic = "force-dynamic";

/** 单页最多返回的文章数。超过这个值通常是爬虫或误用。 */
const MAX_PAGE_SIZE = 100;
/** 默认每页条数。 */
const DEFAULT_PAGE_SIZE = 20;
/** 允许翻到的最深页码，避免超大 skip 拖垮数据库。 */
const MAX_PAGE = 10000;

/**
 * 把查询参数解析成夹紧在 [min, max] 区间内的整数。
 * 非数字、NaN、Infinity 一律退回默认值。
 */
function toBoundedInt(
  raw: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  if (raw === null) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

// GET /api/articles - 获取文章列表
export async function GET(req: Request) {
  try {
    // 允许访客访问
    const auth = await requireAuth(req, { allowGuest: true });
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user, isGuest } = auth;

    const { searchParams } = new URL(req.url);
    const feedId = searchParams.get("feedId");
    const groupId = searchParams.get("groupId");
    const type = searchParams.get("type");
    const keyword = searchParams.get("search")?.trim() || "";

    // 文章排序：oldest 表示从旧到新，其余一律最新在前
    const sortOrder =
      searchParams.get("order") === "oldest"
        ? ("asc" as const)
        : ("desc" as const);

    // 分页参数必须夹紧。
    // 之前直接 parseInt，`?pageSize=999999` 会把整库文章一次性拉出来，
    // 既拖垮数据库也拖垮浏览器；`?page=0` 会算出负的 skip 直接报错。
    const page = toBoundedInt(searchParams.get("page"), 1, 1, MAX_PAGE);
    const pageSize = toBoundedInt(
      searchParams.get("pageSize"),
      DEFAULT_PAGE_SIZE,
      1,
      MAX_PAGE_SIZE
    );

    // 获取用户已读文章 ID 列表
    const readHistories = await prisma.readHistory.findMany({
      where: { userId: user.id },
      select: { articleId: true },
    });
    const readIds = readHistories.map((h) => h.articleId);

    // 获取用户收藏文章 ID 列表
    const favorites = await prisma.favorite.findMany({
      where: { userId: user.id },
      select: { articleId: true },
    });
    const favoriteIds = favorites.map((f) => f.articleId);

    // 构建基础查询条件
    // 用 Prisma.ArticleWhereInput 而不是 any：这个条件决定了「能查到谁的文章」，
    // 类型一旦是 any，字段名拼错（比如 feedID 写成 feedid）不会报错，
    // 查询条件会被静默丢弃 → 越权返回全站文章。
    let where: Prisma.ArticleWhereInput = {
      feed: {
        subscriptions: {
          some: {
            userId: user.id,
          },
        },
      },
    };

    // 按 RSS 源过滤
    if (feedId) {
      where.feedId = feedId;
    }

    // 按分组过滤
    if (groupId) {
      where.feed = {
        subscriptions: {
          some: {
            userId: user.id,
            groupId: groupId,
          },
        },
      };
    }

    // 按类型过滤
    if (type === "unread") {
      where.id = {
        notIn: readIds.length > 0 ? readIds : [""],
      };
    } else if (type === "favorite") {
      where.id = {
        in: favoriteIds.length > 0 ? favoriteIds : [""],
      };
    } else if (type === "read") {
      where.id = {
        in: readIds.length > 0 ? readIds : [""],
      };
    }

    // 关键词搜索
    //
    // 之前前端已经在发 `?search=xxx`，但后端从来没读过这个参数，
    // 所以搜索框输入任何内容都返回同样的结果 —— 功能是假的。
    //
    // SQLite 的 LIKE 对 ASCII 大小写不敏感，但对中文本来就是精确匹配，
    // 因此这里统一用 contains + insensitive，由 Prisma 落到 LIKE '%kw%'。
    // 为了让搜索有实际意义，标题和摘要都要匹配；正文体积大，不参与匹配，
    // 否则每次搜索都要扫全文，慢到不可用。
    if (keyword) {
      const conditions = [
        { title: { contains: keyword } },
        { description: { contains: keyword } },
      ];
      // where.OR 与 where.feed 需要并存，因此不能直接覆盖 where
      where = {
        AND: [where, { OR: conditions }],
      };
    }

    // 获取文章总数
    const total = await prisma.article.count({ where });

    // 获取文章列表
    //
    // 为什么要多取一些：同一篇文章经常出现在多个源里（某站的「全文 RSS」
    // 和「摘要 RSS」、聚合站转载、以及 guid 退化成 link 的源）。实测库里
    // 7723 篇文章里有 39 组这样的重复 link。用户同时订阅这几个源时，
    // 中栏会把同一篇文章列两遍 —— 点开右边内容一模一样，很容易以为是 bug。
    //
    // SQLite + Prisma 没有一个既尊重复杂 where 又能去重的写法，
    // 所以这里多取 2 倍再按 link 去重、最后截到 pageSize。
    // 极端情况下（某一页全是重复）这一页会比 pageSize 少几条，
    // 比出现重复条目更可接受。
    const fetchLimit = Math.min(pageSize * 2, MAX_PAGE_SIZE * 2);
    const rawArticles = await prisma.article.findMany({
      where,
      include: {
        feed: {
          select: {
            id: true,
            title: true,
            icon: true,
          },
        },
        _count: {
          select: {
            favorites: true,
          },
        },
      },
      // 排序方向可控：
      //   默认最新在前（阅读器的常规预期）；
      //   ?order=oldest 时从旧到新 —— 补看历史积压的用户需要这个，
      //   QiReader 等成熟阅读器都提供该选项。
      orderBy: {
        pubDate: sortOrder,
      },
      skip: (page - 1) * pageSize,
      take: fetchLimit,
    });

    // 按 link 去重，保留先出现的（列表已按 pubDate 排好序，
    // 先出现的就是排序上更靠前的那一篇）。
    const seenLinks = new Set<string>();
    const articles = rawArticles
      .filter((article) => {
        if (seenLinks.has(article.link)) return false;
        seenLinks.add(article.link);
        return true;
      })
      .slice(0, pageSize);

    // 计算未读数量
    const unreadCount = await prisma.article.count({
      where: {
        feed: {
          subscriptions: {
            some: {
              userId: user.id,
            },
          },
        },
        id: {
          notIn: readIds.length > 0 ? readIds : [""],
        },
      },
    });

    // 格式化返回数据
    const formattedArticles = articles.map((article) => ({
      id: article.id,
      title: article.title,
      // description 来自第三方 RSS，部分源往里塞 HTML 片段，剥成纯文本再返回
      description: sanitizePlainText(article.description),
      // 正文来自第三方站点，渲染前必须净化（前端用 dangerouslySetInnerHTML）
      content: sanitizeArticleHtml(article.content),
      link: article.link,
      author: article.author,
      pubDate: article.pubDate,
      // 列表缩略图：解析 RSS 时从 enclosure/media:content/正文首图里取到的封面。
      // 没有封面时返回 null，前端会退化成纯文字卡片。
      imageUrl: article.imageUrl,
      feed: article.feed,
      isRead: readIds.includes(article.id),
      isFavorited: favoriteIds.includes(article.id),
      favoriteCount: article._count.favorites,
    }));

    return NextResponse.json({
      success: true,
      data: {
        articles: formattedArticles,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
        unreadCount,
      },
      isGuest,
    });
  } catch (error) {
    console.error("Get articles error:", error);
    return NextResponse.json(
      { success: false, message: "获取文章列表失败" },
      { status: 500 }
    );
  }
}

// POST /api/articles/mark-all-read - 标记所有文章为已读
export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user, isGuest } = auth;

    // 访客模式下不允许标记已读
    if (isGuest) {
      return NextResponse.json(
        { success: false, message: "访客模式下无法使用此功能" },
        { status: 403 }
      );
    }

    const { feedId } = await req.json();

    // 获取用户已读文章 ID
    const readHistories = await prisma.readHistory.findMany({
      where: { userId: user.id },
      select: { articleId: true },
    });
    const readIds = readHistories.map((h) => h.articleId);

    // 构建查询条件（同上，用精确类型而非 any）
    let where: Prisma.ArticleWhereInput = {
      feed: {
        subscriptions: {
          some: {
            userId: user.id,
          },
        },
      },
      id: {
        notIn: readIds.length > 0 ? readIds : [""],
      },
    };

    if (feedId) {
      where.feedId = feedId;
    }

    // 获取所有未读文章
    const unreadArticles = await prisma.article.findMany({
      where,
      select: {
        id: true,
      },
    });

    // 批量创建阅读历史
    const newReadHistories = unreadArticles.map((article) => ({
      userId: user.id,
      articleId: article.id,
      readAt: new Date(),
    }));

    if (newReadHistories.length > 0) {
      // 使用 upsert 避免重复
      for (const history of newReadHistories) {
        await prisma.readHistory.upsert({
          where: {
            userId_articleId: {
              userId: history.userId,
              articleId: history.articleId,
            },
          },
          update: { readAt: history.readAt },
          create: history,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `已标记 ${newReadHistories.length} 篇文章为已读`,
      data: {
        markedCount: newReadHistories.length,
      },
    });
  } catch (error) {
    console.error("Mark all as read error:", error);
    return NextResponse.json(
      { success: false, message: "标记已读失败" },
      { status: 500 }
    );
  }
}
