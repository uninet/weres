import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest 配置
 *
 * 项目里同时存在两套测试：
 *   - Playwright 契约 / E2E 测试：tests/e2e/**、tests/contract/**
 *   - Vitest 单元测试：tests/unit/**
 *
 * 如果不显式指定 include，vitest 会把 Playwright 的 *.test.ts 也当成单元测试
 * 去跑，结果是「两套测试互相干扰、报一堆莫名其妙的错」。
 * 这里只让 vitest 接管 tests/unit。
 *
 * tests/integration/** 不在 include 里：那些用例通过 fetch 打
 * http://localhost:3000，需要先起一个真实的 dev server。
 * 把它们混进 `npm run test:unit` 会让 CI 里必然失败
 * （ECONNREFUSED 127.0.0.1:3000），而且是环境问题冒充成代码问题。
 * 需要跑时用 `npm run test:integration`（先手动起服务）。
 */
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    exclude: [
      "node_modules",
      ".next",
      "tests/e2e/**",
      "tests/contract/**",
      "tests/integration/**",
    ],
    environment: "node",
    globals: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
