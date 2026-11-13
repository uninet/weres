/**
 * API Contract Tests for Authentication
 * Verifies that auth API endpoints conform to OpenAPI specification
 */

import { test, expect } from '@playwright/test';
import userSchema from '../../schemas/user.schema.json';
import { validate } from 'jsonschema';

// 端口写死过一段时间，导致这套契约测试只能在 3000 端口跑：
// 换 BASE_URL 起一个全新克隆（验证「别人 clone 就能跑」）时，
// 测试还在打 3000 —— 那里要么没人监听，要么是另一个实例，
// 报出来的失败和代码无关。与 verify 脚本统一读同一个环境变量。
const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '') + '/api';

// Test data
const TEST_USER = {
  email: `test-${Date.now()}@werss.com`,
  password: 'Test@123456',
  nickname: 'ContractTestUser'
};

/**
 * TC-ACT-001: User Registration - Valid Request
 * Priority: P0
 */
test('TC-ACT-001: User Registration - Valid Request', async ({ request }) => {
  // Arrange
  const expectedUser = {
    email: TEST_USER.email,
    password: TEST_USER.password,
    nickname: TEST_USER.nickname
  };

  // Act
  const response = await request.post(`${BASE_URL}/auth/register`, {
    data: expectedUser,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Assert
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toHaveProperty('success', true);
  expect(body).toHaveProperty('data');

  // Validate data contains user
  const data = body.data;
  expect(data).toHaveProperty('user');

  // Validate user schema
  const user = data.user;
  const validationResult = validate(user, userSchema);
  expect(validationResult.valid, validationResult.errors?.map(e => e.message).join(', ')).toBe(true);

  // Validate required fields
  expect(user.email).toBe(expectedUser.email);
  expect(user.nickname).toBe(expectedUser.nickname);
  expect(user.id).toBeDefined();
  expect(typeof user.id).toBe('string');

  // Validate token is set in cookie (HttpOnly)
  const cookies = response.headers()['set-cookie'];
  expect(cookies).toBeDefined();
  expect(cookies).toContain('token=');

  console.log('✅ TC-ACT-001 PASSED: User registration contract validated');
});

/**
 * TC-ACT-002: User Registration - Invalid Email Format
 * Priority: P0
 */
test('TC-ACT-002: User Registration - Invalid Email Format', async ({ request }) => {
  // Arrange
  const invalidUser = {
    email: 'invalid-email',
    password: TEST_USER.password,
    nickname: TEST_USER.nickname
  };

  // Act
  const response = await request.post(`${BASE_URL}/auth/register`, {
    data: invalidUser,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Assert - Should reject invalid email format
  expect(response.status()).toBeGreaterThanOrEqual(400);
  expect(response.status()).toBeLessThan(500);

  const body = await response.json();
  expect(body).toHaveProperty('success', false);
  expect(body).toHaveProperty('message');

  console.log('✅ TC-ACT-002 PASSED: Invalid email format rejected correctly');
});

/**
 * TC-ACT-003: User Registration - Weak Password
 * Priority: P1
 */
test('TC-ACT-003: User Registration - Weak Password', async ({ request }) => {
  // Arrange
  const weakPasswordUser = {
    email: `weakpwd-${Date.now()}@werss.com`,
    password: '123',
    nickname: TEST_USER.nickname
  };

  // Act
  const response = await request.post(`${BASE_URL}/auth/register`, {
    data: weakPasswordUser,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Assert - Should reject weak password
  expect(response.status()).toBeGreaterThanOrEqual(400);
  expect(response.status()).toBeLessThan(500);

  const body = await response.json();
  expect(body).toHaveProperty('success', false);

  console.log('✅ TC-ACT-003 PASSED: Weak password rejected correctly');
});

/**
 * TC-ACT-004: User Registration - Missing Required Fields
 * Priority: P0
 */
test('TC-ACT-004: User Registration - Missing Required Fields', async ({ request }) => {
  // Arrange - Missing nickname (which is optional in our implementation)
  const incompleteUser = {
    email: `incomplete-${Date.now()}@werss.com`,
    password: TEST_USER.password
  };

  // Act
  const response = await request.post(`${BASE_URL}/auth/register`, {
    data: incompleteUser,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Assert - Our implementation accepts missing nickname (defaults to email prefix)
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toHaveProperty('success', true);

  console.log('✅ TC-ACT-004 PASSED: Missing optional fields handled correctly');
});

/**
 * TC-ACT-005: User Login - Valid Credentials
 * Priority: P0
 */
test('TC-ACT-005: User Login - Valid Credentials', async ({ request }) => {
  // Arrange - First register user
  const uniqueEmail = `login-test-${Date.now()}@werss.com`;
  await request.post(`${BASE_URL}/auth/register`, {
    data: {
      email: uniqueEmail,
      password: TEST_USER.password,
      nickname: TEST_USER.nickname
    },
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Act - Login with valid credentials
  const response = await request.post(`${BASE_URL}/auth/login`, {
    data: {
      email: uniqueEmail,
      password: TEST_USER.password
    },
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Assert
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toHaveProperty('success', true);
  expect(body).toHaveProperty('data');

  const data = body.data;
  expect(data).toHaveProperty('user');

  // Validate user schema
  const user = data.user;
  const validationResult = validate(user, userSchema);
  expect(validationResult.valid, validationResult.errors?.map(e => e.message).join(', ')).toBe(true);

  // Validate token is set in cookie (HttpOnly)
  const cookies = response.headers()['set-cookie'];
  expect(cookies).toBeDefined();
  expect(cookies).toContain('token=');

  console.log('✅ TC-ACT-005 PASSED: Valid login contract validated');
});

/**
 * TC-ACT-006: User Login - Invalid Credentials
 * Priority: P0
 */
test('TC-ACT-006: User Login - Invalid Credentials', async ({ request }) => {
  // Arrange
  // 用每次运行都不同的邮箱，而不是写死的 'nonexistent@werss.com'。
  //
  // 登录限流有一层是「按 IP + 邮箱」5 次/15 分钟 —— 写死邮箱意味着
  // 同一个计数器被每一次测试运行共享：第 5 轮之后这个地址就返回 429 了，
  // 用例断言的是 401，于是从第 6 轮开始无条件变红，而产品完全正常。
  // 语义不变（依然是一个不存在的账号），只是把计数器隔离开。
  const loginData = {
    email: `nonexistent-${Date.now()}@werss.com`,
    password: 'WrongPassword123'
  };

  // Act
  const response = await request.post(`${BASE_URL}/auth/login`, {
    data: loginData,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Assert - Should reject invalid credentials
  expect(response.status()).toBe(401);

  const body = await response.json();
  expect(body).toHaveProperty('success', false);
  expect(body).toHaveProperty('message');

  console.log('✅ TC-ACT-006 PASSED: Invalid credentials rejected correctly');
});

/**
 * TC-ACT-007: User Login - Missing Fields
 * Priority: P0
 */
test('TC-ACT-007: User Login - Missing Fields', async ({ request }) => {
  // Arrange - Missing password
  const incompleteLogin = {
    email: TEST_USER.email
  };

  // Act
  const response = await request.post(`${BASE_URL}/auth/login`, {
    data: incompleteLogin,
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Assert - Should reject missing field
  expect(response.status()).toBe(400);

  const body = await response.json();
  expect(body).toHaveProperty('success', false);

  console.log('✅ TC-ACT-007 PASSED: Missing login fields rejected correctly');
});

/**
 * TC-ACT-008: Response Content-Type Validation
 * Priority: P1
 */
test('TC-ACT-008: Response Content-Type Validation', async ({ request }) => {
  // Arrange
  const uniqueEmail = `content-type-test-${Date.now()}@werss.com`;
  await request.post(`${BASE_URL}/auth/register`, {
    data: {
      email: uniqueEmail,
      password: TEST_USER.password,
      nickname: TEST_USER.nickname
    },
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Act
  const response = await request.post(`${BASE_URL}/auth/login`, {
    data: {
      email: uniqueEmail,
      password: TEST_USER.password
    },
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Assert - Should return JSON content type
  const contentType = response.headers()['content-type'];
  expect(contentType).toMatch(/application\/json/);

  console.log('✅ TC-ACT-008 PASSED: Content-Type header correct');
});
