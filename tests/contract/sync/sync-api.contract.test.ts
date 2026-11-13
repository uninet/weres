/**
 * API Contract Tests for Sync
 *
 * 原先 9/10 全红，两类根因都不是「同步坏了」：
 *   1. 所有 POST 都没带请求体。`/api/sync` 现在统一走 readJsonBody，
 *      空 body 返回 400「请提供 feedId，或传空对象同步全部」——
 *      这正好是想要的健壮性，但用例仍在断言 200。
 *   2. 断言 `data.synced` / `data.newArticles`，而真实响应是
 *      `{ success, message, count }`（单源）或 `{ success, results: [...] }`（全部）。
 *      `synced`/`newArticles` 只存在于 OpenAPI 文档的想象里。
 *
 * 另外：不带 feedId 的「同步全部」在这台实例上会串行抓几十个源、跑几分钟，
 * 拿它做「响应时间 < 30s」的断言等于测第三方站点今天快不快。
 * 这里改成「单源同步」来验响应时间与形状。
 */

import { test, expect } from '@playwright/test';
import { extractTokenFromResponse } from '../shared/auth';
import { registerAndLogin } from '../shared/user';

const BASE_URL = 'http://localhost:3000/api';

let authToken: string;
let testFeedId: string;

// 共用同一个用户与同一个订阅
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  // 注册与登录统一走 tests/contract/shared/user.ts。
  // 每个文件自己写一遍且不检查注册状态码时，连跑第二轮会撞上
  // 注册全局限流（60 次/分钟）→ login 401 → 报错却是
  // 「Set-Cookie 里没有 token」，看起来像鉴权坏了。
  // helper 遇到 429 会按 retryAfter 等一下再重试。
  const user = await registerAndLogin(request, {
    prefix: 'sync',
    nickname: 'SyncTest',
  });
  authToken = user.token;

  // 订阅一个实测稳定的源，供后续单源同步使用
  const subscribe = await request.post(`${BASE_URL}/feeds/subscriptions`, {
    data: { url: 'https://sspai.com/feed' },
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });
  const subscribeBody = await subscribe.json();
  testFeedId = subscribeBody.data?.subscription?.feed?.id;
});

/**
 * TC-ACT-055: Trigger Manual Sync
 * Priority: P0
 */
