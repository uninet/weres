/**
 * API Contract Tests for Favorites
 * Verifies that favorites API endpoints conform to OpenAPI specification
 */

import { test, expect } from '@playwright/test';
import articleSchema from '../../schemas/article.schema.json';
import { validate } from 'jsonschema';

const BASE_URL = 'http://localhost:3000/api';

let authToken: string;
let testArticleId: string;

test.beforeAll(async ({ request }) => {
  // Setup: Register and login
  const registerData = {
    email: `fav-test-${Date.now()}@werss.com`,
    password: 'Test@123456',
    nickname: 'FavoritesContractTest'
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

  // Setup: Get an article ID for favorites testing
  const articlesResponse = await request.get(`${BASE_URL}/articles?limit=1`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const articlesBody = await articlesResponse.json();

  if (articlesBody.data.articles.length > 0) {
    testArticleId = articlesBody.data.articles[0].id;
  }
});

/**
 * TC-ACT-043: Get Favorites List
 * Priority: P0
 */
test('TC-ACT-043: Get Favorites List', async ({ request }) => {
  // Act
  const response = await request.get(`${BASE_URL}/favorites`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toHaveProperty('success', true);
  expect(body).toHaveProperty('data');

  // Validate favorites is an array
  const favorites = body.data;
  expect(Array.isArray(favorites)).toBe(true);

  // Validate each favorite article against schema if array not empty
  if (favorites.length > 0) {
    const validationResult = validate(favorites[0], articleSchema);
    expect(validationResult.valid, validationResult.errors?.map(e => e.message).join(', ')).toBe(true);

    // All favorites should be starred
    favorites.forEach((article: any) => {
      expect(article.isStarred).toBe(true);
    });
  }

  console.log(`✅ TC-ACT-043 PASSED: Favorites list contract validated (found ${favorites.length} favorites)`);
});

/**
 * TC-ACT-044: Add Article to Favorites
 * Priority: P0
 */
test('TC-ACT-044: Add Article to Favorites', async ({ request }) => {
  // Skip if no article available
  if (!testArticleId) {
    console.log('⏸️ TC-ACT-044 SKIPPED: No article available');
    test.skip();
    return;
  }

  // Act - Add to favorites
  const response = await request.post(`${BASE_URL}/favorites/${testArticleId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toHaveProperty('success', true);

  // Verify article is in favorites list
  const favoritesResponse = await request.get(`${BASE_URL}/favorites`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const favoritesBody = await favoritesResponse.json();
  const favoritedArticle = favoritesBody.data.find((a: any) => a.id === testArticleId);
  expect(favoritedArticle).toBeDefined();
  expect(favoritedArticle.isStarred).toBe(true);

  console.log('✅ TC-ACT-044 PASSED: Add to favorites contract validated');
});

/**
 * TC-ACT-045: Add Same Article to Favorites Twice
 * Priority: P1
 */
test('TC-ACT-045: Add Same Article to Favorites Twice', async ({ request }) => {
  // Skip if no article available
  if (!testArticleId) {
    console.log('⏸️ TC-ACT-045 SKIPPED: No article available');
    test.skip();
    return;
  }

  // Arrange - First add to favorites
  await request.post(`${BASE_URL}/favorites/${testArticleId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Act - Try to add again
  const response = await request.post(`${BASE_URL}/favorites/${testArticleId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert - Should handle gracefully (200 or 409)
  expect([200, 409]).toContain(response.status());

  if (response.status() === 409) {
    const body = await response.json();
    expect(body).toHaveProperty('success', false);
  }

  console.log('✅ TC-ACT-045 PASSED: Duplicate favorite handled correctly');
});

/**
 * TC-ACT-046: Remove Article from Favorites
 * Priority: P0
 */
test('TC-ACT-046: Remove Article from Favorites', async ({ request }) => {
  // Skip if no article available
  if (!testArticleId) {
    console.log('⏸️ TC-ACT-046 SKIPPED: No article available');
    test.skip();
    return;
  }

  // Arrange - First add to favorites
  await request.post(`${BASE_URL}/favorites/${testArticleId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Act - Remove from favorites
  const response = await request.delete(`${BASE_URL}/favorites/${testArticleId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body).toHaveProperty('success', true);

  // Verify article is removed from favorites
  const favoritesResponse = await request.get(`${BASE_URL}/favorites`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const favoritesBody = await favoritesResponse.json();
  const favoritedArticle = favoritesBody.data.find((a: any) => a.id === testArticleId);
  expect(favoritedArticle).toBeUndefined();

  console.log('✅ TC-ACT-046 PASSED: Remove from favorites contract validated');
});

/**
 * TC-ACT-047: Remove Non-Favorited Article
 * Priority: P1
 */
test('TC-ACT-047: Remove Non-Favorited Article', async ({ request }) => {
  // Act - Try to remove article that's not favorited
  const response = await request.delete(`${BASE_URL}/favorites/non-existent-id`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert - Should handle gracefully (200 or 404)
  expect([200, 404]).toContain(response.status());

  const body = await response.json();
  expect(body).toHaveProperty('success');

  console.log('✅ TC-ACT-047 PASSED: Remove non-existent favorite handled correctly');
});

/**
 * TC-ACT-048: Get Favorites - Missing Authorization
 * Priority: P0
 */
test('TC-ACT-048: Get Favorites - Missing Authorization', async ({ request }) => {
  // Act - Request without auth header
  const response = await request.get(`${BASE_URL}/favorites`);

  // Assert - Should return 401
  expect(response.status()).toBe(401);

  console.log('✅ TC-ACT-048 PASSED: Missing authorization rejected');
});

/**
 * TC-ACT-049: Add to Favorites - Missing Authorization
 * Priority: P0
 */
test('TC-ACT-049: Add to Favorites - Missing Authorization', async ({ request }) => {
  // Skip if no article available
  if (!testArticleId) {
    console.log('⏸️ TC-ACT-049 SKIPPED: No article available');
    test.skip();
    return;
  }

  // Act - Request without auth header
  const response = await request.post(`${BASE_URL}/favorites/${testArticleId}`);

  // Assert - Should return 401
  expect(response.status()).toBe(401);

  console.log('✅ TC-ACT-049 PASSED: Missing authorization rejected');
});

/**
 * TC-ACT-050: Remove from Favorites - Missing Authorization
 * Priority: P0
 */
test('TC-ACT-050: Remove from Favorites - Missing Authorization', async ({ request }) => {
  // Skip if no article available
  if (!testArticleId) {
    console.log('⏸️ TC-ACT-050 SKIPPED: No article available');
    test.skip();
    return;
  }

  // Act - Request without auth header
  const response = await request.delete(`${BASE_URL}/favorites/${testArticleId}`);

  // Assert - Should return 401
  expect(response.status()).toBe(401);

  console.log('✅ TC-ACT-050 PASSED: Missing authorization rejected');
});

/**
 * TC-ACT-051: Favorites Schema Validation
 * Priority: P1
 */
test('TC-ACT-051: Favorites Schema Validation', async ({ request }) => {
  // Arrange - Add an article to favorites
  if (!testArticleId) {
    console.log('⏸️ TC-ACT-051 SKIPPED: No article available');
    test.skip();
    return;
  }

  await request.post(`${BASE_URL}/favorites/${testArticleId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Act - Get favorites list
  const response = await request.get(`${BASE_URL}/favorites`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert - Validate schema
  const favorites = (await response.json()).data;

  if (favorites.length > 0) {
    const validationResult = validate(favorites[0], articleSchema);
    expect(validationResult.valid, validationResult.errors?.map(e => e.message).join(', ')).toBe(true);

    // Verify required fields
    expect(favorites[0].id).toBeDefined();
    expect(favorites[0].title).toBeDefined();
    expect(favorites[0].isStarred).toBe(true);
  }

  console.log('✅ TC-ACT-051 PASSED: Favorites schema validated');
});

/**
 * TC-ACT-052: Get Favorites - Empty List
 * Priority: P2
 */
test('TC-ACT-052: Get Favorites - Empty List', async ({ request }) => {
  // Arrange - Clear all favorites by removing each
  const favoritesResponse = await request.get(`${BASE_URL}/favorites`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const favorites = (await favoritesResponse.json()).data;
  for (const article of favorites) {
    await request.delete(`${BASE_URL}/favorites/${article.id}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });
  }

  // Act - Get favorites after clearing
  const response = await request.get(`${BASE_URL}/favorites`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert - Should return empty array with valid structure
  expect(response.status()).toBe(200);

  const body = await response.json();
  expect(body.data).toEqual([]);
  expect(body).toHaveProperty('success', true);

  console.log('✅ TC-ACT-052 PASSED: Empty favorites list returns valid structure');
});

/**
 * TC-ACT-053: Favorites and Articles List Consistency
 * Priority: P1
 */
test('TC-ACT-053: Favorites and Articles List Consistency', async ({ request }) => {
  // Skip if no article available
  if (!testArticleId) {
    console.log('⏸️ TC-ACT-053 SKIPPED: No article available');
    test.skip();
    return;
  }

  // Arrange - Add to favorites
  await request.post(`${BASE_URL}/favorites/${testArticleId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Act - Get both lists
  const articlesResponse = await request.get(`${BASE_URL}/articles?isStarred=true`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const favoritesResponse = await request.get(`${BASE_URL}/favorites`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Assert - Articles with isStarred=true should match favorites
  const starredArticles = (await articlesResponse.json()).data.articles;
  const favorites = (await favoritesResponse.json()).data;

  // Count should be the same
  expect(starredArticles.length).toBe(favorites.length);

  console.log('✅ TC-ACT-053 PASSED: Favorites and starred articles consistent');
});

/**
 * TC-ACT-054: Toggle Favorite Status
 * Priority: P1
 */
test('TC-ACT-054: Toggle Favorite Status', async ({ request }) => {
  // Skip if no article available
  if (!testArticleId) {
    console.log('⏸️ TC-ACT-054 SKIPPED: No article available');
    test.skip();
    return;
  }

  // Arrange - Verify initial state
  let response = await request.get(`${BASE_URL}/articles/${testArticleId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const initialArticle = (await response.json()).data;
  const initialState = initialArticle.isStarred;

  // Act - Add to favorites
  await request.post(`${BASE_URL}/favorites/${testArticleId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Verify starred state changed
  response = await request.get(`${BASE_URL}/articles/${testArticleId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const toggledArticle = (await response.json()).data;
  expect(toggledArticle.isStarred).toBe(!initialState);

  // Act - Remove from favorites
  await request.delete(`${BASE_URL}/favorites/${testArticleId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  // Verify starred state changed back
  response = await request.get(`${BASE_URL}/articles/${testArticleId}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`
    }
  });

  const finalArticle = (await response.json()).data;
  expect(finalArticle.isStarred).toBe(initialState);

  console.log('✅ TC-ACT-054 PASSED: Favorite status toggle works correctly');
});
