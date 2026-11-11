import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

describe('文章已读状态集成测试', () => {
  let testUser: any;
  let testFeed: any;
  let testArticle: any;
  let authToken: string;

  beforeAll(async () => {
    // 创建测试用户
    const hashedPassword = await bcrypt.hash('test123456', 10);
    testUser = await prisma.user.create({
      data: {
        email: 'integration-test@example.com',
        nickname: '集成测试用户',
        passwordHash: hashedPassword,
        status: 'ACTIVE',
      },
    });

    // 创建测试RSS源
    testFeed = await prisma.feed.create({
      data: {
        url: 'https://test-feed.example.com/rss',
        title: '测试RSS源',
        description: '用于集成测试的RSS源',
        category: 'TECH',
        language: 'zh-CN',
        syncStatus: 'SUCCESS',
        lastSyncAt: new Date(),
        isActive: true,
      },
    });

    // 创建订阅关系
    await prisma.subscription.create({
      data: {
        userId: testUser.id,
        feedId: testFeed.id,
        isNotify: true,
      },
    });

    // 创建测试文章
    testArticle = await prisma.article.create({
      data: {
        feedId: testFeed.id,
        title: '集成测试文章',
        description: '这是一篇用于集成测试的文章',
        content: '<p>测试内容</p>',
        link: 'https://test.example.com/article/1',
        author: '测试作者',
        pubDate: new Date(),
        guid: 'test-article-1',
      },
    });

    // 模拟登录获取token
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'integration-test@example.com',
        password: 'test123456',
      }),
    });
    const loginData = await loginRes.json();
    authToken = loginData.data?.token || '';
  });

  afterAll(async () => {
    // 清理测试数据
    await prisma.readHistory.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.favorite.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.subscription.deleteMany({
      where: { userId: testUser.id },
    });
    await prisma.article.deleteMany({
      where: { feedId: testFeed.id },
    });
    await prisma.feed.delete({
      where: { id: testFeed.id },
    });
    await prisma.user.delete({
      where: { id: testUser.id },
    });
  });

  describe('文章已读状态流程', () => {
    it('应该能够标记文章为已读', async () => {
      const res = await fetch(
        `http://localhost:3000/api/articles/${testArticle.id}/read`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `token=${authToken}`,
          },
        }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.articleId).toBe(testArticle.id);
      expect(data.data.feedUnreadCount).toBeDefined();
      expect(data.data.totalUnreadCount).toBeDefined();

      // 验证数据库记录
      const readHistory = await prisma.readHistory.findUnique({
        where: {
          userId_articleId: {
            userId: testUser.id,
            articleId: testArticle.id,
          },
        },
      });
      expect(readHistory).not.toBeNull();
    });

    it('应该能够检查文章已读状态', async () => {
      const res = await fetch(
        `http://localhost:3000/api/articles/${testArticle.id}/read`,
        {
          headers: {
            Cookie: `token=${authToken}`,
          },
        }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.isRead).toBe(true);
      expect(data.data.readAt).not.toBeNull();
    });

    it('应该能够标记文章为未读', async () => {
      const res = await fetch(
        `http://localhost:3000/api/articles/${testArticle.id}/read`,
        {
          method: 'DELETE',
          headers: {
            Cookie: `token=${authToken}`,
          },
        }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      // 验证数据库记录已删除
      const readHistory = await prisma.readHistory.findUnique({
        where: {
          userId_articleId: {
            userId: testUser.id,
            articleId: testArticle.id,
          },
        },
      });
      expect(readHistory).toBeNull();
    });
  });

  describe('文章收藏功能流程', () => {
    it('应该能够收藏文章', async () => {
      const res = await fetch(
        `http://localhost:3000/api/articles/${testArticle.id}/favorite`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `token=${authToken}`,
          },
        }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.isFavorited).toBe(true);

      // 验证数据库记录
      const favorite = await prisma.favorite.findUnique({
        where: {
          userId_articleId: {
            userId: testUser.id,
            articleId: testArticle.id,
          },
        },
      });
      expect(favorite).not.toBeNull();
    });

    it('应该能够检查文章收藏状态', async () => {
      const res = await fetch(
        `http://localhost:3000/api/articles/${testArticle.id}/favorite`,
        {
          headers: {
            Cookie: `token=${authToken}`,
          },
        }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.isFavorited).toBe(true);
    });

    it('应该能够取消收藏文章', async () => {
      const res = await fetch(
        `http://localhost:3000/api/articles/${testArticle.id}/favorite`,
        {
          method: 'DELETE',
          headers: {
            Cookie: `token=${authToken}`,
          },
        }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.isFavorited).toBe(false);

      // 验证数据库记录已删除
      const favorite = await prisma.favorite.findUnique({
        where: {
          userId_articleId: {
            userId: testUser.id,
            articleId: testArticle.id,
          },
        },
      });
      expect(favorite).toBeNull();
    });
  });

  describe('未读计数功能', () => {
    it('应该正确计算RSS源未读数量', async () => {
      // 先标记文章为已读
      await fetch(
        `http://localhost:3000/api/articles/${testArticle.id}/read`,
        {
          method: 'POST',
          headers: {
            Cookie: `token=${authToken}`,
          },
        }
      );

      // 获取文章列表
      const res = await fetch(
        `http://localhost:3000/api/articles?feedId=${testFeed.id}`,
        {
          headers: {
            Cookie: `token=${authToken}`,
          },
        }
      );
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.unreadCount).toBeDefined();
    });
  });
});

describe('文章列表API集成测试', () => {
  it('应该返回包含已读状态的文章列表', async () => {
    const res = await fetch('http://localhost:3000/api/articles', {
      headers: {
        Cookie: `token=test-token`,
      },
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data.articles)).toBe(true);
    
    if (data.data.articles.length > 0) {
      const article = data.data.articles[0];
      expect(article).toHaveProperty('id');
      expect(article).toHaveProperty('title');
      expect(article).toHaveProperty('isRead');
      expect(article).toHaveProperty('isFavorited');
    }
  });

  it('应该支持按已读状态过滤文章', async () => {
    const res = await fetch('http://localhost:3000/api/articles?status=unread', {
      headers: {
        Cookie: `token=test-token`,
      },
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data.articles)).toBe(true);
  });

  it('应该支持按收藏状态过滤文章', async () => {
    const res = await fetch('http://localhost:3000/api/articles?favorite=true', {
      headers: {
        Cookie: `token=test-token`,
      },
    });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data.articles)).toBe(true);
  });
});
