import { describe, it, expect, beforeEach, vi } from 'vitest';
import { prisma } from '@/lib/prisma';
import { getCurrentUserFromRequest } from '@/lib/auth';

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    article: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    readHistory: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
      // 路由里用它算出「哪些文章已读」再统计未读数，
      // 漏了它会让整条 POST/DELETE 路径在 mock 里直接抛 TypeError
      findMany: vi.fn(),
    },
    favorite: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock auth
// read / favorite 两个路由改用 getCurrentUserFromRequest（同时支持
// Cookie 与 Authorization: Bearer，与其余 20 个路由保持一致）。
// 这里两个名字都导出：mock 只提供旧名字时，路由拿到的会是 undefined，
// 报错是「xxx is not a function」，看起来像路由坏了，实际是 mock 落后了。
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
  getCurrentUserFromRequest: vi.fn(),
}));

describe('文章已读状态 API', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    nickname: '测试用户',
    avatar: null,
    kindleEmail: null,
  };
  const mockArticle = {
    id: 'article-1',
    title: '测试文章',
    feedId: 'feed-1',
    feed: { id: 'feed-1', title: '测试RSS源' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/articles/:id/read', () => {
    it('应该成功标记文章为已读', async () => {
      vi.mocked(getCurrentUserFromRequest).mockResolvedValue(mockUser);
      vi.mocked(prisma.article.findUnique).mockResolvedValue(mockArticle as any);
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({ id: 'sub-1' } as any);
      vi.mocked(prisma.readHistory.upsert).mockResolvedValue({
        id: 'history-1',
        userId: mockUser.id,
        articleId: mockArticle.id,
        readAt: new Date(),
      } as any);
      vi.mocked(prisma.readHistory.findMany).mockResolvedValue([]);
      vi.mocked(prisma.article.count).mockResolvedValue(5);

      const { POST } = await import('@/app/api/articles/[id]/read/route');
      const req = new Request('http://localhost:3000/api/articles/article-1/read', {
        method: 'POST',
      });
      const res = await POST(req, { params: { id: 'article-1' } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('已标记为已读');
      expect(data.data.articleId).toBe('article-1');
      expect(prisma.readHistory.upsert).toHaveBeenCalledWith({
        where: {
          userId_articleId: {
            userId: mockUser.id,
            articleId: 'article-1',
          },
        },
        update: { readAt: expect.any(Date) },
        create: {
          userId: mockUser.id,
          articleId: 'article-1',
          readAt: expect.any(Date),
        },
      });
    });

    it('未登录时应该返回401', async () => {
      vi.mocked(getCurrentUserFromRequest).mockResolvedValue(null);

      const { POST } = await import('@/app/api/articles/[id]/read/route');
      const req = new Request('http://localhost:3000/api/articles/article-1/read', {
        method: 'POST',
      });
      const res = await POST(req, { params: { id: 'article-1' } });
      const data = await res.json();

      expect(res.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.message).toBe('未登录');
    });

    it('文章不存在时应该返回404', async () => {
      vi.mocked(getCurrentUserFromRequest).mockResolvedValue(mockUser);
      vi.mocked(prisma.article.findUnique).mockResolvedValue(null);

      const { POST } = await import('@/app/api/articles/[id]/read/route');
      const req = new Request('http://localhost:3000/api/articles/article-1/read', {
        method: 'POST',
      });
      const res = await POST(req, { params: { id: 'article-1' } });
      const data = await res.json();

      expect(res.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.message).toBe('文章不存在');
    });

    it('未订阅RSS源时应该返回403', async () => {
      vi.mocked(getCurrentUserFromRequest).mockResolvedValue(mockUser);
      vi.mocked(prisma.article.findUnique).mockResolvedValue(mockArticle as any);
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);

      const { POST } = await import('@/app/api/articles/[id]/read/route');
      const req = new Request('http://localhost:3000/api/articles/article-1/read', {
        method: 'POST',
      });
      const res = await POST(req, { params: { id: 'article-1' } });
      const data = await res.json();

      expect(res.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.message).toBe('您未订阅该RSS源');
    });
  });

  describe('DELETE /api/articles/:id/read', () => {
    it('应该成功标记文章为未读', async () => {
      vi.mocked(getCurrentUserFromRequest).mockResolvedValue(mockUser);
      vi.mocked(prisma.article.findUnique).mockResolvedValue(mockArticle as any);
      vi.mocked(prisma.readHistory.deleteMany).mockResolvedValue({ count: 1 } as any);
      vi.mocked(prisma.article.count).mockResolvedValue(10);

      const { DELETE } = await import('@/app/api/articles/[id]/read/route');
      const req = new Request('http://localhost:3000/api/articles/article-1/read', {
        method: 'DELETE',
      });
      const res = await DELETE(req, { params: { id: 'article-1' } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('已标记为未读');
      expect(prisma.readHistory.deleteMany).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          articleId: 'article-1',
        },
      });
    });
  });

  describe('GET /api/articles/:id/read', () => {
    it('应该返回文章已读状态', async () => {
      vi.mocked(getCurrentUserFromRequest).mockResolvedValue(mockUser);
      vi.mocked(prisma.readHistory.findUnique).mockResolvedValue({
        id: 'history-1',
        userId: mockUser.id,
        articleId: 'article-1',
        readAt: new Date('2024-01-01'),
      } as any);

      const { GET } = await import('@/app/api/articles/[id]/read/route');
      const req = new Request('http://localhost:3000/api/articles/article-1/read');
      const res = await GET(req, { params: { id: 'article-1' } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.isRead).toBe(true);
      expect(data.data.readAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('应该返回文章未读状态', async () => {
      vi.mocked(getCurrentUserFromRequest).mockResolvedValue(mockUser);
      vi.mocked(prisma.readHistory.findUnique).mockResolvedValue(null);

      const { GET } = await import('@/app/api/articles/[id]/read/route');
      const req = new Request('http://localhost:3000/api/articles/article-1/read');
      const res = await GET(req, { params: { id: 'article-1' } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.isRead).toBe(false);
      expect(data.data.readAt).toBeNull();
    });
  });
});

describe('文章收藏 API', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    nickname: '测试用户',
    avatar: null,
    kindleEmail: null,
  };
  const mockArticle = {
    id: 'article-1',
    title: '测试文章',
    feedId: 'feed-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/articles/:id/favorite', () => {
    it('应该成功收藏文章', async () => {
      vi.mocked(getCurrentUserFromRequest).mockResolvedValue(mockUser);
      vi.mocked(prisma.article.findUnique).mockResolvedValue(mockArticle as any);
      // 收藏现在要求「文章属于本人订阅的源」（与 read 同一判据），
      // 不 mock 这条订阅记录就会被 404 挡住 —— 那是守卫在工作，不是坏了。
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({ id: 'sub-1' } as any);
      vi.mocked(prisma.favorite.upsert).mockResolvedValue({
        id: 'fav-1',
        userId: mockUser.id,
        articleId: mockArticle.id,
        createdAt: new Date(),
      } as any);

      const { POST } = await import('@/app/api/articles/[id]/favorite/route');
      const req = new Request('http://localhost:3000/api/articles/article-1/favorite', {
        method: 'POST',
      });
      const res = await POST(req, { params: { id: 'article-1' } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('已添加到收藏');
      expect(data.data.isFavorited).toBe(true);
    });

    it('收藏别人源里的文章应该返回404', async () => {
      vi.mocked(getCurrentUserFromRequest).mockResolvedValue(mockUser);
      vi.mocked(prisma.article.findUnique).mockResolvedValue(mockArticle as any);
      // 没有订阅记录 = 这篇文章不属于当前用户
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null);
      // 如果守卫失效，这条会被调用 —— 用它来证明操作没有落到数据库
      const upsert = vi.mocked(prisma.favorite.upsert);
      upsert.mockClear();

      const { POST } = await import('@/app/api/articles/[id]/favorite/route');
      const req = new Request('http://localhost:3000/api/articles/article-1/favorite', {
        method: 'POST',
      });
      const res = await POST(req, { params: { id: 'article-1' } });

      expect(res.status).toBe(404);
      // 关键断言：不是「返回了 404」，而是「根本没写库」
      expect(upsert).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/articles/:id/favorite', () => {
    it('应该成功取消收藏', async () => {
      vi.mocked(getCurrentUserFromRequest).mockResolvedValue(mockUser);
      vi.mocked(prisma.favorite.deleteMany).mockResolvedValue({ count: 1 } as any);

      const { DELETE } = await import('@/app/api/articles/[id]/favorite/route');
      const req = new Request('http://localhost:3000/api/articles/article-1/favorite', {
        method: 'DELETE',
      });
      const res = await DELETE(req, { params: { id: 'article-1' } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('已取消收藏');
      expect(data.data.isFavorited).toBe(false);
    });
  });

  describe('GET /api/articles/:id/favorite', () => {
    it('应该返回文章已收藏状态', async () => {
      vi.mocked(getCurrentUserFromRequest).mockResolvedValue(mockUser);
      vi.mocked(prisma.favorite.findUnique).mockResolvedValue({
        id: 'fav-1',
        userId: mockUser.id,
        articleId: 'article-1',
        createdAt: new Date('2024-01-01'),
      } as any);

      const { GET } = await import('@/app/api/articles/[id]/favorite/route');
      const req = new Request('http://localhost:3000/api/articles/article-1/favorite');
      const res = await GET(req, { params: { id: 'article-1' } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.isFavorited).toBe(true);
    });

    it('应该返回文章未收藏状态', async () => {
      vi.mocked(getCurrentUserFromRequest).mockResolvedValue(mockUser);
      vi.mocked(prisma.favorite.findUnique).mockResolvedValue(null);

      const { GET } = await import('@/app/api/articles/[id]/favorite/route');
      const req = new Request('http://localhost:3000/api/articles/article-1/favorite');
      const res = await GET(req, { params: { id: 'article-1' } });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.isFavorited).toBe(false);
    });
  });
});
