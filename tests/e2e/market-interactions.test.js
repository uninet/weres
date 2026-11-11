// tests/e2e/market-interactions.test.js
const { test, expect } = require('@playwright/test');

test.describe('RSS Market Page Tests', () => {
  test.beforeEach(async ({ page }) => {
    // 访问市场页面
    await page.goto('/market');
    await page.waitForLoadState('networkidle'); // 等待网络空闲
  });

  test('should load the market page correctly', async ({ page }) => {
    // 检查页面标题
    await expect(page.locator('h1')).toContainText('RSS 市场');
    
    // 检查页面基本元素
    await expect(page.locator('text=发现优质 RSS 源，订阅您感兴趣的内容')).toBeVisible();
  });

  test('should have working header navigation', async ({ page }) => {
    // 检查阅读器链接（使用更精确的选择器，只选择 header 中的）
    const readerLink = page.locator('header a[href="/reader"]');
    await expect(readerLink).toBeVisible();
    await expect(readerLink.locator('button')).toContainText('阅读器');
    
    // 检查订阅管理链接
    const subsLink = page.locator('header a[href="/subscriptions"]');
    await expect(subsLink).toBeVisible();
    await expect(subsLink.locator('button')).toContainText('订阅管理');
    
    // 检查个人中心链接
    const profileLink = page.locator('header a[href="/profile"]');
    await expect(profileLink).toBeVisible();
    await expect(profileLink.locator('button')).toContainText('个人中心');
  });

  test('should switch tabs correctly', async ({ page }) => {
    // 检查所有标签页
    const marketTab = page.locator('button[role="tab"]:has-text("RSS 市场")');
    const rsshubTab = page.locator('button[role="tab"]:has-text("RSSHub")');
    const customTab = page.locator('button[role="tab"]:has-text("自定义")');
    
    await expect(marketTab).toBeVisible();
    await expect(rsshubTab).toBeVisible();
    await expect(customTab).toBeVisible();
    
    // 点击 RSSHub 标签
    await rsshubTab.click();
    await expect(page.locator('text=RSSHub 热门频道')).toBeVisible();
    
    // 点击自定义标签
    await customTab.click();
    await expect(page.locator('text=添加自定义 RSS 源')).toBeVisible();
    
    // 切回 RSS 市场
    await marketTab.click();
    await expect(page.locator('input[placeholder="搜索 RSS 源..."]')).toBeVisible();
  });

  test('should have working search and filters', async ({ page }) => {
    // 检查搜索框
    const searchBox = page.locator('input[placeholder="搜索 RSS 源..."]');
    await expect(searchBox).toBeVisible();
    
    // 检查分类按钮
    const techBtn = page.locator('button:has-text("技术")');
    await expect(techBtn).toBeVisible();
    
    // 检查订阅按钮
    const subscribeButtons = page.locator('button:has-text("订阅")');
    await expect(subscribeButtons.first()).toBeVisible();
  });

  test('should handle subscription correctly', async ({ page }) => {
    // 获取第一个订阅按钮
    const firstSubscribeBtn = page.locator('button:has-text("订阅")').first();
    await expect(firstSubscribeBtn).toBeEnabled();
    
    // 点击订阅按钮
    await firstSubscribeBtn.click();
    
    // 等待一段时间查看是否有 loading 状态
    await page.waitForTimeout(2000);
    
    // 检查是否有成功提示
    const toastMessages = page.locator('.toast');
    if (await toastMessages.count() > 0) {
      console.log('Found toast messages:', await toastMessages.textContent());
    }
  });
});