// tests/e2e/comprehensive-ui-test.test.js
const { test, expect } = require('@playwright/test');

test.describe('综合 UI 功能测试', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('1. RSS 市场 - 订阅功能测试', async ({ page }) => {
    console.log('\n=== 测试 1: RSS 市场订阅功能 ===');
    
    // 访问市场页面
    await page.goto('/market');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // 截图
    await page.screenshot({ path: 'tests/e2e/screenshots/market-before.png', full_page: true });
    
    // 查找订阅按钮
    const subscribeButtons = page.locator('button:has-text("订阅"), button:has-text("已订阅")');
    const count = await subscribeButtons.count();
    console.log(`找到 ${count} 个订阅按钮`);
    
    if (count > 0) {
      const firstBtn = subscribeButtons.first();
      await firstBtn.scrollIntoViewIfNeeded();
      await firstBtn.click();
      console.log('点击了第一个订阅按钮');
      
      // 等待响应
      await page.waitForTimeout(3000);
      
      // 截图查看结果
      await page.screenshot({ path: 'tests/e2e/screenshots/market-after-click.png', full_page: true });
      
      // 检查是否有 toast 提示
      const toast = page.locator('[data-sonner-toast]');
      if (await toast.count() > 0) {
        const toastText = await toast.first().textContent();
        console.log(`Toast 消息：${toastText}`);
      } else {
        console.log('⚠️ 未发现 Toast 提示');
      }
    } else {
      console.log('⚠️ 未找到订阅按钮');
    }
  });

  test('2. 个人中心 - 页面结构测试', async ({ page }) => {
    console.log('\n=== 测试 2: 个人中心页面结构 ===');
    
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'tests/e2e/screenshots/profile-structure.png', full_page: true });
    
    // 检查页面元素
    const menuItems = page.locator('[role="menuitem"], [role="button"], a[href*="security"], a[href*="notification"], a[href*="display"]');
    const count = await menuItems.count();
    console.log(`找到 ${count} 个菜单项`);
    
    // 列出所有菜单项
    const texts = await menuItems.allTextContents();
    console.log('菜单项文本:', texts);
  });

  test('3. 个人中心 - 账号安全测试', async ({ page }) => {
    console.log('\n=== 测试 3: 账号安全功能 ===');
    
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    
    // 查找账号安全相关链接
    const securityLink = page.locator('a[href*="security"], text=账号安全, text=账户安全').first();
    
    if (await securityLink.count() > 0) {
      await securityLink.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'tests/e2e/screenshots/security-page.png', full_page: true });
      console.log('点击了账号安全链接');
    } else {
      console.log('⚠️ 未找到账号安全链接');
    }
  });

  test('4. 个人中心 - 我的收藏测试', async ({ page }) => {
    console.log('\n=== 测试 4: 我的收藏功能 ===');
    
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    
    // 查找我的收藏链接
    const favoritesLink = page.locator('a[href*="favorite"], text=我的收藏').first();
    
    if (await favoritesLink.count() > 0) {
      await favoritesLink.click();
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      console.log(`当前 URL: ${currentUrl}`);
      
      await page.screenshot({ path: 'tests/e2e/screenshots/favorites-page.png', full_page: true });
      
      if (currentUrl.includes('/favorites')) {
        console.log('✓ 正确跳转到收藏页面');
      } else {
        console.log('❌ 跳转错误，应该在 /favorites 页面');
      }
    } else {
      console.log('⚠️ 未找到我的收藏链接');
    }
  });

  test('5. 个人中心 - 我的历史测试', async ({ page }) => {
    console.log('\n=== 测试 5: 我的历史功能 ===');
    
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    
    // 查找历史记录链接
    const historyLink = page.locator('a[href*="history"], text=我的历史, text=历史记录').first();
    
    if (await historyLink.count() > 0) {
      await historyLink.click();
      await page.waitForTimeout(2000);
      
      const currentUrl = page.url();
      console.log(`当前 URL: ${currentUrl}`);
      
      await page.screenshot({ path: 'tests/e2e/screenshots/history-page.png', full_page: true });
      
      if (currentUrl.includes('/history')) {
        console.log('✓ 正确跳转到历史页面');
      } else {
        console.log('❌ 跳转错误，应该在 /history 页面');
      }
    } else {
      console.log('⚠️ 未找到历史记录链接');
    }
  });

  test('6. 设置页面 - 深色模式测试', async ({ page }) => {
    console.log('\n=== 测试 6: 深色模式切换 ===');
    
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    await page.screenshot({ path: 'tests/e2e/screenshots/settings-before.png', full_page: true });
    
    // 查找深色模式开关
    const darkModeToggle = page.locator('button:has-text("深色"), [role="switch"]').first();
    
    if (await darkModeToggle.count() > 0) {
      console.log('找到深色模式开关');
      await darkModeToggle.click();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ path: 'tests/e2e/screenshots/settings-after.png', full_page: true });
      
      // 检查 html 或 body 的 class/data 属性
      const htmlClass = await page.locator('html').getAttribute('class');
      console.log(`HTML class: ${htmlClass}`);
      
      const bodyClass = await page.locator('body').getAttribute('class');
      console.log(`Body class: ${bodyClass}`);
    } else {
      console.log('⚠️ 未找到深色模式开关');
    }
  });

  test('7. 数据管理 - 导出数据测试', async ({ page }) => {
    console.log('\n=== 测试 7: 导出数据功能 ===');
    
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // 查找数据管理部分
    const exportButton = page.locator('button:has-text("导出"), text=导出数据').first();
    
    if (await exportButton.count() > 0) {
      await exportButton.click();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ path: 'tests/e2e/screenshots/export-after.png', full_page: true });
      
      // 检查是否有 toast
      const toast = page.locator('[data-sonner-toast]');
      if (await toast.count() > 0) {
        const toastText = await toast.first().textContent();
        console.log(`Toast: ${toastText}`);
      }
      
      console.log('点击了导出按钮');
    } else {
      console.log('⚠️ 未找到导出按钮');
    }
  });

  test('8. 数据管理 - 清除缓存测试', async ({ page }) => {
    console.log('\n=== 测试 8: 清除缓存功能 ===');
    
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // 查找清除缓存按钮
    const clearButton = page.locator('button:has-text("清除"), text=清除缓存').first();
    
    if (await clearButton.count() > 0) {
      await clearButton.click();
      await page.waitForTimeout(2000);
      
      await page.screenshot({ path: 'tests/e2e/screenshots/clear-after.png', full_page: true });
      
      // 检查是否有 toast
      const toast = page.locator('[data-sonner-toast]');
      if (await toast.count() > 0) {
        const toastText = await toast.first().textContent();
        console.log(`Toast: ${toastText}`);
      }
      
      console.log('点击了清除缓存按钮');
    } else {
      console.log('⚠️ 未找到清除缓存按钮');
    }
  });
});
