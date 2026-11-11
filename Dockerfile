# syntax=docker/dockerfile:1

# ============================================================================
# WeRSS 生产镜像
# ----------------------------------------------------------------------------
# 多阶段构建：builder 负责装依赖 + prisma generate + next build，
# runner 只保留 standalone 产物与运行时依赖，镜像更小、攻击面更窄。
#
# 构建：
#   docker build -t werss .
# 运行（SQLite 数据用 volume 持久化）：
#   docker run -p 3000:3000 -v werss-data:/data \
#     -e JWT_SECRET="$(openssl rand -base64 32)" werss
# ============================================================================

ARG NODE_VERSION=20-alpine

# ---------------------------------------------------------------------------
# Stage 1: deps —— 只装依赖，利用层缓存
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# Prisma 的引擎需要 openssl；Alpine 默认不带
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Stage 2: builder —— 生成 Prisma Client 并编译 Next
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# 构建期不能连数据库：项目里所有涉及用户数据的 API 路由都标了
# `export const dynamic = "force-dynamic"`，无需真实 DATABASE_URL。
# 这里给一个占位值只是为了让 `prisma generate` 通过 schema 校验。
ENV DATABASE_URL="file:./build-placeholder.db"

RUN npx prisma generate
RUN npm run build

# 把 seed 脚本预打包成单个 CJS 文件。
# 原因：standalone 产物的 node_modules 只保留运行期真正被 require 到的包，
# 里面没有 tsx（devDependency）也没有 bcryptjs 的传递依赖树。
# 若不预打包，容器首次启动执行 `npx tsx scripts/seed.ts` 必然失败。
# esbuild 此时已经在 node_modules 里（Next 的依赖），无需额外安装。
RUN npx esbuild scripts/seed.ts \
      --bundle \
      --platform=node \
      --target=node20 \
      --format=cjs \
      --external:@prisma/client \
      --outfile=scripts/seed.bundle.cjs

# ---------------------------------------------------------------------------
# Stage 3: runner —— 最小运行时
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl \
  && addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# SQLite 数据库文件放在 /data，配合 volume 使用
ENV DATABASE_URL="file:/data/werss.db"

# standalone 产物：自带精简后的 node_modules，无需再次 npm ci
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 迁移文件与 Prisma CLI 依赖：容器首次启动时要跑 `prisma migrate deploy`
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/scripts ./scripts
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
  && mkdir -p /data \
  && chown -R nextjs:nodejs /data /app

USER nextjs
EXPOSE 3000
VOLUME ["/data"]

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
