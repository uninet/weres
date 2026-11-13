import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { sanitizePlainText } from "@/lib/sanitize";
import { readJsonBody } from "@/lib/request";
import {
  MAX_PAGE_SIZE,
  MAX_PAGE,
  DEFAULT_PAGE_SIZE,
  toBoundedInt,
} from "@/lib/pagination";

// 这些接口的返回内容依赖当前登录用户与数据库实时状态，
// 绝不能被 Next 在构建期预渲染成静态文件（会泄漏构建机的数据快照，
// 并且在部署后永远返回同一份旧数据）。
export const dynamic = "force-dynamic";

// 分页常量与夹紧函数统一从 lib/pagination.ts 取。
//
// 这里原本自己抄了一份 toBoundedInt 和三个常量 —— 同一语义的第二份实现。
// 两份的差异已经不痛不痒但真实存在（本地版不处理空字符串 ""，
// 共享版处理），而这种「看着一样、改一处忘一处」的分叉正是本项目
// 反复踩的坑：V 组测试就是靠共享版才守住 limit=999999 会被夹到 100。

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
      // 用关系过滤，而不是 where.id = { notIn: readIds }。
      //
      // 后者在已读数达到 1000 时会直接报 P2029：
      //   "Parameter limits for this database provider require this query to be
      //    split into multiple queries, but the negation filters used prevent the
      //    query from being split."
      // SQLite 的绑定变量上限是 999，没读过的文章越多这个 id 列表就越长；
      // 而否定过滤（NOT IN）无法被 Prisma 拆成多条查询规避，于是永久 500。
      // 这是「未读」筛选 —— 阅读器默认视图之一，日常用久了一定会撞上。
      //
      // 关系过滤把「排除已读」交给 SQL 的 NOT EXISTS 子查询，不携带 id 列表，
      // 因此与已读文章数无关。
      where.readHistories = { none: { userId: user.id } };
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
    //
    // 必须用「去重后」的口径，否则分页会飘：同一篇文章可能出现在多个源里
    // （全文 RSS + 摘要 RSS、聚合站转载），列表是按 link 去重后再截到 pageSize 的。
    // 改动前 total 是去重前的行数，实测 pageSize=100 时 14 页累计 1322 行 = total，
    // 但唯一 id 只有 1251 —— 用户翻到最后几页看到空白页，而页码显示还没到底。
    //
    // 曾经担心 groupBy 全表太贵，实测反直觉：count 30ms、groupBy link 9ms
    // （count 要扫行，groupBy 走 link 索引）。所以直接用精确值，不做近似。
    const distinctLinks = await prisma.article.groupBy({ by: ["link"], where });
    const total = distinctLinks.length;

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
      // 列表接口不取全文。
      //
      // 之前这里用 include 把 content 一起拉回来：每篇文章正文平均 6KB，
      // 一页 50 篇就是 300KB 起步（实测某期日报单篇 58KB，一页将近 3MB），
      // 而列表界面只显示标题、摘要和缩略图 —— 全文 100% 是浪费。
      // 用户点开某篇时前端再去 /api/articles/:id 取正文，
      // 那条路径会做「剥掉重复标题」等只有正文才需要的处理。
      select: {
        id: true,
        title: true,
        description: true,
        link: true,
        author: true,
        pubDate: true,
        imageUrl: true,
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
      // skip 按「去重前的行」算。去重发生在取回之后，两者有约 5% 的错位
      // （实测 1343 行 / 1271 个唯一 link），表现为深翻页时某页少几条。
      // 想彻底对齐需要把去重下推到 SQL（窗口函数），代价是查询复杂度
      // 陡增而后端每页只多出个位数条目 —— 不值得。
      // 页码的上限用去重后的 total 算，所以不会出现「翻到最后是空白页
      // 但页码还没到底」。
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
    //
    // 两个改动：
    //   1) 用关系过滤代替 id: { notIn: readIds } —— 同一个 P2029 坑，
    //      已读数过千时这里也会 500（count 同样受 SQLite 绑定变量上限约束）。
    //   2) 尊重 feedId / groupId / 搜索条件 —— 原来无论选的是哪个源，
    //      都返回全站未读数。实测选中一个只有 6 篇文章的源时，
    //      接口返回 total=6 但 unreadCount=1203，
    //      前端只好把它丢掉、改用「当前页里未读的条数」（≤50），
    //      于是左栏未读角标和实际差两个数量级。
    const unreadWhere: Prisma.ArticleWhereInput = { ...where };
    delete (unreadWhere as { readHistories?: unknown }).readHistories;
    unreadWhere.readHistories = { none: { userId: user.id } };

    const unreadCount = await prisma.article.count({ where: unreadWhere });

    // 格式化返回数据
    const formattedArticles = articles.map((article) => ({
      id: article.id,
      title: article.title,
      // description 来自第三方 RSS，部分源往里塞 HTML 片段，剥成纯文本再返回
      description: sanitizePlainText(article.description),
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

// POST /api/articles - 把所有未读文章标记为已读
//
// 路径就是 /api/articles 本身（App Router 的 POST 挂在目录上），
// 不是 /api/articles/mark-all-read。历史上这句注释写的是后者，
// 前端照着它调用拿到 405，于是「全部已读」按钮一直是坏的 ——
// 而服务端这个端点写了却全仓零调用方。
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

    const parsed = await readJsonBody<{ feedId?: string }>(req, "请提供 feedId");
    if (!parsed.ok) return parsed.response;
    const { feedId } = parsed.data;

    // 构建查询条件（同上，用精确类型而非 any）
    //
    // 「未读」用关系过滤而不是 id: { notIn: readIds }：
    // 已读数超过 999 时后者会触发 SQLite 的绑定变量上限（P2029），
    // 而 NOT IN 无法被 Prisma 拆成多条查询规避 —— 表现为标记已读永久 500。
    // 这个分支和列表接口的 type=unread 是同一个坑，必须一起用关系过滤。
    let where: Prisma.ArticleWhereInput = {
      feed: {
        subscriptions: {
          some: {
            userId: user.id,
          },
        },
      },
      readHistories: { none: { userId: user.id } },
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
    //
    // 用 createMany 而不是逐条 upsert：一个用了一年的库里未读可能有几千篇，
    // 逐条 await 就是几千次往返，请求会拖到网关超时；而上面的 where
    // 已经排除了已读，不存在需要 update 的冲突行。
    const newReadHistories = unreadArticles.map((article) => ({
      userId: user.id,
      articleId: article.id,
      readAt: new Date(),
    }));

    if (newReadHistories.length > 0) {
      await prisma.readHistory.createMany({ data: newReadHistories });
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
