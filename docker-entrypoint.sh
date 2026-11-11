#!/bin/sh
# ============================================================================
# WeRSS 容器入口脚本
# ----------------------------------------------------------------------------
# 职责：
#   1. 检查必需的密钥是否配置（没配就直接失败，而不是带着空密钥启动）
#   2. 首次启动时把数据库迁移应用到 /data 下的 SQLite 文件
#   3. 只在数据库为空时灌入演示数据（避免每次重启都重复写）
#   4. exec 交棒给主进程，保证信号能正确传递给 Node
# ============================================================================
set -e

# ---------------------------------------------------------------------------
# 1. 密钥校验
# ---------------------------------------------------------------------------
if [ -z "${JWT_SECRET}" ]; then
  echo "ERROR: JWT_SECRET 未设置。" >&2
  echo "       生成方式：openssl rand -base64 32" >&2
  echo "       运行示例：docker run -e JWT_SECRET=\"\$(openssl rand -base64 32)\" ..." >&2
  exit 1
fi

if [ "${#JWT_SECRET}" -lt 32 ]; then
  echo "ERROR: JWT_SECRET 长度不足 32 个字符（当前 ${#JWT_SECRET}）。" >&2
  echo "       生成方式：openssl rand -base64 32" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# 2. 数据库准备
# ---------------------------------------------------------------------------
DB_PATH="${DATABASE_URL#file:}"

if [ -n "${DB_PATH}" ] && [ "${DB_PATH}" != "${DATABASE_URL}" ]; then
  mkdir -p "$(dirname "${DB_PATH}")"
fi

echo "[entrypoint] 应用数据库迁移..."
# 直接调 CLI 入口，不用 `npx prisma`：
# 镜像里只复制了 node_modules/prisma 目录本身，没有 node_modules/.bin/prisma，
# npx 找不到本地命令时会尝试联网下载 —— 容器内通常没有外网，
# 且这种行为不可预测，故显式指定入口文件。
node node_modules/prisma/build/index.js migrate deploy

# ---------------------------------------------------------------------------
# 3. 首次启动灌入演示数据
# ---------------------------------------------------------------------------
# 判断依据：User 表是否存在记录。只在完全空的库里 seed，
# 避免覆盖用户自己注册的账号和订阅。
if [ "${SEED_ON_FIRST_BOOT:-true}" = "true" ]; then
  USER_COUNT=$(node -e "
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    p.user.count()
      .then(c => { console.log(c); return p.\$disconnect(); })
      .catch(() => { console.log(0); return p.\$disconnect(); });
  " 2>/dev/null | tail -1)

  if [ "${USER_COUNT}" = "0" ]; then
    echo "[entrypoint] 数据库为空，写入演示数据..."
    node scripts/seed.bundle.cjs || echo "[entrypoint] 演示数据写入失败（不影响启动）"
  else
    echo "[entrypoint] 数据库已有 ${USER_COUNT} 个用户，跳过演示数据。"
  fi
fi

echo "[entrypoint] 启动应用..."
exec "$@"
