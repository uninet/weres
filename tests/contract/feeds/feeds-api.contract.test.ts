/**
 * API Contract Tests for Feeds / Subscriptions
 *
 * 这组用例原先 7/8 全红，根本原因是整套断言指向一个不存在的端点：
 * 它们打 `GET/POST /api/feeds`、`DELETE /api/feeds/:id`，
 * 而项目里只有 `/api/feeds/subscriptions`、`/api/feeds/subscriptions/[id]`、
 * `/api/feeds/validate` 三个路由。`/api/feeds` 在 Next 里没有对应 route.ts，
 * 请求会落进 `app/not-found.tsx` 返回整页 HTML + 404，于是
 * `response.json()` 抛 `Unexpected token '<'`，看起来像接口崩了。
 *
 * 这里按真实路由重写，断言也按真实响应形状写。
 */

import { test, expect } from '@playwright/test';
import feedSchema from '../../schemas/feed.schema.json';
import { validate } from 'jsonschema';
import { extractTokenFromResponse } from '../shared/auth';
import { registerAndLogin } from '../shared/user';

// 端口写死过一段时间，导致这套契约测试只能在 3000 端口跑：
// 换 BASE_URL 起一个全新克隆（验证「别人 clone 就能跑」）时，
// 测试还在打 3000 —— 那里要么没人监听，要么是另一个实例，
// 报出来的失败和代码无关。与 verify 脚本统一读同一个环境变量。
const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '') + '/api';

let authToken: string;
let testFeedId: string;
let testSubscriptionId: string;

// 共用同一个用户与同一个订阅，并发会互相踩（同 favorites 组）。
test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ request }) => {
  // 注册与登录统一走 tests/contract/shared/user.ts。
  // 每个文件自己写一遍且不检查注册状态码时，连跑第二轮会撞上
  // 注册全局限流（60 次/分钟）→ login 401 → 报错却是
  // 「Set-Cookie 里没有 token」，看起来像鉴权坏了。
  // helper 遇到 429 会按 retryAfter 等一下再重试。
  const user = await registerAndLogin(request, {
    prefix: 'feed',
    nickname: 'FeedTest',
  });
  authToken = user.token;
});

/**
 * TC-ACT-021: Get Feeds List
 * Priority: P0
 */
