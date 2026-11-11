# tests/docs —— 历史测试与诊断报告

这个目录里的文档是项目开发过程中的历史记录（测试计划、执行结果、
缺陷跟踪、UX 分析、AI 代理生成的诊断报告等），**供追溯用，不代表
当前代码状态**。

阅读时请注意：

- 报告里提到的部分脚本已被删除（例如 `scripts/seed-enhanced.ts`、
  `scripts/seed-real-data.ts`、`scripts/check-test-user.ts`、
  `scripts/test-rss.ts`）。现在只有 `scripts/seed.ts`（`npm run db:seed`）
  与 `scripts/seed-presets.ts`（`npm run db:presets`）两个种子脚本。
- 报告里的端口、账号、行号可能与当前代码不一致。
- 当前可用的验证方式以根目录 `README.md` 的「可用脚本」为准：
  `npm run typecheck`、`npm run lint`、`npm run test:unit`、
  `npm run test:integration`、`npm run test:e2e`。

如果要了解项目的真实状态，请直接读 `README.md` 与源码，或以
`npm run typecheck && npm run lint && npm run test:unit` 的实际输出为准。
