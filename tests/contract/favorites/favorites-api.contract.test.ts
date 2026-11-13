/**
 * API Contract Tests for Favorites
 *
 * 这组用例在改写前 6 条全红，原因是整套断言对着一个「并不存在」的 REST 风格接口写：
 *   - 断言 `POST /api/favorites/:articleId`（实际是 `POST /api/favorites {articleId}`，且是 toggle 语义）
 *   - 断言 `DELETE /api/favorites/:articleId`（实际是 `DELETE /api/favorites?ids=a,b` 批量删除）
 *   - 断言响应体 `{ success, data: [...] }`（实际是 `{ favorites, pagination }`，没有 success/data 包裹）
 *   - 断言字段 `isStarred`（实际是 `isFavorited`）
 *
 * 这说明契约表本身写错了，不是接口坏了。这里按 app/api/favorites/route.ts 的真实行为重写，
 * 并且每条断言都指向「接口真的会这样返回」。
 */

import { test, expect } from '@playwright/test';
import articleSummarySchema from '../../schemas/article-summary.schema.json';
import { validate } from 'jsonschema';
import { extractTokenFromResponse } from '../shared/auth';
import { registerAndLogin } from '../shared/user';

const BASE_URL = 'http://localhost:3000/api';

// 这组用例共用「同一个用户 + 同一篇文章 + 同一个收藏状态」，
// 而 playwright.config.ts 是 fullyParallel: true —— 并发跑时
// TC-ACT-044 刚收藏、TC-ACT-045 又切一次，互相把状态翻掉，
// 变红的位置每次都不一样（每次单跑都能过）。
// 契约测试验的是「接口契约」，不是吞吐，串行才是正确语义。
test.describe.configure({ mode: 'serial' });

let authToken: string;
let testArticleId: string;

