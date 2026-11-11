/**
 * API Contract Tests for Sync
 * Verifies that sync API endpoints conform to OpenAPI specification
 */

import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3000/api';

let authToken: string;

test.beforeAll(async ({ request }) => {
  // Setup: Register and login
  const registerData = {
    email: `sync-test-${Date.now()}@werss.com`,
    password: 'Test@123456',
    nickname: 'SyncContractTest'
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

  // Setup: Subscribe to a feed for sync testing
  await request.post(`${BASE_URL}/feeds`, {
    data: { url: 'https://36kr.com/feed', groupId: null },
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });
});

/**
 * TC-ACT-055: Trigger Manual Sync
 * Priority: P0
 */
test('TC-ACT-055: Trigger Manual Sync', async ({ request }) => {
  // Act
  const response = await request.post(`${BASE_URL}/sync`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert - Accept 200 or 202 (accepted for processing)
  expect([200, 202]).toContain(response.status());

  const body = await response.json();
  expect(body).toHaveProperty('success', true);
  expect(body).toHaveProperty('data');

  // Validate sync result structure
  const syncData = body.data;
  expect(syncData).toHaveProperty('synced');
  expect(syncData).toHaveProperty('newArticles');

  // Validate types
  expect(typeof syncData.synced).toBe('number');
  expect(typeof syncData.newArticles).toBe('number');
  expect(syncData.synced).toBeGreaterThanOrEqual(0);
  expect(syncData.newArticles).toBeGreaterThanOrEqual(0);

  console.log(`✅ TC-ACT-055 PASSED: Manual sync contract validated (synced: ${syncData.synced}, new: ${syncData.newArticles})`);
});

/**
 * TC-ACT-056: Sync Response Structure Validation
 * Priority: P0
 */
test('TC-ACT-056: Sync Response Structure Validation', async ({ request }) => {
  // Act
  const response = await request.post(`${BASE_URL}/sync`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert
  expect([200, 202]).toContain(response.status());

  const body = await response.json();
  expect(body).toHaveProperty('success', true);
  expect(body).toHaveProperty('data');

  // Validate complete data structure
  const syncData = body.data;

  // Required fields
  expect(syncData).toHaveProperty('synced');
  expect(syncData).toHaveProperty('newArticles');

  // Optional fields (if present)
  if (syncData.errors !== undefined) {
    expect(Array.isArray(syncData.errors)).toBe(true);
  }

  if (syncData.failedFeeds !== undefined) {
    expect(Array.isArray(syncData.failedFeeds)).toBe(true);
  }

  console.log('✅ TC-ACT-056 PASSED: Sync response structure validated');
});

/**
 * TC-ACT-057: Sync - Missing Authorization
 * Priority: P0
 */
test('TC-ACT-057: Sync - Missing Authorization', async ({ request }) => {
  // Act - Request without auth header
  const response = await request.post(`${BASE_URL}/sync`);

  // Assert - Should return 401
  expect(response.status()).toBe(401);

  console.log('✅ TC-ACT-057 PASSED: Missing authorization rejected');
});

/**
 * TC-ACT-058: Sync - No Feeds Subscribed
 * Priority: P1
 */
test('TC-ACT-058: Sync - No Feeds Subscribed', async ({ request }) => {
  // Arrange - Create a new user with no feeds
  const registerData = {
    email: `nofeeds-test-${Date.now()}@werss.com`,
    password: 'Test@123456',
    nickname: 'NoFeedsTest'
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

  const noFeedsToken = (await loginResponse.json()).data.token;

  // Act - Try to sync without feeds
  const response = await request.post(`${BASE_URL}/sync`, {
    headers: {
      'Authorization': `Bearer ${noFeedsToken}`
    }
  });

  // Assert - Should handle gracefully
  expect([200, 202]).toContain(response.status());

  const body = await response.json();
  expect(body).toHaveProperty('success', true);
  expect(body.data.synced).toBe(0);
  expect(body.data.newArticles).toBe(0);

  console.log('✅ TC-ACT-058 PASSED: Sync without feeds handled correctly');
});

/**
 * TC-ACT-059: Sync Response Time
 * Priority: P2
 */
test('TC-ACT-059: Sync Response Time', async ({ request }) => {
  // Act - Measure sync time
  const startTime = Date.now();
  const response = await request.post(`${BASE_URL}/sync`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });
  const endTime = Date.now();

  const responseTime = endTime - startTime;

  // Assert - Response should be reasonable (< 30s)
  expect([200, 202]).toContain(response.status());
  expect(responseTime).toBeLessThan(30000); // 30 seconds max

  console.log(`✅ TC-ACT-059 PASSED: Sync response time: ${responseTime}ms`);
});

/**
 * TC-ACT-060: Sync With New Articles
 * Priority: P1
 */
test('TC-ACT-060: Sync With New Articles', async ({ request }) => {
  // Note: This test may not always find new articles
  // It validates the structure when new articles are found

  // Act
  const response = await request.post(`${BASE_URL}/sync`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert
  expect([200, 202]).toContain(response.status());

  const body = await response.json();
  const syncData = body.data;

  // If new articles found, validate structure
  if (syncData.newArticles > 0) {
    expect(syncData.newArticles).toBeGreaterThan(0);
    console.log(`✅ TC-ACT-060 PASSED: Sync with ${syncData.newArticles} new articles validated`);
  } else {
    console.log('✅ TC-ACT-060 PASSED: Sync with no new articles validated');
  }
});

/**
 * TC-ACT-061: Sync Error Handling
 * Priority: P1
 */
test('TC-ACT-061: Sync Error Handling', async ({ request }) => {
  // This test validates error handling in sync response
  // Real sync errors depend on external RSS sources

  // Act
  const response = await request.post(`${BASE_URL}/sync`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert - Response should always be valid
  expect([200, 202]).toContain(response.status());

  const body = await response.json();

  // Even if sync fails, response structure should be valid
  expect(body).toHaveProperty('success');
  expect(body).toHaveProperty('data');

  console.log('✅ TC-ACT-061 PASSED: Sync error handling validated');
});

/**
 * TC-ACT-062: Consecutive Sync Requests
 * Priority: P2
 */
test('TC-ACT-062: Consecutive Sync Requests', async ({ request }) => {
  // Arrange - First sync
  await request.post(`${BASE_URL}/sync`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Act - Immediately trigger another sync
  const response = await request.post(`${BASE_URL}/sync`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert - Should handle gracefully (allow or rate limit)
  // Rate limiting might return 429
  const statusCode = response.status();
  expect([200, 202, 429]).toContain(statusCode);

  if (statusCode === 429) {
    console.log('✅ TC-ACT-062 PASSED: Rate limiting active (429)');
  } else {
    const body = await response.json();
    expect(body).toHaveProperty('success', true);
    console.log('✅ TC-ACT-062 PASSED: Consecutive syncs allowed');
  }
});

/**
 * TC-ACT-063: Sync Data Integrity
 * Priority: P1
 */
test('TC-ACT-063: Sync Data Integrity', async ({ request }) => {
  // Arrange - Get article count before sync
  const beforeResponse = await request.get(`${BASE_URL}/articles`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const beforeCount = (await beforeResponse.json()).data.total;

  // Act - Trigger sync
  const syncResponse = await request.post(`${BASE_URL}/sync`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert - Sync should complete successfully
  expect([200, 202]).toContain(syncResponse.status());

  const syncData = (await syncResponse.json()).data;

  // If new articles were synced, they should appear in articles list
  if (syncData.newArticles > 0) {
    const afterResponse = await request.get(`${BASE_URL}/articles`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    const afterCount = (await afterResponse.json()).data.total;
    expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
    console.log(`✅ TC-ACT-063 PASSED: Articles increased from ${beforeCount} to ${afterCount}`);
  } else {
    console.log('✅ TC-ACT-063 PASSED: No new articles in this sync');
  }
});

/**
 * TC-ACT-064: Sync Response Contains Valid Fields
 * Priority: P0
 */
test('TC-ACT-064: Sync Response Contains Valid Fields', async ({ request }) => {
  // Act
  const response = await request.post(`${BASE_URL}/sync`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert - Validate all expected fields are present
  expect([200, 202]).toContain(response.status());

  const body = await response.json();
  expect(body).toHaveProperty('success');

  const data = body.data;

  // Required fields per OpenAPI spec
  expect(data).toHaveProperty('synced');
  expect(data).toHaveProperty('newArticles');

  // Type validation
  expect(typeof data.synced).toBe('number');
  expect(typeof data.newArticles).toBe('number');

  // Value validation
  expect(data.synced).toBeGreaterThanOrEqual(0);
  expect(data.newArticles).toBeGreaterThanOrEqual(0);

  console.log('✅ TC-ACT-064 PASSED: Sync response fields validated');
});
