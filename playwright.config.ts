import { defineConfig, devices } from '@playwright/test';
import * as fs from 'fs';

// 检测系统 Chrome 路径
const getChromePath = () => {
  const possiblePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
  ];

  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      return path;
    }
  }
  return undefined;
};

const chromePath = getChromePath();

export default defineConfig({
  // 默认测试目录
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
    ...(chromePath ? {
      launchOptions: {
        executablePath: chromePath,
      },
    } : {}),
  },
  projects: [
    // UI/E2E 测试项目
    {
      name: 'e2e',
      testDir: './tests/e2e',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromePath ? {
          launchOptions: {
            executablePath: chromePath,
          },
        } : {}),
      },
    },
    // API 契约测试项目 - Auth
    {
      name: 'contract-auth',
      testDir: './tests/contract/auth',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromePath ? {
          launchOptions: {
            executablePath: chromePath,
          },
        } : {}),
      },
    },
    // API 契约测试项目 - Articles
    {
      name: 'contract-articles',
      testDir: './tests/contract/articles',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromePath ? {
          launchOptions: {
            executablePath: chromePath,
          },
        } : {}),
      },
    },
    // API 契约测试项目 - Feeds
    {
      name: 'contract-feeds',
      testDir: './tests/contract/feeds',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromePath ? {
          launchOptions: {
            executablePath: chromePath,
          },
        } : {}),
      },
    },
    // API 契约测试项目 - Groups
    {
      name: 'contract-groups',
      testDir: './tests/contract/groups',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromePath ? {
          launchOptions: {
            executablePath: chromePath,
          },
        } : {}),
      },
    },
    // API 契约测试项目 - Favorites
    {
      name: 'contract-favorites',
      testDir: './tests/contract/favorites',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromePath ? {
          launchOptions: {
            executablePath: chromePath,
          },
        } : {}),
      },
    },
    // API 契约测试项目 - Sync
    {
      name: 'contract-sync',
      testDir: './tests/contract/sync',
      use: {
        ...devices['Desktop Chrome'],
        ...(chromePath ? {
          launchOptions: {
            executablePath: chromePath,
          },
        } : {}),
      },
    },
  ],
});