test.beforeAll(async ({ request }) => {
  // 注册与登录统一走 tests/contract/shared/user.ts。
  // 每个文件自己写一遍且不检查注册状态码时，连跑第二轮会撞上
  // 注册全局限流（60 次/分钟）→ login 401 → 报错却是
  // 「Set-Cookie 里没有 token」，看起来像鉴权坏了。
  // helper 遇到 429 会按 retryAfter 等一下再重试。
  const user = await registerAndLogin(request, {
    prefix: 'fav',
    nickname: 'FavoritesTest',
  });
  authToken = user.token;

  // 新注册用户没有任何订阅，也就看不到任何文章；这里借演示账号的订阅
  // 是做不到的（越权），所以先订阅一个源再取它导入的文章。
  await request.post(`${BASE_URL}/feeds/subscriptions`, {
    data: { url: 'https://sspai.com/feed' },
    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
  });

  const articlesResponse = await request.get(`${BASE_URL}/articles?pageSize=1`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const articlesBody = await articlesResponse.json();
  testArticleId = articlesBody.data?.articles?.[0]?.id;
});

/**
 * 把某篇文章的收藏状态设成指定值。
 *
 * POST /api/favorites 是 toggle 语义，不能靠「先点一次清空、再点一次收藏」
 * —— 如果它本来就是未收藏，第一次点击反而收藏了，第二次才是收藏成功，
 * 断言就拿到 false。必须先读状态，只在需要时切换一次。
 */
async function setFavorited(
  request: any,
  articleId: string,
  want: boolean
): Promise<void> {
  const read = async (): Promise<boolean> => {
    const response = await request.get(`${BASE_URL}/articles/${articleId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    return (await response.json()).data.isFavorited;
  };

  if ((await read()) !== want) {
    await request.post(`${BASE_URL}/favorites`, {
      data: { articleId },
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
  }
}

/**
 * TC-ACT-043: Get Favorites List
 * Priority: P0
 */
test('TC-ACT-043: Get Favorites List', async ({ request }) => {
  const response = await request.get(`${BASE_URL}/favorites`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  expect(response.status()).toBe(200);

  const body = await response.json();

  // 这个接口没有 { success, data } 包裹 —— 直接是 { favorites, pagination }。
  // 这是项目里三套响应包络之一，短期不改（前端就这么消费的），
  // 契约测试应当如实记录，而不是逼接口迎合一个想象出来的形状。
  expect(Array.isArray(body.favorites)).toBe(true);
  expect(body).toHaveProperty('pagination');
  expect(body.pagination).toHaveProperty('total');

  // 列表项的形状是 { id, articleId, createdAt, article } —— 是「收藏关系」，
  // 不是裸文章。article 子对象才是文章本体。
  if (body.favorites.length > 0) {
    const favorite = body.favorites[0];
    expect(favorite).toHaveProperty('id');
    expect(favorite).toHaveProperty('articleId');
    expect(favorite).toHaveProperty('article');

    const validationResult = validate(favorite.article, articleSummarySchema);
    expect(
      validationResult.valid,
      validationResult.errors?.map((e) => e.message).join(', ')
    ).toBe(true);

    // 注意：内嵌 article 没有 isFavorited 字段（见 article-summary.schema.json），
    // 「已收藏」这件事由收藏关系本身表达，不靠字段重复声明。
  }

  console.log(
    `✅ TC-ACT-043 PASSED: Favorites list contract validated (found ${body.favorites.length} favorites)`
  );
});

/**
 * TC-ACT-044: Add Article to Favorites
 * Priority: P0
 */
test('TC-ACT-044: Add Article to Favorites', async ({ request }) => {
  if (!testArticleId) {
    console.log('⏸️ TC-ACT-044 SKIPPED: No article available');
    test.skip();
    return;
  }

  // 先确保处于「未收藏」（toggle 语义下必须按状态操作，不能盲点）
  await setFavorited(request, testArticleId, false);

  // Act
  const response = await request.post(`${BASE_URL}/favorites`, {
    data: { articleId: testArticleId },
    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
  });

  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.isFavorited).toBe(true);
  expect(body.favorite).toBeDefined();

  // Verify article appears in favorites list
  const favoritesResponse = await request.get(`${BASE_URL}/favorites`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const favoritesBody = await favoritesResponse.json();
  const found = favoritesBody.favorites.find(
    (f: any) => f.articleId === testArticleId
  );
  expect(found).toBeDefined();

  console.log('✅ TC-ACT-044 PASSED: Add to favorites contract validated');
});

/**
 * TC-ACT-045: Add Same Article to Favorites Twice
 * Priority: P1
 */
test('TC-ACT-045: Add Same Article to Favorites Twice', async ({ request }) => {
  if (!testArticleId) {
    console.log('⏸️ TC-ACT-045 SKIPPED: No article available');
    test.skip();
    return;
  }

  // 清到「未收藏」
  await setFavorited(request, testArticleId, false);

  const first = await request.post(`${BASE_URL}/favorites`, {
    data: { articleId: testArticleId },
    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
  });
  expect((await first.json()).isFavorited).toBe(true);

  // Act - 再点一次
  const second = await request.post(`${BASE_URL}/favorites`, {
    data: { articleId: testArticleId },
    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
  });

  // Assert - 第二次是「取消收藏」，不是重复插入报错：
  // Prisma 的 (userId, articleId) 唯一约束在这里被 toggle 分支绕开了。
  expect(second.status()).toBe(200);
  const body = await second.json();
  expect(body.isFavorited).toBe(false);
  expect(body.message).toBe('已取消收藏');

  console.log('✅ TC-ACT-045 PASSED: Duplicate favorite handled correctly');
});

/**
 * TC-ACT-046: Remove Article from Favorites
 * Priority: P0
 */
test('TC-ACT-046: Remove Article from Favorites', async ({ request }) => {
  if (!testArticleId) {
    console.log('⏸️ TC-ACT-046 SKIPPED: No article available');
    test.skip();
    return;
  }

  // Arrange - 确保已收藏
  await setFavorited(request, testArticleId, true);

  // 找到这条收藏关系自身的 id（批量删除用的是 favorite.id，不是 articleId）
  const listBefore = await request.get(`${BASE_URL}/favorites`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const favoriteId = (await listBefore.json()).favorites.find(
    (f: any) => f.articleId === testArticleId
  )?.id;
  expect(favoriteId).toBeDefined();

  // Act - DELETE /api/favorites?ids=xxx（批量删除接口）
  const response = await request.delete(`${BASE_URL}/favorites?ids=${favoriteId}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.message).toBe('已删除 1 个收藏');

  // Verify it's gone
  const favoritesResponse = await request.get(`${BASE_URL}/favorites`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const favoritesBody = await favoritesResponse.json();
  expect(
    favoritesBody.favorites.find((f: any) => f.articleId === testArticleId)
  ).toBeUndefined();

  console.log('✅ TC-ACT-046 PASSED: Remove from favorites contract validated');
});

/**
 * TC-ACT-047: Remove Non-Favorited Article
 * Priority: P1
 */
test('TC-ACT-047: Remove Non-Favorited Article', async ({ request }) => {
  // 传一个不存在的 favorite id：deleteMany 匹配 0 条，接口仍然 200，
  // 消息如实说「已删除 0 个收藏」——
  // 早先用 ids.length 报数会说「已删除 1 个」，是错的（Gate A 一并修了）。
  const response = await request.delete(`${BASE_URL}/favorites?ids=non-existent-id`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.message).toBe('已删除 0 个收藏');

  console.log('✅ TC-ACT-047 PASSED: Remove non-existent favorite handled correctly');
});

/**
 * TC-ACT-048: Get Favorites - Missing Authorization
 * Priority: P0
 */
test('TC-ACT-048: Get Favorites - Missing Authorization', async ({ request }) => {
  const response = await request.get(`${BASE_URL}/favorites`);
  expect(response.status()).toBe(401);
  console.log('✅ TC-ACT-048 PASSED: Missing authorization rejected');
});

/**
 * TC-ACT-049: Add to Favorites - Missing Authorization
 * Priority: P0
 */
test('TC-ACT-049: Add to Favorites - Missing Authorization', async ({ request }) => {
  if (!testArticleId) {
    console.log('⏸️ TC-ACT-049 SKIPPED: No article available');
    test.skip();
    return;
  }

  const response = await request.post(`${BASE_URL}/favorites`, {
    data: { articleId: testArticleId },
    headers: { 'Content-Type': 'application/json' }
  });

  expect(response.status()).toBe(401);
  console.log('✅ TC-ACT-049 PASSED: Missing authorization rejected');
});

/**
 * TC-ACT-050: Remove from Favorites - Missing Authorization
 * Priority: P0
 */
test('TC-ACT-050: Remove from Favorites - Missing Authorization', async ({ request }) => {
  const response = await request.delete(`${BASE_URL}/favorites?ids=some-id`);
  expect(response.status()).toBe(401);
  console.log('✅ TC-ACT-050 PASSED: Missing authorization rejected');
});

/**
 * TC-ACT-051: Favorites Schema Validation
 * Priority: P1
 */
test('TC-ACT-051: Favorites Schema Validation', async ({ request }) => {
  if (!testArticleId) {
    console.log('⏸️ TC-ACT-051 SKIPPED: No article available');
    test.skip();
    return;
  }

  // Arrange - 确保已收藏
  await setFavorited(request, testArticleId, true);

  const response = await request.get(`${BASE_URL}/favorites`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  const favorites = (await response.json()).favorites;
  expect(favorites.length).toBeGreaterThan(0);

  const validationResult = validate(favorites[0].article, articleSummarySchema);
  expect(
    validationResult.valid,
    validationResult.errors?.map((e) => e.message).join(', ')
  ).toBe(true);

  expect(favorites[0].article.id).toBeDefined();
  expect(favorites[0].article.title).toBeDefined();

  console.log('✅ TC-ACT-051 PASSED: Favorites schema validated');
});

/**
 * TC-ACT-052: Get Favorites - Empty List
 * Priority: P2
 */
test('TC-ACT-052: Get Favorites - Empty List', async ({ request }) => {
  // Arrange - 一次性清空（批量删除，ids 用收藏关系 id）
  const before = await request.get(`${BASE_URL}/favorites?limit=100`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const ids = (await before.json()).favorites.map((f: any) => f.id);
  if (ids.length > 0) {
    await request.delete(`${BASE_URL}/favorites?ids=${ids.join(',')}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
  }

  // Act
  const response = await request.get(`${BASE_URL}/favorites`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.favorites).toEqual([]);
  expect(body.pagination.total).toBe(0);

  console.log('✅ TC-ACT-052 PASSED: Empty favorites list returns valid structure');
});

/**
 * TC-ACT-053: Favorites and Articles List Consistency
 * Priority: P1
 */
test('TC-ACT-053: Favorites and Articles List Consistency', async ({ request }) => {
  if (!testArticleId) {
    console.log('⏸️ TC-ACT-053 SKIPPED: No article available');
    test.skip();
    return;
  }

  // Arrange - 确保已收藏
  await setFavorited(request, testArticleId, true);

  // Act - 收藏页与「只看收藏」的文章列表应当一致
  //
  // 过滤参数是 `type=favorite`（app/api/articles/route.ts:135）。
  // 早期用例传 `isStarred=true`，后来我改成 `isFavorited=true` —— 两个都不是
  // 后端认识的参数，服务端直接忽略过滤条件，返回全部文章，数量必然不等。
  // 「参数名写错」在 GET 上不会报错，只会静默退化，这类错误最难靠肉眼发现。
  const articlesResponse = await request.get(`${BASE_URL}/articles?type=favorite&pageSize=100`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const favoritesResponse = await request.get(`${BASE_URL}/favorites?limit=100`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  const starredArticles = (await articlesResponse.json()).data.articles;
  const favorites = (await favoritesResponse.json()).favorites;

  expect(starredArticles.map((a: any) => a.id).sort()).toEqual(
    favorites.map((f: any) => f.article.id).sort()
  );

  console.log('✅ TC-ACT-053 PASSED: Favorites and starred articles consistent');
});

/**
 * TC-ACT-054: Toggle Favorite Status
 * Priority: P1
 */
test('TC-ACT-054: Toggle Favorite Status', async ({ request }) => {
  if (!testArticleId) {
    console.log('⏸️ TC-ACT-054 SKIPPED: No article available');
    test.skip();
    return;
  }

  const readState = async () => {
    const response = await request.get(`${BASE_URL}/articles/${testArticleId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    return (await response.json()).data.isFavorited;
  };

  // 先归到一个确定状态，避免依赖上一条用例留下的值
  await setFavorited(request, testArticleId, false);
  const initialState = await readState();
  expect(initialState).toBe(false);

  // Act - 点一次应当翻转成已收藏
  await request.post(`${BASE_URL}/favorites`, {
    data: { articleId: testArticleId },
    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
  });

  expect(await readState()).toBe(true);

  // Act - 再点一次应当翻回未收藏
  await request.post(`${BASE_URL}/favorites`, {
    data: { articleId: testArticleId },
    headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
  });

  expect(await readState()).toBe(false);

  console.log('✅ TC-ACT-054 PASSED: Favorite status toggle works correctly');
});
