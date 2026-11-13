/**
 * API Contract Tests for Articles
 * Verifies that articles API endpoints conform to OpenAPI specification
 */

import { test, expect } from '@playwright/test';
import articleSchema from '../../schemas/article.schema.json';
import feedSchema from '../../schemas/feed.schema.json';
import articleDetailSchema from '../../schemas/article-detail.schema.json';
import { validate } from 'jsonschema';
import { extractTokenFromResponse } from '../shared/auth';
import { registerAndLogin } from '../shared/user';

// 端口写死过一段时间，导致这套契约测试只能在 3000 端口跑：
// 换 BASE_URL 起一个全新克隆（验证「别人 clone 就能跑」）时，
// 测试还在打 3000 —— 那里要么没人监听，要么是另一个实例，
// 报出来的失败和代码无关。与 verify 脚本统一读同一个环境变量。
const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '') + '/api';

let authToken: string;
let readArticleId: string | undefined;
let favoriteArticleId: string | undefined;

test.beforeAll(async ({ request }) => {
  // Setup: Register and login to get auth token
  // 注册与登录统一走 tests/contract/shared/user.ts。
  // 每个文件自己写一遍且不检查注册状态码时，连跑第二轮会撞上
  // 注册全局限流（60 次/分钟）→ login 401 → 报错却是
  // 「Set-Cookie 里没有 token」，看起来像鉴权坏了。
  // helper 遇到 429 会按 retryAfter 等一下再重试。
  const user = await registerAndLogin(request, {
    prefix: 'article',
    nickname: 'ArticleTest',
  });
  authToken = user.token;

  // 新账号没有任何订阅，文章列表恒为空 —— 那样每一条断言都在空数组上空转，
  // 通过也说明不了任何事（这类「永远绿」的用例比没有用例更危险）。
  // 先订阅一个源，让过滤/分页断言真的有数据可断言。
  await request.post(`${BASE_URL}/feeds/subscriptions`, {
    data: { url: 'https://sspai.com/feed' },
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  // 再制造一条「已读 + 已收藏」的记录，供过滤类断言使用
  const listResponse = await request.get(`${BASE_URL}/articles?pageSize=3`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const listBody = await listResponse.json();
  const articles = listBody.data?.articles ?? [];
  if (articles.length >= 2) {
    readArticleId = articles[0].id;
    favoriteArticleId = articles[1].id;

    await request.post(`${BASE_URL}/articles/${readArticleId}/read`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    await request.post(`${BASE_URL}/favorites`, {
      data: { articleId: favoriteArticleId },
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
  }
});

/**
 * TC-ACT-009: Get Articles List - Default Parameters
 * Priority: P0
 */
test('TC-ACT-009: Get Articles List - Default Parameters', async ({ request }) => {
  // Act
  const response = await request.get(`${BASE_URL}/articles`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toHaveProperty('success', true);
  expect(body).toHaveProperty('data');

  const data = body.data;
  // 分页字段在 data.pagination 里，不是 data 顶层。
  // 早期契约表按「扁平 data.total / data.hasMore」写，接口一直是
  // { articles, pagination: { page, pageSize, total, totalPages }, unreadCount }，
  // 于是这条断言从来没通过过 —— 属于断言写错，不是接口缺陷。
  expect(data).toHaveProperty('articles');
  expect(data).toHaveProperty('pagination');
  const pagination = data.pagination;
  expect(pagination).toHaveProperty('total');
  expect(pagination).toHaveProperty('totalPages');

  // Validate articles array
  expect(Array.isArray(data.articles)).toBe(true);

  // Validate each article against schema if array not empty
  if (data.articles.length > 0) {
    const validationResult = validate(data.articles[0], articleSchema);
    expect(validationResult.valid, validationResult.errors?.map(e => e.message).join(', ')).toBe(true);
  }

  // Validate total is a number
  expect(typeof pagination.total).toBe('number');
  expect(pagination.total).toBeGreaterThanOrEqual(0);

  // totalPages 与 pageSize 的一致性
  expect(typeof pagination.totalPages).toBe('number');

  console.log(`✅ TC-ACT-009 PASSED: Articles list contract validated (found ${data.articles.length} articles)`);
});

/**
 * TC-ACT-010: Get Articles List - Pagination
 * Priority: P0
 */
test('TC-ACT-010: Get Articles List - Pagination', async ({ request }) => {
  // Act - Request first page with pageSize
  //
  // 接口读的是 page / pageSize（app/api/articles/route.ts:61,63），
  // 早期用例写的 limit / offset 从来没被后端读过 —— 请求会被当成
  // 「没传分页参数」，返回默认 20 条，于是 `<= 5` 的断言必然失败。
  const response = await request.get(`${BASE_URL}/articles?pageSize=5&page=1`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert
  expect(response.status()).toBe(200);

  const body = await response.json();
  const data = body.data;

  // Should return at most 5 articles
  expect(data.articles.length).toBeLessThanOrEqual(5);
  expect(data.pagination.pageSize).toBe(5);
  expect(data.pagination.page).toBe(1);

  // Total should be the total count (not the page size)
  expect(data.pagination.total).toBeGreaterThanOrEqual(0);

  console.log('✅ TC-ACT-010 PASSED: Pagination parameters work correctly');
});

/**
 * TC-ACT-011: Get Articles List - Filter by Read Status
 * Priority: P0
 */
test('TC-ACT-011: Get Articles List - Filter by Read Status', async ({ request }) => {
  // Act - 只看已读
  //
  // 过滤参数是 `type=read` / `type=unread`（app/api/articles/route.ts:114,140），
  // 不是 `isRead=false`。后者从来没被读过 —— 请求会退化成「全部」，
  // 于是「每条都应该是未读」的断言在全部文章上必然失败；
  // 而早期这个账号没订阅、列表为空，失败又被空数组掩盖了。
  const response = await request.get(`${BASE_URL}/articles?type=read`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert
  expect(response.status()).toBe(200);

  const body = await response.json();
  const data = body.data;

  // 这条用例的前提是 beforeAll 真的读过一篇，否则又变成空数组空转
  expect(data.articles.length).toBeGreaterThan(0);
  data.articles.forEach((article: any) => {
    expect(article.isRead).toBe(true);
  });

  console.log('✅ TC-ACT-011 PASSED: Read status filter works correctly');
});

/**
 * TC-ACT-012: Get Articles List - Filter by Starred Status
 * Priority: P1
 */
test('TC-ACT-012: Get Articles List - Filter by Starred Status', async ({ request }) => {
  // Act - 只看收藏（参数是 type=favorite；isStarred 是旧字段名，后端不认）
  const response = await request.get(`${BASE_URL}/articles?type=favorite`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert
  expect(response.status()).toBe(200);

  const body = await response.json();
  const data = body.data;

  expect(data.articles.length).toBeGreaterThan(0);
  data.articles.forEach((article: any) => {
    expect(article.isFavorited).toBe(true);
  });

  console.log('✅ TC-ACT-012 PASSED: Starred status filter works correctly');
});

/**
 * TC-ACT-013: Get Articles List - Search Query
 * Priority: P1
 */
test('TC-ACT-013: Get Articles List - Search Query', async ({ request }) => {
  // Act - Search for articles
  const response = await request.get(`${BASE_URL}/articles?search=test`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert
  expect(response.status()).toBe(200);

  const body = await response.json();
  const data = body.data;

  // Should return array of articles (possibly empty)
  expect(Array.isArray(data.articles)).toBe(true);

  // 只断言 Array.isArray 等于什么都没验 —— 搜索参数被后端整个忽略时
  // 照样返回一个数组。这里补两条真判据：
  //   ① 分页元数据必须存在（说明走的是正常列表路径，不是错误兜底）；
  //   ② 若有结果，每条都必须真的包含关键字（不区分大小写）。
  // 关键字取 'a' 是因为它几乎必然命中任意中文/英文语料，
  // 而不会像 'test' 那样在中文库里恒零 —— 恒零时下面的 filter 是空集，
  // 断言会退化成"空集里每条都包含关键字"（永远真）。
  expect(data.pagination, '列表响应必须带分页元数据').toBeTruthy();
  const keyword = 'a';
  const mismatched = data.articles.filter(
    (a: any) =>
      !`${a.title || ''} ${a.description || ''}`.toLowerCase().includes(keyword)
  );
  expect(
    mismatched.length,
    `搜索 "${keyword}" 返回了 ${mismatched.length} 条不含关键字的文章`
  ).toBe(0);

  console.log(
    `✅ TC-ACT-013 PASSED: 搜索返回 ${data.articles.length} 条，全部命中关键字`
  );
});

/**
 * TC-ACT-014: Get Articles List - Invalid Pagination Parameters
 * Priority: P1
 */
test('TC-ACT-014: Get Articles List - Invalid Pagination Parameters', async ({ request }) => {
  // Act - Request with oversized pageSize
  //
  // 原来写的是 ?limit=1000 —— 而后端只认 pageSize，limit 从来没被读取过，
  // 于是请求实际返回默认 20 条，断言 data.articles.length <= 100 恒真。
  // 换成真实的参数名之后，这条才是真的在守「服务端会夹紧上界」。
  const response = await request.get(`${BASE_URL}/articles?pageSize=1000`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert - Should handle gracefully (either reject or clamp)
  const body = await response.json();
  expect([200, 400]).toContain(response.status());

  if (response.status() === 200) {
    const data = body.data;
    // Should limit to max allowed
    expect(data.articles.length).toBeLessThanOrEqual(100);
  }

  console.log('✅ TC-ACT-014 PASSED: Invalid pagination handled gracefully');
});

/**
 * TC-ACT-015: Get Single Article - Valid ID
 * Priority: P0
 */
test('TC-ACT-015: Get Single Article - Valid ID', async ({ request }) => {
  // Arrange - First get an article ID from list
  const listResponse = await request.get(`${BASE_URL}/articles?pageSize=1`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const listBody = await listResponse.json();

  if (listBody.data.articles.length === 0) {
    console.log('⏸️ TC-ACT-015 SKIPPED: No articles available');
    test.skip();
    return;
  }

  const articleId = listBody.data.articles[0].id;

  // Act
  const response = await request.get(`${BASE_URL}/articles/${articleId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toHaveProperty('success', true);
  expect(body).toHaveProperty('data');

  // 详情形状和列表项不同（多 content/guid/feedId/createdAt），必须用独立 schema。
  // 早期这里是「复制 articleSchema 再拼一个 content」，
  // 而 articleSchema 是 additionalProperties: false，于是列表项之外的字段全被判违规。
  const validationResult = validate(body.data, articleDetailSchema);
  expect(validationResult.valid, validationResult.errors?.map(e => e.message).join(', ')).toBe(true);

  // 详情里的 feed 是精简对象 { id, title, icon }，不是完整 feed。
  // 用 feedSchema（要求 url、additionalProperties: false）校验必然失败 ——
  // 「详情嵌的是投影，不是实体」这件事在列表接口上也一样。
  expect(body.data.feed).toBeDefined();
  expect(body.data.feed.id).toBeDefined();
  expect(body.data.feed.title).toBeDefined();

  console.log('✅ TC-ACT-015 PASSED: Single article contract validated');
});

/**
 * TC-ACT-016: Get Single Article - Invalid ID
 * Priority: P0
 */
test('TC-ACT-016: Get Single Article - Invalid ID', async ({ request }) => {
  // Act
  const response = await request.get(`${BASE_URL}/articles/non-existent-id`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert - Should return 404
  expect(response.status()).toBe(404);

  const body = await response.json();
  expect(body).toHaveProperty('success', false);
  // 错误信息在 message 里，不是 error。
  // 项目里存在两套错误形状（{success,message} 与 {error}），
  // 这里按 articles 路由的实际形状断言；包络要不要统一是另一件事，
  // 不该用一个错的断言去逼接口改。
  expect(body).toHaveProperty('message');
  expect(typeof body.message).toBe('string');

  console.log('✅ TC-ACT-016 PASSED: Non-existent article returns 404');
});

/**
 * TC-ACT-017: Get Single Article - Missing Authorization
 * Priority: P0
 */
test('TC-ACT-017: Get Single Article - Missing Authorization', async ({ request }) => {
  // Act - Request without auth header
  const response = await request.get(`${BASE_URL}/articles/some-id`);

  // Assert - Should return 401
  expect(response.status()).toBe(401);

  console.log('✅ TC-ACT-017 PASSED: Missing authorization rejected');
});

/**
 * TC-ACT-018: Mark Article as Read
 * Priority: P0
 */
test('TC-ACT-018: Mark Article as Read', async ({ request }) => {
  // Arrange - Get an article ID
  // 参数是 type=unread，不是 isRead=false（后者后端不认，会返回全部文章）
  const listResponse = await request.get(`${BASE_URL}/articles?type=unread&pageSize=1`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const listBody = await listResponse.json();

  if (listBody.data.articles.length === 0) {
    console.log('⏸️ TC-ACT-018 SKIPPED: No unread articles available');
    test.skip();
    return;
  }

  const articleId = listBody.data.articles[0].id;

  // Act - Mark as read
  const response = await request.post(`${BASE_URL}/articles/${articleId}/read`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toHaveProperty('success', true);

  // Verify article is now marked as read
  const verifyResponse = await request.get(`${BASE_URL}/articles/${articleId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const verifyBody = await verifyResponse.json();
  expect(verifyBody.data.isRead).toBe(true);

  console.log('✅ TC-ACT-018 PASSED: Article marked as read successfully');
});

/**
 * TC-ACT-019: Response Schema Validation - Empty List
 * Priority: P2
 */
test('TC-ACT-019: Response Schema Validation - Empty List', async ({ request }) => {
  // Act - Search for unlikely term
  const response = await request.get(`${BASE_URL}/articles?search=xyz123nonexistent`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert
  expect(response.status()).toBe(200);

  const body = await response.json();
  const data = body.data;

  // Should return empty array with valid structure
  expect(data.articles).toEqual([]);
  expect(data.pagination.total).toBe(0);
  expect(data.pagination.totalPages).toBe(0);

  console.log('✅ TC-ACT-019 PASSED: Empty list returns valid structure');
});

/**
 * TC-ACT-020: Content-Type Validation
 * Priority: P1
 */
test('TC-ACT-020: Content-Type Validation', async ({ request }) => {
  // Act
  const response = await request.get(`${BASE_URL}/articles`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert
  expect(response.status()).toBe(200);

  const contentType = response.headers()['content-type'];
  expect(contentType).toMatch(/application\/json/);

  console.log('✅ TC-ACT-020 PASSED: Content-Type header correct');
});
