/**
 * 集成测试的环境装载。
 *
 * Vitest 不像 Next.js 那样自动读取 `.env`，所以 Prisma 在测试进程里
 * 拿不到 `DATABASE_URL`，跑起来直接 `Environment variable not found`。
 *
 * **重要前提**：集成测试是「直连数据库写 fixture + 通过 HTTP 打真实服务」，
 * 因此测试进程和服务端必须操作**同一个 SQLite 文件**。
 * 用 `docker compose up` 起的容器把库放在 /data 卷里，和宿主机的
 * prisma/dev.db 是两个文件 —— 那种情况下 fixture 写进去了，
 * 服务端也查不到，「数据不存在」的 401/404 会伪装成产品缺陷。
 *
 * 所以正确跑法是本地起 dev server：
 *   npm run dev          # 一个终端
 *   npm run test:integration   # 另一个终端
 */
import fs from "node:fs";
import path from "node:path";

/**
 * 手写 .env 解析，不引 dotenv。
 *
 * 理由：`tests/` 也在 tsconfig 的 include 范围内（`next build` 会做全项目类型检查），
 * 而 dotenv 不是本项目的依赖 —— 为测试脚本新增一个运行时依赖，会让
 * 生产镜像也背上它，代价不值。这里只需要 KEY=VALUE + # 注释，二十行足够。
 */
function loadDotEnv(file: string): void {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    // 去掉可选的成对引号
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    // 不覆盖已存在的环境变量：BASE_URL 之类是调用时显式传的，优先级更高
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadDotEnv(path.resolve(__dirname, "../../.env"));

if (!process.env.DATABASE_URL) {
  throw new Error(
    "集成测试需要 DATABASE_URL。请确认仓库根目录有 .env（可从 .env.example 复制）。"
  );
}

/**
 * 把相对路径的 SQLite 地址改写成绝对路径。
 *
 * `.env` 里写的是 `file:./dev.db`，而 Prisma 在**运行时**按进程的
 * working directory 解析它（不是在 generate 时按 schema 目录固定）。
 * 于是 `npm run dev`（Next 会把路径解析到 prisma/）和
 * `npm run test:integration`（Vitest 的 cwd 是仓库根）会指向两个
 * 不同的文件 —— 测试建的用户写进了根目录的空库，服务端查 prisma/dev.db，
 * 报错却是「用户不存在」，看起来像产品缺陷。
 *
 * 统一成绝对路径后两边必然指向同一个文件。
 */
const rawUrl = process.env.DATABASE_URL;
if (rawUrl.startsWith("file:")) {
  const relative = rawUrl.slice("file:".length);
  if (!path.isAbsolute(relative)) {
    const base = path.resolve(__dirname, "../../prisma");
    process.env.DATABASE_URL = `file:${path.resolve(base, relative.replace(/^\.\//, ""))}`;
  }
}

// 打完 fixture 之后，服务端必须能和测试进程看到同一个库。
// 默认 3000 是 docker compose 的端口，本地 dev server 用 3001 时是这个值。
if (!process.env.INTEGRATION_BASE_URL) {
  process.env.INTEGRATION_BASE_URL = process.env.BASE_URL || "http://localhost:3000";
}
