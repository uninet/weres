/**
 * 备份 SQLite 数据库。
 *
 * 为什么不用 `cp`：SQLite 在 WAL 模式下有独立的 -wal 文件，直接拷 `.db`
 * 可能拿到写入中途的状态 —— 恢复那一刻才发现库打不开，而那时旧库已被覆盖。
 * `VACUUM INTO` 会写出整理过、事务一致的副本，单文件即可独立打开。
 *
 * 为什么是 .cjs 而不是 .ts：这个脚本要在 Docker 的 standalone 产物里跑，
 * 那里既没有 tsx 也没有 TypeScript 依赖（seed 是靠构建期 esbuild 预打包
 * 解决的，备份不该为它再加一个构建步骤）。直接 require @prisma/client，
 * 本地开发和容器里都能跑同一份代码。
 *
 * 用法：
 *   npm run db:backup                # 写到 DATABASE_URL 同目录
 *   npm run db:backup -- /data/x.db  # 指定路径
 */
const path = require("node:path");
const fs = require("node:fs");
const { PrismaClient } = require("@prisma/client");

function resolveTarget() {
  const fromArg = process.argv[2];
  if (fromArg) return path.resolve(fromArg);

  const url = process.env.DATABASE_URL || "file:./dev.db";
  const file = url.replace(/^file:/, "");
  const abs = path.isAbsolute(file) ? file : path.resolve(process.cwd(), file);
  const stamp = new Date().toISOString().slice(0, 10);
  return path.join(path.dirname(abs), `werss-backup-${stamp}.db`);
}

async function main() {
  const target = resolveTarget();

  // VACUUM INTO 要求目标文件不存在；已存在时删掉，让脚本可以重复执行
  if (fs.existsSync(target)) {
    fs.rmSync(target);
    console.log(`已移除同名旧备份：${target}`);
  }

  const prisma = new PrismaClient();
  try {
    // 路径无法参数化，用单引号转义防止注入
    const escaped = target.replace(/'/g, "''");
    await prisma.$executeRawUnsafe(`VACUUM INTO '${escaped}'`);
  } finally {
    await prisma.$disconnect();
  }

  const size = fs.statSync(target).size;
  console.log(`✅ 备份完成：${target}（${(size / 1024 / 1024).toFixed(1)} MB）`);
  console.log("   恢复方法见 README「备份与恢复」—— 别忘了 chown -R 1001:65533 /data");
}

main().catch((error) => {
  console.error("备份失败：", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