test('TC-ACT-055: Trigger Manual Sync', async ({ request }) => {
  expect(testFeedId).toBeTruthy();

  // Act - 同步单个源（响应形状是 { success, message, count }）
  const response = await request.post(`${BASE_URL}/sync`, {
    data: { feedId: testFeedId },
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toHaveProperty('success', true);
  expect(body).toHaveProperty('message');
  expect(typeof body.count).toBe('number');
  expect(body.count).toBeGreaterThanOrEqual(0);

  console.log(`✅ TC-ACT-055 PASSED: manual sync returned ${body.count} new articles`);
});

/**
 * TC-ACT-056: Sync Response Structure Validation
 * Priority: P0
 */
test('TC-ACT-056: Sync Response Structure Validation', async ({ request }) => {
  const response = await request.post(`${BASE_URL}/sync`, {
    data: { feedId: testFeedId },
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  expect(response.status()).toBe(200);

  const body = await response.json();
  // 只用这三个字段，不多不少 —— 断言「包含」比断言「完全等于」更稳，
  // 但额外字段必须能说出来源，否则等于默许接口随便加东西。
  expect(Object.keys(body).sort()).toEqual(['count', 'message', 'success']);
  expect(body.message).toContain('同步完成');

  console.log('✅ TC-ACT-056 PASSED: sync response structure validated');
});

/**
 * TC-ACT-057: Sync - Missing Authorization
 * Priority: P0
 */
test('TC-ACT-057: Sync - Missing Authorization', async ({ request }) => {
  const response = await request.post(`${BASE_URL}/sync`, {
    data: { feedId: testFeedId },
    headers: { 'Content-Type': 'application/json' }
  });

  expect(response.status()).toBe(401);
  console.log('✅ TC-ACT-057 PASSED: missing authorization rejected');
});

/**
 * TC-ACT-058: Sync - 空请求体
 * Priority: P1
 */
test('TC-ACT-058: Sync - Empty Body Rejected', async ({ request }) => {
  // 早期这里断言「0 订阅时同步成功返回 synced: 0」。
  // 现在的行为更明确：没有 body 直接 400，并告诉调用方两种合法写法。
  // 这比「静默跑一遍什么也不做」好 —— 前端传错 body 时立刻能发现。
  const response = await request.post(`${BASE_URL}/sync`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  expect(response.status()).toBe(400);

  const body = await response.json();
  expect(body.success).toBe(false);
  expect(body.message).toContain('feedId');

  console.log('✅ TC-ACT-058 PASSED: empty body rejected with actionable message');
});

/**
 * TC-ACT-059: Sync Response Time
 * Priority: P2
 */
test('TC-ACT-059: Sync Response Time', async ({ request }) => {
  // 单源同步：时间上界只受「一个源能不能抓」影响，
  // 不受「这个实例订阅了几十个源」影响 —— 后者会让这条断言随库增长而崩。
  const startTime = Date.now();
  const response = await request.post(`${BASE_URL}/sync`, {
    data: { feedId: testFeedId },
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });
  const responseTime = Date.now() - startTime;

  expect(response.status()).toBe(200);
  expect(responseTime).toBeLessThan(60000);

  console.log(`✅ TC-ACT-059 PASSED: single-feed sync took ${responseTime}ms`);
});

/**
 * TC-ACT-060: Sync With New Articles
 * Priority: P1
 */
test('TC-ACT-060: Sync With New Articles', async ({ request }) => {
  // 连续同步两次：第一次可能带回新文章，第二次应当基本为 0。
  // 这里不断言「必须有新文章」—— 源没更新时新增就是 0，那是正确行为。
  const first = await request.post(`${BASE_URL}/sync`, {
    data: { feedId: testFeedId },
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });
  expect(first.status()).toBe(200);
  const firstBody = await first.json();

  const second = await request.post(`${BASE_URL}/sync`, {
    data: { feedId: testFeedId },
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });
  expect(second.status()).toBe(200);
  const secondBody = await second.json();

  // 紧邻的第二次同步不应「新增」比第一次更多（去重逻辑在工作）
  expect(secondBody.count).toBeLessThanOrEqual(firstBody.count);

  console.log(
    `✅ TC-ACT-060 PASSED: dedupe works (first ${firstBody.count}, second ${secondBody.count})`
  );
});

/**
 * TC-ACT-061: Sync Error Handling - 他人的源
 * Priority: P0
 */
test('TC-ACT-061: Sync Error Handling - Foreign Feed', async ({ request }) => {
  // 用一个新账号去同步「别人订阅的源」：必须 404。
  // 这是 /api/sync 的租户边界 —— 不加这道校验，任何人拿到 feedId
  // 就能让服务器替他抓那个源，等于免费的匿名抓取代理。
  const other = {
    email: `sync-foreign-${Date.now()}@werss.com`,
    password: 'Test@123456',
    nickname: 'SyncForeign'
  };
  await request.post(`${BASE_URL}/auth/register`, {
    data: other,
    headers: { 'Content-Type': 'application/json' }
  });
  const loginResponse = await request.post(`${BASE_URL}/auth/login`, {
    data: { email: other.email, password: other.password },
    headers: { 'Content-Type': 'application/json' }
  });
  const otherToken = extractTokenFromResponse(loginResponse);

  const response = await request.post(`${BASE_URL}/sync`, {
    data: { feedId: testFeedId },
    headers: {
      'Authorization': `Bearer ${otherToken}`,
      'Content-Type': 'application/json'
    }
  });

  expect(response.status()).toBe(404);

  const body = await response.json();
  expect(body.success).toBe(false);

  console.log('✅ TC-ACT-061 PASSED: foreign feed sync rejected');
});

/**
 * TC-ACT-062: Consecutive Sync Requests
 * Priority: P1
 */
test('TC-ACT-062: Consecutive Sync Requests', async ({ request }) => {
  // 连续三次：要么都成功，要么在后段触发限流（429）。
  // 断言「每次都 200」等于假设限流不存在，而限流是刻意加的。
  const statuses: number[] = [];
  for (let i = 0; i < 3; i++) {
    const response = await request.post(`${BASE_URL}/sync`, {
      data: { feedId: testFeedId },
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    statuses.push(response.status());
  }

  for (const status of statuses) {
    expect([200, 429]).toContain(status);
  }
  // 至少前一次必须成功，否则说明限流过紧
  expect(statuses[0]).toBe(200);

  console.log(`✅ TC-ACT-062 PASSED: consecutive sync statuses ${statuses.join(',')}`);
});

/**
 * TC-ACT-063: Sync Data Integrity - GET 状态
 * Priority: P1
 */
test('TC-ACT-063: Sync Data Integrity - Status Endpoint', async ({ request }) => {
  const response = await request.get(`${BASE_URL}/sync`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.success).toBe(true);
  expect(Array.isArray(body.data)).toBe(true);

  // 只含「我订阅的源」。这条断言的守备意义在于：Feed 是全局实体，
  // 一旦有人把 where 条件写掉，这里会从这个用户自己的源变成全库源。
  const subscribeList = await request.get(`${BASE_URL}/feeds/subscriptions`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const groups = (await subscribeList.json()).data.groups;
  const ownedFeedIds = new Set(
    Object.values(groups).flatMap((g: any) => g.subscriptions.map((s: any) => s.feedId))
  );

  expect(body.data.length).toBe(ownedFeedIds.size);
  for (const feed of body.data) {
    expect(ownedFeedIds.has(feed.id)).toBe(true);
  }

  console.log(`✅ TC-ACT-063 PASSED: status returns only ${body.data.length} owned feeds`);
});

/**
 * TC-ACT-064: Sync Response Contains Valid Fields
 * Priority: P1
 */
test('TC-ACT-064: Sync Response Contains Valid Fields', async ({ request }) => {
  const response = await request.get(`${BASE_URL}/sync`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.data.length).toBeGreaterThan(0);

  const feed = body.data[0];
  expect(feed).toHaveProperty('id');
  expect(feed).toHaveProperty('title');
  expect(feed).toHaveProperty('syncStatus');
  expect(['IDLE', 'SYNCING', 'SUCCESS', 'FAILED']).toContain(feed.syncStatus);
  expect(feed).toHaveProperty('errorCount');
  expect(typeof feed.errorCount).toBe('number');

  console.log('✅ TC-ACT-064 PASSED: sync status fields validated');
});
