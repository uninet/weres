/**
 * API Contract Tests for Groups
 * Verifies that groups API endpoints conform to OpenAPI specification
 */

import { test, expect } from '@playwright/test';
import groupSchema from '../../schemas/group.schema.json';
import feedSchema from '../../schemas/feed.schema.json';
import { validate } from 'jsonschema';

const BASE_URL = 'http://localhost:3000/api';

let authToken: string;
let testGroupId: string;

test.beforeAll(async ({ request }) => {
  // Setup: Register and login
  const registerData = {
    email: `group-test-${Date.now()}@werss.com`,
    password: 'Test@123456',
    nickname: 'GroupContractTest'
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
  expect(body).toHaveProperty('error');

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
  const response = await request.delete(`${BASE_URL}/groups/${groupId}`, {
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
  const response = await request.delete(`${BASE_URL}/groups/non-existent-id`, {
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
test('TC-ACT-041: Get Groups - Empty List', async ({ request }) => {
  // This test assumes a fresh account with no groups
  // If there are groups, we'll just validate the structure

  // Act
  const response = await request.get(`${BASE_URL}/groups`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert
  expect(response.status()).toBe(200);

  const body = await response.json();
  const groups = body.data;

  // Should return array (possibly empty)
  expect(Array.isArray(groups)).toBe(true);

  console.log(`✅ TC-ACT-041 PASSED: Groups list structure validated (${groups.length} groups)`);
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
