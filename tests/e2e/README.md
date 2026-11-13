# Playwright E2E 测试

## 这里的文件

- `ui/reader.spec.ts` — 阅读器 UI 的 13 条用例（布局、导航、卡片、工具栏、正文、空状态）。

## 删掉了什么，为什么

这里曾有三个文件：`comprehensive-ui-test.test.js`（230 行）、
`final-comprehensive-test.test.js`（159 行）、`market-interactions.test.js`（89 行）。
它们在改版后全部失效，删掉而不是修补，原因有三条：

1. **断言的是已经删掉的 UI。** 它们检查 `header a[href="/reader"]` 里的「阅读器」按钮
   （顶栏整条取消，导航收进了 `components/reader/reader-dock.tsx`）、
   「发现优质 RSS 源，订阅您感兴趣的内容」（市场副标题已改）、
   以及 profile 的旧分栏布局（已重写成单列卡片）。
2. **它们从不登录。** 三个文件里 `login`／`storageState` 零命中，
   每条用例打开 `/reader`、`/market`、`/settings` 都会被 AuthGuard 弹到 `/login`，
   然后在登录页上找市场按钮。
3. **`comprehensive-ui-test.test.js` 一个断言都没有** —— 35 个 `console.log`
   加 4 张截图，跑完在报告里显示「通过」。没有断言的通过比失败更危险：
   它让人以为这条路被守住了。

它们想覆盖的能力都已被更强的用例接住：

| 原意图 | 现在的守卫 |
| --- | --- |
| 深色模式切换 | `scripts/ui-verify.mjs` G-01 / G-02 |
| 导出 / 导入数据 | `scripts/e2e-verify.mjs` F 组（真发 `/api/opml`） |
| 账号安全、改密码 | `scripts/e2e-verify.mjs` X-01..X-12 |
| 市场订阅、取消订阅 | `scripts/ui-verify.mjs` AA-01..AA-07 |
| 导航入口 | `scripts/ui-verify.mjs` U-01..U-07、Z-02、Z-03 |

## 怎么跑

```bash
npm run verify        # 主验收：scripts/e2e-verify.mjs + scripts/ui-verify.mjs
npm run test:e2e      # Playwright：tests/e2e/**（当前即 ui/reader.spec.ts）
npm run test          # Playwright 全部 project（含 tests/contract/**）
```

`npm run verify` 是发布前该跑的那一条 —— 它直接打 HTTP 接口和真实浏览器，
不依赖 Playwright 的 project 划分。
