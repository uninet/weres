// tests/e2e/final-comprehensive-test.test.js
const { test, expect } = require('@playwright/test');

test.describe('最终综合功能测试', () => {
  test('1. RSS 市场 - 订阅功能完整测试', async ({ page }) => {
    console.log('\n=== 测试 1: RSS 市场订阅功能 ===');
    
    await page.goto('/market');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // 查找订阅按钮
    const subscribeButtons = page.locator('button:has-text("订阅")');
    const count = await subscribeButtons.count();
    expect(count).toBeGreaterThan(0);
    
    // 点击第一个订阅按钮
    await subscribeButtons.first().click();
    await page.waitForTimeout(2000);
    
    // 检查是否有 toast 提示
    const toast = page.locator('[data-sonner-toast]');
    const toastCount = await toast.count();
    expect(toastCount).toBeGreaterThan(0);
    
    console.log('✓ 订阅功能正常，有 Toast 提示');
  });

  test('2. 设置页面 - 深色模式切换', async ({ page }) => {
    console.log('\n=== 测试 2: 深色模式切换 ===');
    
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // 查找深色模式开关
    const darkModeSwitch = page.locator('button[role="switch"]').first();
    await expect(darkModeSwitch).toBeVisible();
    
    // 点击开关
    await darkModeSwitch.click();
    await page.waitForTimeout(1500);
    
    // 检查是否有 toast
    const toast = page.locator('[data-sonner-toast]');
    await expect(toast.first()).toBeVisible();
    
    console.log('✓ 深色模式切换正常，有 Toast 提示');
  });

  test('3. 设置页面 - 导出数据', async ({ page }) => {
    console.log('\n=== 测试 3: 导出数据功能 ===');
    
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // 查找导出按钮
    const exportButton = page.locator('button:has-text("导出")').first();
    await expect(exportButton).toBeVisible();
    
    // 点击导出
    await exportButton.click();
    await page.waitForTimeout(3000);
    
    // 检查是否有 toast
    const toast = page.locator('[data-sonner-toast]');
    await expect(toast.first()).toBeVisible();
    
    console.log('✓ 导出数据功能正常，有 Toast 提示');
  });

  test('4. 设置页面 - 清除缓存', async ({ page }) => {
    console.log('\n=== 测试 4: 清除缓存功能 ===');
    
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // 查找清除按钮
    const clearButton = page.locator('button:has-text("清除")').first();
    await expect(clearButton).toBeVisible();
    
    // 点击清除
    await clearButton.click();
    await page.waitForTimeout(2000);
    
    // 检查是否有 toast
    const toast = page.locator('[data-sonner-toast]');
    await expect(toast.first()).toBeVisible();
    
    console.log('✓ 清除缓存功能正常，有 Toast 提示');
  });

  test('5. 个人中心 - 账号安全按钮', async ({ page }) => {
    console.log('\n=== 测试 5: 个人中心账号安全 ===');
    
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    
    // 点击账号安全标签
    const accountTab = page.locator('button:has-text("账号安全")');
    await accountTab.click();
    await page.waitForTimeout(1000);
    
    // 查找修改密码按钮
    const changePasswordBtn = page.locator('button:has-text("修改")').first();
    await expect(changePasswordBtn).toBeVisible();
    
    // 点击修改密码
    await changePasswordBtn.click();
    await page.waitForTimeout(1000);
    
    // 检查是否有 toast
    const toast = page.locator('[data-sonner-toast]');
    await expect(toast.first()).toBeVisible();
    
    console.log('✓ 账号安全按钮正常，有 Toast 提示');
  });

  test('6. 个人中心 - 我的收藏跳转', async ({ page }) => {
    console.log('\n=== 测试 6: 我的收藏跳转 ===');
    
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    
    // 查找我的收藏按钮
    const favoritesBtn = page.locator('button:has-text("我的收藏")').first();
    await expect(favoritesBtn).toBeVisible();
    
    // 点击我的收藏
    await favoritesBtn.click();
    await page.waitForTimeout(1000);
    
    // 检查是否跳转到正确页面
    const currentUrl = page.url();
    expect(currentUrl).toContain('/favorites');
    
    console.log(`✓ 正确跳转到 ${currentUrl}`);
  });

  test('7. 个人中心 - 阅读历史跳转', async ({ page }) => {
    console.log('\n=== 测试 7: 阅读历史跳转 ===');
    
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    
    // 查找阅读历史按钮
    const historyBtn = page.locator('button:has-text("阅读历史")').first();
    await expect(historyBtn).toBeVisible();
    
    // 点击阅读历史
    await historyBtn.click();
    await page.waitForTimeout(1000);
    
    // 检查是否跳转到正确页面
    const currentUrl = page.url();
    expect(currentUrl).toContain('/history');
    
    console.log(`✓ 正确跳转到 ${currentUrl}`);
  });
});
