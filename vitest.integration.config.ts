import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * 集成测试专用配置。
 *
 * 为什么单独一份而不是改 vitest.config.ts 的 include：
 * 这两类测试的**前置条件不同**。单元测试纯内存，跑几秒；
 * 集成测试要 `fetch http://localhost:3000`，必须先起一个真实服务。
 * 混在一个配置里，`npm run test:unit` 就会在没起服务的环境里必然失败，
 * 那是环境问题冒充成代码问题 —— 最消耗人的一种红灯。
 *
 * 原来的状态更糟：`test:integration` 指向 `vitest run tests/integration`，
 * 但 vitest.config.ts 的 exclude 里明确排除了 `tests/integration/**`，
 * 于是这个命令永远输出 `No test files found` 并以非零码退出。
 * 一个「有名字、有脚本、但永远跑不出东西」的测试入口，
 * 比没有这个入口更危险：它让人以为这块被守住了。
 *
 * 用法：先 `npm run dev`（**必须用 dev server，不能用 docker compose**：
 * 容器把库放在 /data 卷里，测试进程直连的却是 prisma/dev.db，
 * fixture 写进去服务端也看不到），再
 *   npm run test:integration
 */
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/integration/setup-env.ts"],
    exclude: ["node_modules", ".next"],
    environment: "node",
    globals: false,
    // 集成测试串行跑：它们共用同一个测试用户和同一批文章，
    // 并行会互相踩（比如一个用例标记已读、另一个断言未读数）。
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
