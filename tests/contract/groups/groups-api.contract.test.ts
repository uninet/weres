/**
 * API Contract Tests for Groups
 * Verifies that groups API endpoints conform to OpenAPI specification
 */

import { test, expect } from '@playwright/test';
import groupSchema from '../../schemas/group.schema.json';
import feedSchema from '../../schemas/feed.schema.json';
import { validate } from 'jsonschema';
import { extractTokenFromResponse } from '../shared/auth';
import { registerAndLogin } from '../shared/user';

const BASE_URL = 'http://localhost:3000/api';

let authToken: string;
let testGroupId: string;

test.beforeAll(async ({ request }) => {
  // Setup: Register and login
  // 注册与登录统一走 tests/contract/shared/user.ts。
  // 每个文件自己写一遍且不检查注册状态码时，连跑第二轮会撞上
  // 注册全局限流（60 次/分钟）→ login 401 → 报错却是
  // 「Set-Cookie 里没有 token」，看起来像鉴权坏了。
  // helper 遇到 429 会按 retryAfter 等一下再重试。
  const user = await registerAndLogin(request, {
    prefix: 'group',
    nickname: 'GroupTest',
  });
  authToken = user.token;
});

/**
 * TC-ACT-031: Get Groups List
 * Priority: P0
 */
test('TC-ACT-031: Get Groups List', async ({ request }) => {
  // Act
  const response = await request.get(`${BASE_URL}/groups`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toHaveProperty('success', true);
  expect(body).toHaveProperty('data');

  // Validate groups is an array
  const groups = body.data;
  expect(Array.isArray(groups)).toBe(true);

  // Validate each group against schema if array not empty
  if (groups.length > 0) {
    const validationResult = validate(groups[0], groupSchema);
    expect(validationResult.valid, validationResult.errors?.map(e => e.message).join(', ')).toBe(true);
    testGroupId = groups[0].id; // Save for deletion test
  }

  console.log(`✅ TC-ACT-031 PASSED: Groups list contract validated (found ${groups.length} groups)`);
});

/**
 * TC-ACT-032: Create Group - Valid Input
 * Priority: P0
 */
test('TC-ACT-032: Create Group - Valid Input', async ({ request }) => {
  // Arrange
  const newGroup = {
    name: `Test Group ${Date.now()}`,
    description: 'This is a test group'
  };

  // Act
  const response = await request.post(`${BASE_URL}/groups`, {
    data: newGroup,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  // Assert
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toHaveProperty('success', true);
  expect(body).toHaveProperty('data');

  // Validate group schema
  const group = body.data;
  const validationResult = validate(group, groupSchema);
  expect(validationResult.valid, validationResult.errors?.map(e => e.message).join(', ')).toBe(true);

  // Verify group properties
  expect(group.name).toBe(newGroup.name);
  expect(group.id).toBeDefined();
  expect(typeof group.id).toBe('string');
  expect(group.createdAt).toBeDefined();

  testGroupId = group.id; // Save for other tests

  console.log('✅ TC-ACT-032 PASSED: Group creation contract validated');
});

/**
 * TC-ACT-033: Create Group - Missing Name
 * Priority: P0
 */
test('TC-ACT-033: Create Group - Missing Name', async ({ request }) => {
  // Arrange - Missing required name field
  const incompleteGroup = {
    description: 'This group has no name'
  };

  // Act
  const response = await request.post(`${BASE_URL}/groups`, {
    data: incompleteGroup,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  // Assert - Should reject missing required field
  expect(response.status()).toBe(400);

  const body = await response.json();
  expect(body).toHaveProperty('success', false);
  // 错误信息在 message 里，不是 error（app/api/groups/route.ts:158 起）。
  expect(body).toHaveProperty('message');
  expect(typeof body.message).toBe('string');

  console.log('✅ TC-ACT-033 PASSED: Missing required field rejected correctly');
});

/**
 * TC-ACT-034: Create Group - Name Too Long
 * Priority: P1
 */
test('TC-ACT-034: Create Group - Name Too Long', async ({ request }) => {
  // Arrange - Name exceeds max length (100)
  const invalidGroup = {
    name: 'A'.repeat(101) // 101 characters, exceeds limit
  };

  // Act
  const response = await request.post(`${BASE_URL}/groups`, {
    data: invalidGroup,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  // Assert - Should reject or truncate
  expect([400, 200]).toContain(response.status());

  if (response.status() === 200) {
    const body = await response.json();
    // Name should be truncated to max length
    expect(body.data.name.length).toBeLessThanOrEqual(100);
  }

  console.log('✅ TC-ACT-034 PASSED: Long name handled correctly');
});

/**
 * TC-ACT-035: Create Group - Empty Name
 * Priority: P1
 */
test('TC-ACT-035: Create Group - Empty Name', async ({ request }) => {
  // Arrange - Empty name string
  const invalidGroup = {
    name: '',
    description: 'Group with empty name'
  };

  // Act
  const response = await request.post(`${BASE_URL}/groups`, {
    data: invalidGroup,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  // Assert - Should reject empty name
  expect(response.status()).toBeGreaterThanOrEqual(400);

  const body = await response.json();
  expect(body).toHaveProperty('success', false);

  console.log('✅ TC-ACT-035 PASSED: Empty name rejected correctly');
});

/**
 * TC-ACT-036: Delete Group
 * Priority: P0
 */
test('TC-ACT-036: Delete Group', async ({ request }) => {
  // Arrange - First create a group
  const createResponse = await request.post(`${BASE_URL}/groups`, {
    data: { name: `Delete Test ${Date.now()}` },
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  const createBody = await createResponse.json();
  const groupId = createBody.data.id;

  // Act - Delete the group
  //
  // 删除接口是 `DELETE /api/groups?id=xxx`（app/api/groups/route.ts:288），
  // 不是 REST 风格的 `/api/groups/:id`。后者在 Next 里根本没有对应路由，
  // 会落到 app/not-found.tsx 返回一整页 HTML + 404 —— 于是 `response.json()`
  // 抛 `Unexpected token '<'`，看起来像接口坏了，其实是路径写错。
  const response = await request.delete(`${BASE_URL}/groups?id=${groupId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toHaveProperty('success', true);

  // Verify group is deleted from list
  const listResponse = await request.get(`${BASE_URL}/groups`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const listBody = await listResponse.json();
  const deletedGroup = listBody.data.find((g: any) => g.id === groupId);
  expect(deletedGroup).toBeUndefined();

  console.log('✅ TC-ACT-036 PASSED: Group deletion contract validated');
});

/**
 * TC-ACT-037: Delete Group - Invalid ID
 * Priority: P1
 */
test('TC-ACT-037: Delete Group - Invalid ID', async ({ request }) => {
  // Act
  const response = await request.delete(`${BASE_URL}/groups?id=non-existent-id`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert - Should handle gracefully (404 or 200)
  expect([200, 404]).toContain(response.status());

  const body = await response.json();
  expect(body).toHaveProperty('success');

  console.log('✅ TC-ACT-037 PASSED: Invalid group ID handled correctly');
});

/**
 * TC-ACT-038: Get Groups - Missing Authorization
 * Priority: P0
 */
test('TC-ACT-038: Get Groups - Missing Authorization', async ({ request }) => {
  // Act - Request without auth header
  const response = await request.get(`${BASE_URL}/groups`);

  // Assert - Should return 401
  expect(response.status()).toBe(401);

  console.log('✅ TC-ACT-038 PASSED: Missing authorization rejected');
});

/**
 * TC-ACT-039: Create Group - Missing Authorization
 * Priority: P0
 */
test('TC-ACT-039: Create Group - Missing Authorization', async ({ request }) => {
  // Act - Request without auth header
  const response = await request.post(`${BASE_URL}/groups`, {
    data: { name: 'Test Group' },
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Assert - Should return 401
  expect(response.status()).toBe(401);

  console.log('✅ TC-ACT-039 PASSED: Missing authorization rejected');
});

/**
 * TC-ACT-040: Group Schema Validation - With Feeds
 * Priority: P1
 */
test('TC-ACT-040: Group Schema Validation - With Feeds', async ({ request }) => {
  // Arrange - Create a group and a feed in that group
  const groupResponse = await request.post(`${BASE_URL}/groups`, {
    data: { name: `Test Group ${Date.now()}` },
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  const groupBody = await groupResponse.json();
  const groupId = groupBody.data.id;

  // Try to create a feed in the group
  const feedResponse = await request.post(`${BASE_URL}/feeds`, {
    data: { url: 'https://36kr.com/feed', groupId: groupId },
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (feedResponse.status() === 200) {
    // Act - Get groups with feeds
    const response = await request.get(`${BASE_URL}/groups`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    // Assert - Validate group with feeds
    const groups = (await response.json()).data;
    const group = groups.find((g: any) => g.id === groupId);

    if (group && group.feeds && group.feeds.length > 0) {
      // Validate feed schema within group
      const feedValidationResult = validate(group.feeds[0], feedSchema);
      expect(feedValidationResult.valid).toBe(true);
    }

    console.log('✅ TC-ACT-040 PASSED: Group with feeds schema validated');
  } else {
    console.log('⏸️ TC-ACT-040 SKIPPED: Could not create feed in group');
  }
});

/**
 * TC-ACT-041: Get Groups - Empty List
 * Priority: P2
 */
test('TC-ACT-041: Get Groups - Fresh Account Starts Empty', async ({ request }) => {
  // 这条原名「Empty List」，并注释「This test assumes a fresh account with
  // no groups」—— 但 it 跑在同一个 beforeAll 账号上，前面的用例已经建了
  // 好几个分组，所以它永远拿不到空列表，只能退化成 `Array.isArray(groups)`。
  // 而 Array.isArray 在「接口返回 500 包装成 []」时也是真的。
  //
  // 改成一个独立的新账号：只有这样"新用户注册后分组列表为空"才是可断言的，
  // 也才守得住「注册不该自动塞垃圾分组」这条。
  const fresh = await registerAndLogin(request, {
    prefix: 'group-empty',
    nickname: 'EmptyGroupUser',
  });

  const response = await request.get(`${BASE_URL}/groups`, {
    headers: { Authorization: `Bearer ${fresh.token}` },
  });
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.success, '响应必须带 success 标记').toBe(true);
  expect(Array.isArray(body.data)).toBe(true);
  expect(body.data.length, '新账号不应自带任何分组').toBe(0);

  // 再核对一次：这个账号确实能建分组（空是因为新，不是因为接口坏了）
  const created = await request.post(`${BASE_URL}/groups`, {
    data: { name: `First Group ${Date.now()}` },
    headers: {
      Authorization: `Bearer ${fresh.token}`,
      'Content-Type': 'application/json',
    },
  });
  expect(created.status(), '新账号应当能建第一个分组').toBe(200);

  console.log('✅ TC-ACT-041 PASSED: 新账号分组列表为空，且可正常创建');
});

/**
 * TC-ACT-042: Create Group - Special Characters in Name
 * Priority: P2
 */
test('TC-ACT-042: Create Group - Special Characters in Name', async ({ request }) => {
  // Arrange - Group name with special characters
  const specialGroup = {
    name: 'Test Group @#$%&*()!',
    description: 'Group with special chars'
  };

  // Act
  const response = await request.post(`${BASE_URL}/groups`, {
    data: specialGroup,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  // Assert - Should accept or sanitize special characters
  const body = await response.json();
  expect([200, 400]).toContain(response.status());

  if (response.status() === 200) {
    expect(body.data.name).toBeDefined();
    console.log('✅ TC-ACT-042 PASSED: Special characters accepted');
  } else {
    expect(body).toHaveProperty('success', false);
    console.log('✅ TC-ACT-042 PASSED: Special characters sanitized/rejected');
  }
});
