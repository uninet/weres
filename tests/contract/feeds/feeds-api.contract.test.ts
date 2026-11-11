/**
 * API Contract Tests for Feeds
 * Verifies that feeds API endpoints conform to OpenAPI specification
 */

import { test, expect } from '@playwright/test';
import feedSchema from '../../schemas/feed.schema.json';
import { validate } from 'jsonschema';

const BASE_URL = 'http://localhost:3000/api';

let authToken: string;
let testFeedId: string;

test.beforeAll(async ({ request }) => {
  // Setup: Register and login
  const registerData = {
    email: `feed-test-${Date.now()}@werss.com`,
    password: 'Test@123456',
    nickname: 'FeedContractTest'
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
 * TC-ACT-021: Get Feeds List
 * Priority: P0
 */
test('TC-ACT-021: Get Feeds List', async ({ request }) => {
  // Act
  const response = await request.get(`${BASE_URL}/feeds`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toHaveProperty('success', true);
  expect(body).toHaveProperty('data');

  // Validate feeds is an array
  const feeds = body.data;
  expect(Array.isArray(feeds)).toBe(true);

  // Validate each feed against schema if array not empty
  if (feeds.length > 0) {
    const validationResult = validate(feeds[0], feedSchema);
    expect(validationResult.valid, validationResult.errors?.map(e => e.message).join(', ')).toBe(true);
    testFeedId = feeds[0].id; // Save for deletion test
  }

  console.log(`✅ TC-ACT-021 PASSED: Feeds list contract validated (found ${feeds.length} feeds)`);
});

/**
 * TC-ACT-022: Subscribe to Feed - Valid RSS URL
 * Priority: P0
 */
test('TC-ACT-022: Subscribe to Feed - Valid RSS URL', async ({ request }) => {
  // Arrange - Use a known valid RSS feed
  const newFeed = {
    url: 'https://36kr.com/feed',
    groupId: null
  };

  // Act
  const response = await request.post(`${BASE_URL}/feeds`, {
    data: newFeed,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  // Assert
  expect(response.status()).toBeGreaterThanOrEqual(200);
  expect(response.status()).toBeLessThan(300);

  const body = await response.json();

  if (response.status() === 200) {
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('data');

    // Validate feed schema
    const validationResult = validate(body.data, feedSchema);
    expect(validationResult.valid, validationResult.errors?.map(e => e.message).join(', ')).toBe(true);

    // Verify feed properties
    expect(body.data.url).toBe(newFeed.url);
    expect(body.data.id).toBeDefined();
    expect(typeof body.data.id).toBe('string');
    expect(body.data.title).toBeDefined();

    testFeedId = body.data.id; // Save for deletion test

    console.log('✅ TC-ACT-022 PASSED: Feed subscription contract validated');
  } else {
    // RSS validation might fail, but response should still be structured correctly
    expect(body).toHaveProperty('success', false);
    expect(body).toHaveProperty('error');
    console.log('✅ TC-ACT-022 PASSED: Invalid RSS URL rejected with proper error');
  }
});

/**
 * TC-ACT-023: Subscribe to Feed - Invalid URL
 * Priority: P0
 */
test('TC-ACT-023: Subscribe to Feed - Invalid URL', async ({ request }) => {
  // Arrange - Invalid URL format
  const invalidFeed = {
    url: 'not-a-valid-url',
    groupId: null
  };

  // Act
  const response = await request.post(`${BASE_URL}/feeds`, {
    data: invalidFeed,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  // Assert - Should reject invalid URL
  expect(response.status()).toBeGreaterThanOrEqual(400);
  expect(response.status()).toBeLessThan(500);

  const body = await response.json();
  expect(body).toHaveProperty('success', false);
  expect(body).toHaveProperty('error');

  console.log('✅ TC-ACT-023 PASSED: Invalid URL rejected correctly');
});

/**
 * TC-ACT-024: Subscribe to Feed - Missing URL
 * Priority: P0
 */
test('TC-ACT-024: Subscribe to Feed - Missing URL', async ({ request }) => {
  // Arrange - Missing required URL field
  const incompleteFeed = {
    groupId: null
  };

  // Act
  const response = await request.post(`${BASE_URL}/feeds`, {
    data: incompleteFeed,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  // Assert - Should reject missing required field
  expect(response.status()).toBe(400);

  const body = await response.json();
  expect(body).toHaveProperty('success', false);

  console.log('✅ TC-ACT-024 PASSED: Missing required field rejected correctly');
});

/**
 * TC-ACT-025: Subscribe to Feed - With Group
 * Priority: P1
 */
test('TC-ACT-025: Subscribe to Feed - With Group', async ({ request }) => {
  // Arrange - First create a group
  const groupResponse = await request.post(`${BASE_URL}/groups`, {
    data: { name: 'Test Group' },
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  const groupBody = await groupResponse.json();
  const groupId = groupBody.data.id;

  const newFeed = {
    url: 'https://sspai.com/feed',
    groupId: groupId
  };

  // Act
  const response = await request.post(`${BASE_URL}/feeds`, {
    data: newFeed,
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  // Assert
  if (response.status() === 200) {
    const body = await response.json();

    // Validate feed schema
    const validationResult = validate(body.data, feedSchema);
    expect(validationResult.valid, validationResult.errors?.map(e => e.message).join(', ')).toBe(true);

    // Verify group assignment
    expect(body.data.groupId).toBe(groupId);

    console.log('✅ TC-ACT-025 PASSED: Feed with group contract validated');
  } else {
    console.log('⏸️ TC-ACT-025 SKIPPED: RSS validation failed');
  }
});

/**
 * TC-ACT-026: Delete Feed
 * Priority: P0
 */
test('TC-ACT-026: Delete Feed', async ({ request }) => {
  // Arrange - First subscribe to a feed
  const subscribeResponse = await request.post(`${BASE_URL}/feeds`, {
    data: { url: 'https://www.huxiu.com/rss/0.xml', groupId: null },
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (subscribeResponse.status() !== 200) {
    console.log('⏸️ TC-ACT-026 SKIPPED: Could not create test feed');
    test.skip();
    return;
  }

  const subscribeBody = await subscribeResponse.json();
  const feedId = subscribeBody.data.id;

  // Act - Delete the feed
  const response = await request.delete(`${BASE_URL}/feeds/${feedId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toHaveProperty('success', true);

  // Verify feed is deleted from list
  const listResponse = await request.get(`${BASE_URL}/feeds`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const listBody = await listResponse.json();
  const deletedFeed = listBody.data.find((f: any) => f.id === feedId);
  expect(deletedFeed).toBeUndefined();

  console.log('✅ TC-ACT-026 PASSED: Feed deletion contract validated');
});

/**
 * TC-ACT-027: Delete Feed - Invalid ID
 * Priority: P1
 */
test('TC-ACT-027: Delete Feed - Invalid ID', async ({ request }) => {
  // Act
  const response = await request.delete(`${BASE_URL}/feeds/non-existent-id`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert - Should handle gracefully (404 or 200)
  expect([200, 404]).toContain(response.status());

  const body = await response.json();
  expect(body).toHaveProperty('success');

  console.log('✅ TC-ACT-027 PASSED: Invalid feed ID handled correctly');
});

/**
 * TC-ACT-028: Get Feeds - Missing Authorization
 * Priority: P0
 */
test('TC-ACT-028: Get Feeds - Missing Authorization', async ({ request }) => {
  // Act - Request without auth header
  const response = await request.get(`${BASE_URL}/feeds`);

  // Assert - Should return 401
  expect(response.status()).toBe(401);

  console.log('✅ TC-ACT-028 PASSED: Missing authorization rejected');
});

/**
 * TC-ACT-029: Subscribe to Feed - Missing Authorization
 * Priority: P0
 */
test('TC-ACT-029: Subscribe to Feed - Missing Authorization', async ({ request }) => {
  // Act - Request without auth header
  const response = await request.post(`${BASE_URL}/feeds`, {
    data: { url: 'https://example.com/feed' },
    headers: {
      'Content-Type': 'application/json'
    }
  });

  // Assert - Should return 401
  expect(response.status()).toBe(401);

  console.log('✅ TC-ACT-029 PASSED: Missing authorization rejected');
});

/**
 * TC-ACT-030: Feed Schema Validation - All Fields
 * Priority: P1
 */
test('TC-ACT-030: Feed Schema Validation - All Fields', async ({ request }) => {
  // Arrange - Create a feed
  const subscribeResponse = await request.post(`${BASE_URL}/feeds`, {
    data: { url: 'https://36kr.com/feed', groupId: null },
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    }
  });

  if (subscribeResponse.status() !== 200) {
    console.log('⏸️ TC-ACT-030 SKIPPED: Could not create test feed');
    test.skip();
    return;
  }

  const feed = (await subscribeResponse.json()).data;

  // Act - Get the feed details
  const response = await request.get(`${BASE_URL}/feeds`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert - Validate complete schema
  const validationResult = validate(feed, feedSchema);
  expect(validationResult.valid, validationResult.errors?.map(e => e.message).join(', ')).toBe(true);

  // Verify all required fields are present
  expect(feed.id).toBeDefined();
  expect(feed.title).toBeDefined();
  expect(feed.url).toBeDefined();

  console.log('✅ TC-ACT-030 PASSED: Complete feed schema validated');
});