test('TC-ACT-021: Get Feeds List', async ({ request }) => {
  // 先订阅一个源，否则列表恒空，schema 断言无从谈起
  await request.post(`${BASE_URL}/feeds/subscriptions`, {
    data: { url: 'https://sspai.com/feed' },
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  const response = await request.get(`${BASE_URL}/feeds/subscriptions`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toHaveProperty('success', true);
  expect(body).toHaveProperty('data');

  // 注意形状：data 是「按分组聚合的 dict」，不是 list。
  // 早期契约表写 `expect(Array.isArray(body.data)).toBe(true)`，
  // 是照着 OpenAPI 文档想象的，和实现不一致。
  expect(Array.isArray(body.data)).toBe(false);
  expect(body.data).toHaveProperty('groups');

  const groups = body.data.groups;
  const groupKeys = Object.keys(groups);
  expect(groupKeys.length).toBeGreaterThan(0);

  const first = groups[groupKeys[0]];
  expect(first).toHaveProperty('group');
  expect(Array.isArray(first.subscriptions)).toBe(true);
  expect(first.subscriptions.length).toBeGreaterThan(0);

  const subscription = first.subscriptions[0];
  testFeedId = subscription.feed.id;
  testSubscriptionId = subscription.id;

  // 订阅项的形状：订阅关系 + feed 实体
  expect(subscription).toHaveProperty('id');
  expect(subscription).toHaveProperty('feedId');
  expect(subscription).toHaveProperty('isNotify');
  expect(subscription).toHaveProperty('unreadCount');

  const validationResult = validate(subscription.feed, feedSchema);
  expect(
    validationResult.valid,
    validationResult.errors?.map((e) => e.message).join(', ')
  ).toBe(true);

  console.log(`✅ TC-ACT-021 PASSED: Feeds list contract validated (${groupKeys.length} groups)`);
});

/**
 * TC-ACT-022: Subscribe to Feed - Valid RSS URL
 * Priority: P0
 */
test('TC-ACT-022: Subscribe to Feed - Valid RSS URL', async ({ request }) => {
  const response = await request.post(`${BASE_URL}/feeds/subscriptions`, {
    // 36kr 的 /feed 现在返回无法解析的内容（实测 "Feed not recognized as RSS 1 or 2"），
    // 换一个实测可用的源。注意：这条用例断言的是「订阅成功后的形状」，
    // 不是「某个站点的可用性」—— 用会挂的第三方地址等于把契约测试绑在别人的运维上。
    data: { url: 'https://www.geekpark.net/rss' },
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toHaveProperty('success', true);
  expect(body).toHaveProperty('data');
  expect(body.data).toHaveProperty('subscription');

  const subscription = body.data.subscription;
  expect(subscription.feed).toBeDefined();
  expect(subscription.feed.url).toBe('https://www.geekpark.net/rss');
  expect(subscription.feed.id).toBeDefined();
  expect(subscription.feed.title).toBeDefined();

  // 订阅记录必须挂到某个分组下 —— 否则阅读器左栏（只列「分组下的订阅」）
  // 永远看不到它，用户会以为订阅没成功。
  expect(subscription.groupId).toBeTruthy();

  testSubscriptionId = subscription.id;
  testFeedId = subscription.feed.id;

  console.log('✅ TC-ACT-022 PASSED: Feed subscription contract validated');
});

/**
 * TC-ACT-023: Subscribe to Feed - Invalid URL
 * Priority: P0
 */
test('TC-ACT-023: Subscribe to Feed - Invalid URL', async ({ request }) => {
  const response = await request.post(`${BASE_URL}/feeds/subscriptions`, {
    data: { url: 'not-a-url' },
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  // zod 的 z.string().url() 拦住 → 400
  expect(response.status()).toBe(400);

  const body = await response.json();
  expect(body).toHaveProperty('success', false);
  // 错误体是 { success, message }，没有 error 字段
  expect(body.message).toBeTruthy();

  console.log('✅ TC-ACT-023 PASSED: Invalid URL rejected');
});

/**
 * TC-ACT-024: Subscribe to Feed - Missing URL
 * Priority: P1
 */
test('TC-ACT-024: Subscribe to Feed - Missing URL', async ({ request }) => {
  const response = await request.post(`${BASE_URL}/feeds/subscriptions`, {
    data: {},
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body).toHaveProperty('success', false);

  console.log('✅ TC-ACT-024 PASSED: Missing URL rejected');
});

/**
 * TC-ACT-025: Subscribe to Feed - With Group
 * Priority: P1
 */
test('TC-ACT-025: Subscribe to Feed - With Group', async ({ request }) => {
  const groupResponse = await request.post(`${BASE_URL}/groups`, {
    data: { name: `契约测试分组-${Date.now()}` },
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  expect(groupResponse.status()).toBe(200);
  const groupBody = await groupResponse.json();
  const groupId = groupBody.data.id;
  expect(groupId).toBeTruthy();

  const response = await request.post(`${BASE_URL}/feeds/subscriptions`, {
    // groupId 必须是了 string（schema 是 z.string().optional()），
    // 传 null 会 zod 失败 → 400「输入数据无效」。
    data: { url: 'https://www.solidot.org/index.rss', groupId },
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.data.subscription.groupId).toBe(groupId);

  console.log('✅ TC-ACT-025 PASSED: Subscription placed in requested group');
});

/**
 * TC-ACT-026: Delete Subscription
 * Priority: P0
 */
test('TC-ACT-026: Delete Subscription', async ({ request }) => {
  // 新建一条专门用于删除的订阅，避免影响其他用例
  const created = await request.post(`${BASE_URL}/feeds/subscriptions`, {
    data: { url: 'https://www.ithome.com/rss/' },
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });
  expect(created.status()).toBe(200);
  const subscriptionId = (await created.json()).data.subscription.id;

  const response = await request.delete(
    `${BASE_URL}/feeds/subscriptions/${subscriptionId}`,
    { headers: { 'Authorization': `Bearer ${authToken}` } }
  );

  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toHaveProperty('success', true);

  // 确认真的没了
  const listResponse = await request.get(`${BASE_URL}/feeds/subscriptions`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });
  const groups = (await listResponse.json()).data.groups;
  const allSubscriptions = Object.values(groups).flatMap(
    (g: any) => g.subscriptions
  ) as any[];
  expect(allSubscriptions.find((s) => s.id === subscriptionId)).toBeUndefined();

  console.log('✅ TC-ACT-026 PASSED: Subscription deleted');
});

/**
 * TC-ACT-027: Delete Subscription - Invalid ID
 * Priority: P1
 */
test('TC-ACT-027: Delete Subscription - Invalid ID', async ({ request }) => {
  const response = await request.delete(
    `${BASE_URL}/feeds/subscriptions/non-existent-id`,
    { headers: { 'Authorization': `Bearer ${authToken}` } }
  );

  // 删除不存在的订阅：接口返回 404（不是 200 假成功）
  expect(response.status()).toBe(404);

  const body = await response.json();
  expect(body).toHaveProperty('success', false);

  console.log('✅ TC-ACT-027 PASSED: Deleting non-existent subscription returns 404');
});

/**
 * TC-ACT-028: Get Feeds - Missing Authorization
 * Priority: P0
 */
test('TC-ACT-028: Get Feeds - Missing Authorization', async ({ request }) => {
  const response = await request.get(`${BASE_URL}/feeds/subscriptions`);
  expect(response.status()).toBe(401);
  console.log('✅ TC-ACT-028 PASSED: Missing authorization rejected');
});

/**
 * TC-ACT-029: Subscribe to Feed - Missing Authorization
 * Priority: P0
 */
test('TC-ACT-029: Subscribe to Feed - Missing Authorization', async ({ request }) => {
  const response = await request.post(`${BASE_URL}/feeds/subscriptions`, {
    data: { url: 'https://sspai.com/feed' },
    headers: { 'Content-Type': 'application/json' }
  });

  expect(response.status()).toBe(401);
  console.log('✅ TC-ACT-029 PASSED: Missing authorization rejected');
});

/**
 * TC-ACT-030: Duplicate Subscription Handled Gracefully
 * Priority: P1
 */
test('TC-ACT-030: Duplicate Subscription Handled Gracefully', async ({ request }) => {
  const payload = { url: 'https://sspai.com/feed' };
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };

  // beforeAll 里已经订阅过 sspai，这次是重复订阅
  const response = await request.post(`${BASE_URL}/feeds/subscriptions`, {
    data: payload,
    headers
  });

  // 重复订阅返回 200 + 说明，而不是撞唯一约束报 500。
  // 用户在市场页手快点两下就会走到这条路径。
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toHaveProperty('success', true);
  expect(body.message).toContain('已经订阅过');

  console.log('✅ TC-ACT-030 PASSED: Duplicate subscription handled gracefully');
});

/**
 * TC-ACT-031: Validate Feed URL
 * Priority: P1
 */
test('TC-ACT-031: Validate Feed URL', async ({ request }) => {
  const response = await request.post(`${BASE_URL}/feeds/validate`, {
    data: { url: 'https://sspai.com/feed' },
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toHaveProperty('success', true);
  expect(body.data).toHaveProperty('valid', true);
  expect(body.data.feed).toHaveProperty('title');
  expect(body.data.feed).toHaveProperty('itemCount');
  expect(typeof body.data.feed.itemCount).toBe('number');

  console.log('✅ TC-ACT-031 PASSED: Feed validation contract validated');
});
