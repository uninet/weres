/**
 * 初始化预设数据脚本
 * 创建访客用户和预设 RSS 源
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 预设 RSS 源列表
const PRESET_FEEDS = [
  {
    url: 'https://www.ruanyifeng.com/blog/atom.xml',
    title: '阮一峰的网络日志',
    description: '每周五发布，分享科技新闻和技术文章',
    category: 'TECH',
    icon: 'https://api.dicebear.com/7.x/initials/svg?seed=ruanyf',
  },
  {
    url: 'https://36kr.com/feed',
    title: '36 氪',
    description: '关注互联网创业和科技创新',
    category: 'NEWS',
    icon: 'https://api.dicebear.com/7.x/initials/svg?seed=36kr',
  },
  {
    url: 'https://www.huxiu.com/rss/0.xml',
    title: '虎嗅网',
    description: '商业资讯和创业故事',
    category: 'NEWS',
    icon: 'https://api.dicebear.com/7.x/initials/svg?seed=huxiu',
  },
  {
    url: 'https://sspai.com/feed',
    title: '少数派',
    description: '高效工作，品质生活',
    category: 'TECH',
    icon: 'https://api.dicebear.com/7.x/initials/svg?seed=sspai',
  },
  {
    url: 'https://www.geekpark.net/rss',
    title: '极客公园',
    description: '关注前沿科技和创新产品',
    category: 'TECH',
    icon: 'https://api.dicebear.com/7.x/initials/svg?seed=geekpark',
  },
  {
    url: 'https://www.ifanr.com/feed',
    title: '爱范儿',
    description: '科技让生活更美好',
    category: 'TECH',
    icon: 'https://api.dicebear.com/7.x/initials/svg?seed=ifanr',
  },
  {
    url: 'https://solidot.org/index.rss',
    title: 'Solidot',
    description: '奇客的资讯，重要的东西',
    category: 'TECH',
    icon: 'https://api.dicebear.com/7.x/initials/svg?seed=solidot',
  },
  {
    url: 'https://www.pingwest.com/feed',
    title: '品玩',
    description: '有性格的科技媒体',
    category: 'NEWS',
    icon: 'https://api.dicebear.com/7.x/initials/svg?seed=pingwest',
  },
];

// 访客用户 ID
const GUEST_USER_ID = 'guest-user-id';

async function main() {
  console.log('🌱 开始初始化预设数据...');

  // 1. 创建或获取访客用户
  let guestUser = await prisma.user.findUnique({
    where: { id: GUEST_USER_ID },
  });

  if (!guestUser) {
    guestUser = await prisma.user.create({
      data: {
        id: GUEST_USER_ID,
        email: 'guest@werss.com',
        nickname: '访客用户',
        status: 'ACTIVE',
        passwordHash: '', // 访客用户不需要密码
      },
    });
    console.log('✅ 创建访客用户');
  } else {
    console.log('✓ 访客用户已存在');
  }

  // 2. 创建预设 RSS 源
  console.log('\n📡 添加预设 RSS 源...');
  for (const feedData of PRESET_FEEDS) {
    try {
      const feed = await prisma.feed.upsert({
        where: { url: feedData.url },
        update: {
          title: feedData.title,
          description: feedData.description,
          category: feedData.category,
          icon: feedData.icon,
          isActive: true,
        },
        create: {
          url: feedData.url,
          title: feedData.title,
          description: feedData.description,
          category: feedData.category,
          icon: feedData.icon,
          isActive: true,
          syncStatus: 'PENDING',
        },
      });

      console.log(`  ✓ ${feed.title}`);

      // 3. 为访客用户创建订阅
      await prisma.subscription.upsert({
        where: {
          userId_feedId: {
            userId: GUEST_USER_ID,
            feedId: feed.id,
          },
        },
        update: {},
        create: {
          userId: GUEST_USER_ID,
          feedId: feed.id,
          isNotify: false,
        },
      });

      // 4. 创建 MarketFeed
      await prisma.marketFeed.upsert({
        where: { feedId: feed.id },
        update: {
          category: feedData.category,
          isFeatured: true,
        },
        create: {
          feedId: feed.id,
          category: feedData.category,
          isFeatured: true,
          subscriberCount: Math.floor(Math.random() * 10000) + 1000,
          status: 'ACTIVE',
        },
      });
    } catch (error) {
      console.error(`  ✗ 添加 ${feedData.title} 失败:`, error);
    }
  }

  console.log('\n📁 创建默认分组');

  // 5. 为访客用户创建默认分组
  let techGroup = await prisma.group.findFirst({
    where: {
      userId: GUEST_USER_ID,
      name: '科技资讯',
    },
  });

  if (!techGroup) {
    techGroup = await prisma.group.create({
      data: {
        userId: GUEST_USER_ID,
        name: '科技资讯',
        sortOrder: 1,
      },
    });
  }
  console.log(`  ✓ ${techGroup.name}`);

  let newsGroup = await prisma.group.findFirst({
    where: {
      userId: GUEST_USER_ID,
      name: '新闻媒体',
    },
  });

  if (!newsGroup) {
    newsGroup = await prisma.group.create({
      data: {
        userId: GUEST_USER_ID,
        name: '新闻媒体',
        sortOrder: 2,
      },
    });
  }
  console.log(`  ✓ ${newsGroup.name}`);

  // 6. 将订阅分配到分组
  const techFeeds = await prisma.feed.findMany({
    where: { category: { in: ['TECH'] } },
  });

  const newsFeeds = await prisma.feed.findMany({
    where: { category: { in: ['NEWS'] } },
  });

  for (const feed of techFeeds) {
    await prisma.subscription.updateMany({
      where: {
        userId: GUEST_USER_ID,
        feedId: feed.id,
      },
      data: {
        groupId: techGroup.id,
      },
    });
  }

  for (const feed of newsFeeds) {
    await prisma.subscription.updateMany({
      where: {
        userId: GUEST_USER_ID,
        feedId: feed.id,
      },
      data: {
        groupId: newsGroup.id,
      },
    });
  }

  console.log('\n📦 分配订阅到分组');

  // 7. 同步 RSS 源文章
  console.log('\n🔄 开始同步 RSS 源文章...');
  const { syncAllFeeds } = await import('@/lib/rss-parser');
  const result = await syncAllFeeds();
  
  if (result.success) {
    const successCount = result.results.filter((r: any) => r.success).length;
    console.log(`✅ 同步完成：${successCount}/${result.results.length} 成功`);
  }

  console.log('\n✨ 初始化完成！');
  console.log('\n💡 提示:');
  console.log('  - 访客用户 ID: guest-user-id');
  console.log('  - 预设 RSS 源数量:', PRESET_FEEDS.length);
  console.log('  - 现在可以访问阅读器查看文章');
}

main()
  .catch((e) => {
    console.error('❌ 初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
