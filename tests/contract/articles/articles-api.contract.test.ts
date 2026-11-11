/**
 * API Contract Tests for Articles
 * Verifies that articles API endpoints conform to OpenAPI specification
 */

import { test, expect } from '@playwright/test';
import articleSchema from '../../schemas/article.schema.json';
import feedSchema from '../../schemas/feed.schema.json';
import { validate } from 'jsonschema';

const BASE_URL = 'http://localhost:3000/api';

let authToken: string;

test.beforeAll(async ({ request }) => {
  // Setup: Register and login to get auth token
  const registerData = {
    email: `article-test-${Date.now()}@werss.com`,
    password: 'Test@123456',
    nickname: 'ArticleContractTest'
  };

  await request.post(`${BASE_URL}/auth/register`, {
    data: registerData,
    headers: { 'Content-Type': 'application/json' }
  });

  const loginResponse = await request.post(`${BASE_URL}/auth/login`, {
    data: {
      email: registerData.email,
      password: registerData.password
    },
    headers: { 'Content-Type': 'application/json' }
  });

  const loginBody = await loginResponse.json();
  authToken = loginBody.data.token;
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
  expect(data).toHaveProperty('articles');
  expect(data).toHaveProperty('total');
  expect(data).toHaveProperty('hasMore');

  // Validate articles array
  expect(Array.isArray(data.articles)).toBe(true);

  // Validate each article against schema if array not empty
  if (data.articles.length > 0) {
    const validationResult = validate(data.articles[0], articleSchema);
    expect(validationResult.valid, validationResult.errors?.map(e => e.message).join(', ')).toBe(true);
  }

  // Validate total is a number
  expect(typeof data.total).toBe('number');
  expect(data.total).toBeGreaterThanOrEqual(0);

  // Validate hasMore is boolean
  expect(typeof data.hasMore).toBe('boolean');

  console.log(`✅ TC-ACT-009 PASSED: Articles list contract validated (found ${data.articles.length} articles)`);
});

/**
 * TC-ACT-010: Get Articles List - Pagination
 * Priority: P0
 */
test('TC-ACT-010: Get Articles List - Pagination', async ({ request }) => {
  // Act - Request first page with limit
  const response = await request.get(`${BASE_URL}/articles?limit=5&offset=0`, {
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

  // Total should be the total count (not the page size)
  expect(data.total).toBeGreaterThanOrEqual(0);

  console.log('✅ TC-ACT-010 PASSED: Pagination parameters work correctly');
});

/**
 * TC-ACT-011: Get Articles List - Filter by Read Status
 * Priority: P0
 */
test('TC-ACT-011: Get Articles List - Filter by Read Status', async ({ request }) => {
  // Act - Request only unread articles
  const response = await request.get(`${BASE_URL}/articles?isRead=false`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert
  expect(response.status()).toBe(200);

  const body = await response.json();
  const data = body.data;

  // All articles should be unread
  if (data.articles.length > 0) {
    data.articles.forEach((article: any) => {
      expect(article.isRead).toBe(false);
    });
  }

  console.log('✅ TC-ACT-011 PASSED: Read status filter works correctly');
});

/**
 * TC-ACT-012: Get Articles List - Filter by Starred Status
 * Priority: P1
 */
test('TC-ACT-012: Get Articles List - Filter by Starred Status', async ({ request }) => {
  // Act - Request only starred articles
  const response = await request.get(`${BASE_URL}/articles?isStarred=true`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert
  expect(response.status()).toBe(200);

  const body = await response.json();
  const data = body.data;

  // All articles should be starred
  if (data.articles.length > 0) {
    data.articles.forEach((article: any) => {
      expect(article.isStarred).toBe(true);
    });
  }

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

  console.log(`✅ TC-ACT-013 PASSED: Search parameter accepted (found ${data.articles.length} results)`);
});

/**
 * TC-ACT-014: Get Articles List - Invalid Pagination Parameters
 * Priority: P1
 */
test('TC-ACT-014: Get Articles List - Invalid Pagination Parameters', async ({ request }) => {
  // Act - Request with invalid limit (too large)
  const response = await request.get(`${BASE_URL}/articles?limit=1000`, {
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
  const listResponse = await request.get(`${BASE_URL}/articles?limit=1`, {
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

  // Validate article schema with content
  const articleDetailSchema = {
    ...articleSchema,
    required: [...articleSchema.required, 'content'],
    properties: {
      ...articleSchema.properties,
      content: {
        type: 'string',
        description: 'Full article content (HTML)'
      }
    }
  };

  const validationResult = validate(body.data, articleDetailSchema);
  expect(validationResult.valid, validationResult.errors?.map(e => e.message).join(', ')).toBe(true);

  // Verify feed is included and validated
  if (body.data.feed) {
    const feedValidationResult = validate(body.data.feed, feedSchema);
    expect(feedValidationResult.valid).toBe(true);
  }

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
  expect(body).toHaveProperty('error');

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
  const listResponse = await request.get(`${BASE_URL}/articles?isRead=false&limit=1`, {
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
  expect(data.total).toBe(0);
  expect(data.hasMore).toBe(false);

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
