import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import marketFeedCatalog from '../data/market-feeds.json';

const prisma = new PrismaClient();

async function main() {
  console.log('开始创建测试数据...');

  // 创建测试用户
  const hashedPassword = await bcrypt.hash('123456', 10);
  
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      nickname: '测试用户',
      passwordHash: hashedPassword,
      bio: '这是一个测试账号，用于体验 WeRSS 功能',
      status: 'ACTIVE',
    },
  });

  console.log('✓ 测试用户创建成功:', user.email);

  // 创建示例 RSS 源
  const feeds = await Promise.all([
    prisma.feed.upsert({
      where: { url: 'https://ruanyifeng.com/blog/atom.xml' },
      update: {},
      create: {
        url: 'https://ruanyifeng.com/blog/atom.xml',
        title: '阮一峰的网络日志',
        description: '阮一峰的个人博客，分享技术、读书、生活感悟',
        category: '技术',
        language: 'zh-CN',
        syncStatus: 'SUCCESS',
        isActive: true,
      },
    }),
    prisma.feed.upsert({
      where: { url: 'https://www.36kr.com/feed' },
      update: {},
      create: {
        url: 'https://www.36kr.com/feed',
        title: '36氪',
        description: '让一部分人先看到未来',
        category: '新闻',
        language: 'zh-CN',
        syncStatus: 'SUCCESS',
        isActive: true,
      },
    }),
    prisma.feed.upsert({
      where: { url: 'https://sspai.com/feed' },
      update: {},
      create: {
        url: 'https://sspai.com/feed',
        title: '少数派',
        description: '高效工作，品质生活',
        category: '技术',
        language: 'zh-CN',
        syncStatus: 'SUCCESS',
        isActive: true,
      },
    }),
  ]);

  console.log('✓ RSS 源创建成功:', feeds.length, '个');

  // 把上面这些源同时登记到 RSS 市场。
  // 不写这一步的话，README 让人跑完 seed 打开 /market 会是一片空白
  // —— 因为市场页读的是 MarketFeed 表，而这里只建了 Feed。
  await Promise.all(
    feeds.map((feed, index) =>
      prisma.marketFeed.upsert({
        where: { feedId: feed.id },
        update: {},
        create: {
          feedId: feed.id,
          category: feed.category || 'OTHER',
          // 演示数据，不需要假装有真实订阅量；固定值而不是随机数，
          // 这样重复执行 seed 的结果是稳定的。
          subscriberCount: 0,
          isFeatured: index === 0,
          status: 'ACTIVE',
        },
      })
    )
  );

  console.log('✓ RSS 市场源创建成功:', feeds.length, '个');

  // 导入 RSS 市场目录（data/market-feeds.json）。
  //
  // 这批源是从 QiReader 的公开发现页（按最近 7 天有更新的中文源）
  // 抓下来整理的，共 894 个，覆盖技术、新闻、博客、商业、生活、
  // 科学、视频七类。它们只登记成「市场里的可选项」，不会自动变成
  // 某个用户的订阅 —— 用户要自己在 /market 里点订阅。
  //
  // 用 upsert 而不是 create：重复执行 seed 不会重复插入，也不会
  // 覆盖用户已经改过的分类。
  let catalogCreated = 0;
  for (const item of marketFeedCatalog) {
    try {
      const feed = await prisma.feed.upsert({
        where: { url: item.url },
        update: {},
        create: {
          url: item.url,
          title: item.title,
          description: item.description || null,
          category: item.category,
          syncStatus: 'PENDING',
          isActive: true,
        },
        select: { id: true },
      });

      const existingMarket = await prisma.marketFeed.findUnique({
        where: { feedId: feed.id },
        select: { id: true },
      });

      if (!existingMarket) {
        await prisma.marketFeed.create({
          data: {
            feedId: feed.id,
            category: item.category,
            subscriberCount: 0,
            isFeatured: false,
            status: 'ACTIVE',
          },
        });
        catalogCreated++;
      }
    } catch (error) {
      // 单个源失败不该让整个 seed 中断（比如某个 URL 违反唯一约束）
      console.warn('  跳过市场源:', item.url, error instanceof Error ? error.message : error);
    }
  }

  console.log(
    '✓ RSS 市场目录导入完成: 新增',
    catalogCreated,
    '个（目录共',
    marketFeedCatalog.length,
    '个）'
  );

  // 创建分组
  const group = await prisma.group.upsert({
    where: { id: 'default-group' },
    update: {},
    create: {
      id: 'default-group',
      userId: user.id,
      name: '默认分组',
      sortOrder: 0,
    },
  });

  console.log('✓ 分组创建成功:', group.name);

  // 创建订阅关系
  const subscriptions = await Promise.all(
    feeds.map((feed, index) =>
      prisma.subscription.upsert({
        where: {
          userId_feedId: {
            userId: user.id,
            feedId: feed.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          feedId: feed.id,
          groupId: group.id,
          isNotify: true,
        },
      })
    )
  );

  console.log('✓ 订阅关系创建成功:', subscriptions.length, '个');

  // 创建示例文章
  const articles = await Promise.all([
    prisma.article.upsert({
      where: { feedId_guid: { feedId: feeds[0].id, guid: 'article-1' } },
      update: {},
      create: {
        feedId: feeds[0].id,
        title: '2024年前端技术趋势展望',
        description: '随着AI技术的快速发展，前端开发领域正在经历深刻的变革。本文将探讨2024年最值得关注的几个技术趋势...',
        content: `<p>随着AI技术的快速发展，前端开发领域正在经历深刻的变革。本文将探讨2024年最值得关注的几个技术趋势。</p>
        
<h2>1. AI辅助编程</h2>
<p>AI编程助手如GitHub Copilot、Cursor等工具正在改变开发者的工作方式。这些工具不仅能提供代码补全，还能帮助生成完整的函数和组件。</p>

<h2>2. 边缘计算</h2>
<p>边缘计算的兴起使得前端应用能够在更接近用户的地方运行，大大降低了延迟，提升了用户体验。</p>

<h2>3. WebAssembly</h2>
<p>WebAssembly的成熟使得在浏览器中运行高性能应用成为可能，为游戏、视频编辑等复杂应用打开了新的大门。</p>

<h2>4. 微前端架构</h2>
<p>微前端架构继续发展，帮助大型团队更好地协作，实现独立部署和技术栈的多样化。</p>`,
        link: 'https://example.com/article-1',
        author: '阮一峰',
        pubDate: new Date(),
        guid: 'article-1',
      },
    }),
    prisma.article.upsert({
      where: { feedId_guid: { feedId: feeds[0].id, guid: 'article-2' } },
      update: {},
      create: {
        feedId: feeds[0].id,
        title: 'React 19新特性详解',
        description: 'React 19带来了许多令人兴奋的新特性，包括改进的并发渲染、新的Hooks以及更好的性能优化...',
        content: `<p>React 19带来了许多令人兴奋的新特性，让我们一起来了解一下。</p>

<h2>并发渲染改进</h2>
<p>React 19进一步优化了并发渲染机制，使得应用在处理大量更新时更加流畅。</p>

<h2>新的Hooks</h2>
<p>React 19引入了多个新的Hooks，包括use、useOptimistic等，为开发者提供了更多的工具。</p>

<h2>性能优化</h2>
<p>React 19在性能方面做了大量优化，包括更智能的reconciliation算法和更高效的组件更新机制。</p>`,
        link: 'https://example.com/article-2',
        author: 'React团队',
        pubDate: new Date(Date.now() - 1000 * 60 * 60 * 2),
        guid: 'article-2',
      },
    }),
    prisma.article.upsert({
      where: { feedId_guid: { feedId: feeds[1].id, guid: 'article-3' } },
      update: {},
      create: {
        feedId: feeds[1].id,
        title: 'AI创业热潮：机遇与挑战并存',
        description: '2024年，AI创业领域持续升温。从ChatGPT到各种垂直领域的AI应用，创业者们正在探索AI技术的无限可能...',
        content: `<p>2024年，AI创业领域持续升温。从ChatGPT到各种垂直领域的AI应用，创业者们正在探索AI技术的无限可能。</p>

<h2>市场机遇</h2>
<p>AI技术的快速发展为创业者提供了前所未有的机遇。从内容创作到客户服务，从数据分析到代码生成，AI正在重塑各个行业。</p>

<h2>技术挑战</h2>
<p>尽管机遇巨大，但AI创业也面临着诸多挑战，包括技术门槛、数据获取、模型训练成本等问题。</p>

<h2>投资建议</h2>
<p>对于想要进入AI创业领域的创业者，建议从垂直细分领域入手，专注于解决特定场景下的实际问题。</p>`,
        link: 'https://example.com/article-3',
        author: '36氪',
        pubDate: new Date(Date.now() - 1000 * 60 * 60 * 5),
        guid: 'article-3',
      },
    }),
    prisma.article.upsert({
      where: { feedId_guid: { feedId: feeds[2].id, guid: 'article-4' } },
      update: {},
      create: {
        feedId: feeds[2].id,
        title: '效率工具推荐：2024年值得关注的10款应用',
        description: '在这个信息爆炸的时代，选择合适的效率工具至关重要。本文推荐10款2024年值得关注的效率工具...',
        content: `<p>在这个信息爆炸的时代，选择合适的效率工具至关重要。本文推荐10款2024年值得关注的效率工具。</p>

<h2>笔记工具</h2>
<p>Notion、Obsidian、Logseq等笔记工具各有特色，适合不同的使用场景。</p>

<h2>任务管理</h2>
<p>Things 3、Todoist、Microsoft To Do等任务管理工具帮助你更好地规划时间。</p>

<h2>阅读工具</h2>
<p>Readwise、Instapaper、Pocket等阅读工具让你更好地管理和阅读网络文章。</p>

<h2>自动化工具</h2>
<p>Zapier、IFTTT、Shortcuts等自动化工具可以帮你节省大量重复性工作的时间。</p>`,
        link: 'https://example.com/article-4',
        author: '少数派',
        pubDate: new Date(Date.now() - 1000 * 60 * 60 * 24),
        guid: 'article-4',
      },
    }),
  ]);

  console.log('✓ 示例文章创建成功:', articles.length, '篇');

  // 创建收藏记录
  const favorite = await prisma.favorite.upsert({
    where: {
      userId_articleId: {
        userId: user.id,
        articleId: articles[0].id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      articleId: articles[0].id,
    },
  });

  console.log('✓ 收藏记录创建成功');

  // 创建阅读历史
  const readHistory = await prisma.readHistory.upsert({
    where: {
      userId_articleId: {
        userId: user.id,
        articleId: articles[1].id,
      },
    },
    update: {},
    create: {
      userId: user.id,
      articleId: articles[1].id,
    },
  });

  console.log('✓ 阅读历史创建成功');

  // 创建通知
  // Notification 上没有 (userId, type, title) 唯一约束，
  // 所以不能用 upsert，只能先查后建 —— 否则重复跑 seed 会不断堆积重复通知。
  const NOTIFICATIONS = [
    {
      type: 'SYSTEM',
      title: '欢迎使用 WeRSS',
      content: '感谢使用 WeRSS，开始你的 RSS 阅读之旅吧！',
      data: null,
    },
    {
      type: 'FEED_UPDATE',
      title: '新文章提醒',
      content: '你订阅的 RSS 源有新文章更新',
      data: JSON.stringify({ feedName: '阮一峰的网络日志' }),
    },
  ];

  const notifications = [];
  for (const item of NOTIFICATIONS) {
    const existing = await prisma.notification.findFirst({
      where: { userId: user.id, type: item.type, title: item.title },
    });
    notifications.push(
      existing ??
        (await prisma.notification.create({
          data: {
            userId: user.id,
            type: item.type,
            title: item.title,
            content: item.content,
            data: item.data,
          },
        }))
    );
  }

  console.log('✓ 通知创建成功:', notifications.length, '条');

  console.log('\n=================================');
  console.log('测试数据创建完成！');
  console.log('=================================');
  console.log('测试账号信息：');
  console.log('  邮箱: test@example.com');
  console.log('  密码: 123456');
  console.log('=================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
