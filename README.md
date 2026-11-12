# WeRSS - Web 版 RSS 阅读平台

一款自托管的 Web RSS 阅读器：订阅任意 RSS 源、三栏沉浸式阅读、收藏与阅读历史，
内置一个精选 RSS 源市场方便快速上手。

本项目的目标是「拉下来就能跑」：不依赖任何境外服务，不需要外部 API Key，
数据库是一个本地 SQLite 文件，可以用 `npm run dev`、也可以 `docker compose up` 启动。

## 功能特性

**阅读**
- 三栏布局（订阅源 / 文章列表 / 正文），可折叠
- 文章列表带封面缩略图（从 RSS 的 enclosure / media:* 或正文首图提取）
- 正文自动抓取全文：RSS 只给摘要的源会回源抓落地页正文
- 多种阅读主题与正文字体、字号、行距、页宽调节
- 推送到 Kindle：填一次 Kindle 邮箱，每篇文章都能一键发到设备上（需服务端配置 SMTP，见下）
- 沉浸式阅读模式
- **快捷键**：`Space` / `Shift+Space` 上下翻一屏，`n` / `m` 下一篇 / 上一篇，`j` / `k` 等效，`?` 查看全部键位
- 字号、字体、行距、页宽、四档主题、朗读、标签、Kindle、分享统一收在右上角「更多」菜单里，工具栏只留收藏 / 沉浸 / 更多三项
- 文章已读/未读状态、收藏、阅读历史
- **文章标签**：自建标签给任意文章打标记，下拉里直接新建，和「分组」区分开（分组组织订阅源，标签组织文章）

**订阅**
- 添加任意 RSS / Atom 源，管理分组
- 内置 RSS 市场：收录 890+ 个中文源（技术 / 新闻 / 博客 / 商业 / 生活 / 科学 / 视频），支持搜索与分类筛选，一键订阅
- 手动同步单个源或全部源

**账号**
- 邮箱 + 密码注册登录（bcrypt 存储密码哈希，JWT 放在 HttpOnly Cookie）
- 个人资料、通知、设置
- 访客/演示模式（可选，默认在开发环境开启、生产关闭）

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 14（App Router）+ React 18 |
| 语言 | TypeScript（strict） |
| 样式 | Tailwind CSS 3 + shadcn/ui（Radix） |
| 数据库 | SQLite + Prisma 5 |
| 认证 | 自有 JWT（jose）+ bcryptjs |
| 校验 | Zod 4 |
| 测试 | Vitest（单元）、Playwright（E2E / 契约） |
| 部署 | Node.js 自托管 / Docker |

> 数据库默认是 SQLite 单文件，适合个人自托管。要换成 PostgreSQL 见
> [切换到 PostgreSQL](#切换到-postgresql)。

## 快速开始

前置要求：**Node.js ≥ 20**、npm ≥ 10。

```bash
# 1. 安装依赖
npm install

# 2. 生成环境变量文件
cp .env.example .env

# 3. 生成一个随机密钥填进 .env 的 JWT_SECRET
#    macOS / Linux:
openssl rand -base64 32
#    Windows PowerShell:
#    [Convert]::ToBase64String((1..32 | % { Get-Random -Max 256 }))
```

打开 `.env`，把上面生成的字符串填到 `JWT_SECRET`（不加引号也可以，加了也行）：

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="这里填入刚生成的随机字符串，至少 32 个字符"
NEXTAUTH_SECRET="同 JWT_SECRET 即可"
NEXTAUTH_URL="http://localhost:3000"
```

```bash
# 4. 建库（应用迁移，幂等，可重复执行）
npm run db:deploy

# 5. 灌入演示数据 + RSS 市场目录（可选，但强烈建议：否则 RSS 市场是空的）
npm run db:seed

# 6. 启动
npm run dev
```

打开 http://localhost:3000 。演示数据的账号是：

```
邮箱：test@example.com
密码：123456
```

> 这个账号只用于本地体验，**上线前请注册自己的账号并忽略它**。

### 关于 JWT_SECRET

程序会**显式拒绝**以下情况（启动后第一次登录/鉴权时抛出 `AuthConfigError`）：

- 没有设置 `JWT_SECRET`
- 使用了示例值（如 `your-secret-key`、`change-me`）
- 长度不足 32 个字符

这不是洁癖：`JWT_SECRET` 一旦是公开的示例值，任何人都能签发出合法登录令牌，
等于整个站点的账号体系形同虚设。

## Docker 部署

```bash
# 1. 生成密钥并写入 .env（compose 会自动读取同目录的 .env）
echo "JWT_SECRET=$(openssl rand -base64 32)" > .env
echo "APP_PORT=3000" >> .env

# 2. 构建并启动
docker compose up -d

# 3. 看日志确认迁移与首次 seed 成功
docker compose logs -f werss
```

访问 http://localhost:3000 。

容器行为说明：

- 数据库落在具名卷 `werss-data`（容器内路径 `/data/werss.db`），重建容器不丢数据
- 首次启动自动跑 `prisma migrate deploy`
- 当数据库里一条用户记录都没有时，自动导入演示数据；已有数据则跳过
  （用 `SEED_ON_FIRST_BOOT=false` 可以完全关掉）
- 健康检查打 `GET /api/health`：进程活着但数据库连不上会返回 503

常用环境变量：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `JWT_SECRET` | **必填** | 登录令牌签名密钥，≥32 字符 |
| `APP_PORT` | `3000` | 宿主机映射端口 |
| `ALLOW_GUEST_MODE` | `false` | 是否启用共享访客账号 |
| `ALLOW_PRIVATE_FEED_URLS` | `false` | 允许订阅内网地址的源（自建 RSSHub 时开） |
| `TRUST_PROXY` | `false` | 部署在反向代理后设为 `true`，限流取反代追加的真实 IP |
| `SEED_ON_FIRST_BOOT` | `true` | 空库时是否自动导入演示数据 |
| `NEXTAUTH_URL` | `http://localhost:3000` | 站点对外地址 |
| `SMTP_HOST` 等 | 未设置 | 配置后才启用 Kindle 推送，见下方说明 |

### 不用 Docker，直接跑生产构建

```bash
npm ci
npx prisma generate
npm run build          # 产出 .next/standalone
npm run db:deploy
npm run db:seed        # 可选
node .next/standalone/server.js
```

> 注意：本项目在 `next.config.mjs` 里设了 `output: "standalone"`，
> 因此 `npm start`（即 `next start`）会提示不兼容，请用上面的
> `node .next/standalone/server.js`。

## 环境变量

完整说明见 [`.env.example`](.env.example)，这里只列关键项。

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | SQLite 为 `file:./dev.db`（相对 `prisma/` 目录） |
| `JWT_SECRET` | 是 | 登录令牌签名密钥，≥32 字符，不能用示例值 |
| `NEXTAUTH_SECRET` | 否 | 兼容旧配置，建议与 `JWT_SECRET` 相同 |
| `NEXTAUTH_URL` | 否 | 站点地址，用于 Cookie 与回跳 |
| `ALLOW_GUEST_MODE` | 否 | `true` 时未登录用户以共享访客身份浏览 |
| `ALLOW_PRIVATE_FEED_URLS` | 否 | `true` 时允许订阅内网/私有网段的源；默认拒绝以防 SSRF |
| `TRUST_PROXY` | 否 | `true` 时从 `X-Forwarded-For` 取最后一跳（反代填的真实 IP）；无反代时保持默认 |
| `NODE_ENV` | 否 | `development` / `production` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `SMTP_FROM` | 否 | Kindle 推送用。不配则该功能隐藏，不影响其他部分 |

## Kindle 推送（可选）

Kindle 的 Send-to-Kindle 是纯邮件流程：把文件作为附件发到 `xxx@kindle.com`
（国际）或 `xxx@kindle.cn`（中国），Amazon 推送到设备。所以只需要一个能发信的
SMTP 账号，**不需要 Amazon API、不需要任何 Key**。

```bash
# 以 QQ 邮箱为例（Gmail 同理，换成 smtp.gmail.com:587）
SMTP_HOST="smtp.qq.com"
SMTP_PORT="587"
SMTP_USER="you@qq.com"
SMTP_PASSWORD="授权码"      # 注意是「授权码」，不是登录密码
SMTP_FROM="you@qq.com"
```

配好后重启服务，「更多」菜单里会出现 Kindle 推送项，设置页也会出现推送邮箱输入框。

**还必须做一步**：到 Amazon「管理我的内容和设备 → 首选项 → 个人文档设置」，
把 `SMTP_FROM` 的地址加入「已批准的个人文档电子邮件列表」。不加的话 Amazon
会静默丢弃这封邮件 —— 服务端显示发送成功，但设备上永远收不到。

没配 SMTP 时这个功能整体隐藏，其他部分不受影响。

## 可用脚本

| 命令 | 作用 |
|------|------|
| `npm run dev` | 开发服务器 |
| `npm run build` | 生产构建（产出 standalone） |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run lint` | ESLint |
| `npm run test:unit` | Vitest 单元测试（无需起服务） |
| `npm run test:integration` | Vitest 集成测试（**需先起 dev server**） |
| `npm run test:e2e` | Playwright 端到端测试（需先起服务） |
| `npm run db:deploy` | 应用迁移（生产推荐，幂等） |
| `npm run db:migrate` | 创建新迁移（开发用） |
| `npm run db:seed` | 灌入演示数据（测试账号 + 3 个 RSS 源 + 示例文章） |
| `npm run db:presets` | 灌入访客账号 + 8 个预设 RSS 源（演示/访客模式用） |
| `npm run db:reset` | **清库**并重跑全部迁移 |
| `npm run db:studio` | 打开 Prisma Studio 可视化查看数据 |

## 项目结构

```
.
├── app/
│   ├── (auth)/                # 登录 / 注册 / 忘记密码 / 重置密码
│   ├── (main)/                # 需登录的主应用（reader / market / subscriptions / ...）
│   ├── api/                   # API 路由
│   │   ├── auth/              # 登录、注册、登出、当前用户
│   │   ├── articles/          # 文章列表、详情、已读、收藏
│   │   ├── feeds/             # 订阅、校验、同步
│   │   ├── groups/            # 分组
│   │   ├── favorites/         # 收藏
│   │   ├── history/           # 阅读历史
│   │   ├── notifications/     # 通知
│   │   ├── market/            # RSS 市场
│   │   └── health/            # 健康检查
│   ├── not-found.tsx          # 全局 404
│   └── error.tsx              # 全局错误边界
├── components/                # UI 组件（含 reader/ 阅读器、ui/ shadcn）
├── hooks/                     # 数据获取与 UI 状态 hooks
├── lib/
│   ├── auth.ts                # JWT 签发/校验、鉴权入口
│   ├── sanitize.ts            # RSS 正文 HTML 白名单净化
│   ├── rss-parser.ts          # RSS 抓取与解析
│   ├── prisma.ts              # Prisma 客户端单例
│   └── rate-limit.ts          # 登录/注册限流
├── prisma/
│   ├── schema.prisma          # 数据模型
│   ├── migrations/            # 迁移历史
│   └── dev.db                 # 本地数据库（已 gitignore）
├── scripts/                   # 数据种子脚本（seed.ts / seed-presets.ts）
├── data/
│   └── market-feeds.json      # RSS 市场目录（894 个源的 url/标题/分类）
├── types/                     # 共享类型
├── docs/
│   └── TEST-PLAN.md           # 测试计划与全部验收用例
├── specs/                     # 设计阶段的原始规格（已过时，见目录内说明）
├── design-system/             # 设计阶段的配色提案（已过时，见目录内说明）
├── Dockerfile / docker-compose.yml / docker-entrypoint.sh
├── vitest.config.ts / playwright.config.ts
└── .github/workflows/         # CI（类型检查 + lint + 构建 + 单元测试）
```

## API 概览

所有需要登录的接口都从 HttpOnly Cookie（名 `token`）读取身份；
未登录返回 401。响应统一为 `{ success, data?, message? }` 或 `{ code, data?, message? }`。

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录（设置 Cookie） |
| POST | `/api/auth/logout` | 登出（清除 Cookie） |
| GET | `/api/auth/me` | 当前用户 |
| POST | `/api/auth/forgot-password` | 发送密码重置邮件（未配 SMTP 时返回 503） |
| POST | `/api/auth/reset-password` | 用邮件里的 token 设置新密码 |
| GET | `/api/articles` | 文章列表，支持 `feedId` `groupId` `type` `search` `page` `pageSize` |
| GET | `/api/articles/:id` | 文章详情（校验订阅归属） |
| POST/DELETE | `/api/articles/:id/read` | 标记已读 / 未读 |
| POST/DELETE | `/api/articles/:id/favorite` | 收藏 / 取消收藏 |
| GET/POST | `/api/feeds/subscriptions` | 订阅列表（含每个源的 `unreadCount`）/ 新增订阅 |
| DELETE | `/api/feeds/subscriptions/:id` | 取消订阅 |
| POST | `/api/feeds/validate` | 校验一个 RSS 地址是否可用 |
| POST | `/api/feeds/sync` | 同步订阅源 |
| GET/POST | `/api/groups` | 分组列表 / 新建分组 |
| GET | `/api/favorites` | 收藏列表 |
| GET | `/api/history` | 阅读历史 |
| GET | `/api/notifications` | 通知列表 |
| POST | `/api/cron/digest` | 发送每日摘要邮件（需 `CRON_SECRET`） |
| GET | `/api/market` | RSS 市场源列表 |
| GET | `/api/kindle/push` | 读取推送状态与最近投递记录 |
| POST | `/api/kindle/push` | 把一篇文章推到 Kindle |
| GET/PATCH | `/api/profile` | 读写个人资料（含 Kindle 邮箱） |
| GET/POST/DELETE | `/api/tags` | 标签列表（含文章数）/ 新建标签 / 删除标签 |
| GET/POST/DELETE | `/api/articles/:id/tags` | 读写某篇文章的标签 |
| GET | `/api/health` | 健康检查（含数据库探活） |

`/api/articles` 的分页参数有上界：`pageSize` 最大 100，`page` 最大 10000，
超出会被夹到边界值而不是报错。

## 安全说明

这个项目会渲染来自第三方 RSS 的 HTML，属于典型的不可信输入场景。
仓库内已经做了这些处理，改动相关代码时请留意：

- **正文净化**：`lib/sanitize.ts` 采用白名单（标签 + 属性 + CSS 属性），
  丢弃 `script`/`style`/`iframe`/`form`/`svg` 等，删除所有 `on*` 事件属性、
  危险协议（`javascript:`）与 `data-*`；外链统一 `rel="noopener noreferrer nofollow"`。
  入库前和出库时都会过一遍（历史数据可能已有脏内容）。
- **鉴权**：所有用户态接口都在路由内校验登录状态，并按 `userId` 过滤数据，
  文章详情还会校验「当前用户是否订阅了该源」，未订阅一律 404（避免用状态码差异枚举 id）。
- **密钥**：无硬编码兜底值，示例值与短密钥会被显式拒绝。
- **响应头**：`nosniff`、`X-Frame-Options: SAMEORIGIN`、`Referrer-Policy`、
  `Permissions-Policy` 等，见 `next.config.mjs`。
- **图片**：关掉了 Next 的服务端图片优化（`images.unoptimized`）。
  原先允许任意 https 域，等于把服务器变成开放代理。
- **出站请求（SSRF 防护）**：`lib/url-safety.ts` 会拒绝服务端去请求环回地址、
  私有网段（`10/8`、`172.16/12`、`192.168/16`）、链路本地（含云厂商元数据
  `169.254.169.254`）、非 `http(s)` 协议，以及**解析到内网 IP 的域名**。
  只看主机名字符串是不够的 —— `127.0.0.1`、`[::1]`、`2130706433`、
  或一个解析到内网的公网域名都能绕过去，所以这里做的是「解析出真实 IP 再查」。
  所有 RSS 抓取（订阅、验证、OPML 导入、同步）和全文抓取都经过这一层。
  内网自建 RSSHub 这类正当需求，用 `ALLOW_PRIVATE_FEED_URLS=true` 显式放开。

  已知局限：DNS 解析与实际连接之间存在时间窗，理论上存在 DNS rebinding 攻击。
  彻底封堵需要在 socket 层固定解析结果，代价是接管整个 HTTP 客户端，
  当前实现选择不引入这个复杂度。

- **速率限制（两层）**。第一层按访客限流，负责公平；第二层是全局上限，
  负责安全。之所以需要两层：按访客限流要读 `X-Forwarded-For`，而这个头
  是客户端自己填的，Next.js 会原样透传 —— 换个伪造 IP 就能重置计数。
  「验证 RSS 源」「忘记密码」「注册」这三个接口会真的抓外网 / 发邮件 /
  建账号，因此都额外叠了不依赖任何客户端输入的全局桶，换 IP 也顶不破。
  部署在反向代理后面时，把 `TRUST_PROXY=true` 打开，程序就会取反代追加的
  最后一跳地址，客户端伪造的首段才真正失效。

### 切换到 PostgreSQL

```bash
# 1. 改 prisma/schema.prisma
#    datasource db { provider = "postgresql"  url = env("DATABASE_URL") }

# 2. 改 .env
#    DATABASE_URL="postgresql://user:pass@host:5432/werss?schema=public"

# 3. 重建迁移（SQLite 的迁移文件不能直接用在 PG 上）
rm -rf prisma/migrations
npx prisma migrate dev --name init
npx prisma db seed
```

`prisma/migrations/migration_lock.toml` 里记着当前 provider，
换库时必须删掉重建，否则 Prisma 会拒绝。

## 已知限制

- 同步是手动的，没有定时任务。想自动拉取可以自己加 cron 调 `POST /api/feeds/sync`。
- 限流是进程内内存实现（`lib/rate-limit.ts`），多实例部署时每个实例各算各的。
  单机自托管够用，集群部署需要换成 Redis 之类的共享存储。
- 密码重置邮件依赖 SMTP。没配 SMTP 时「忘记密码」会明确说明发不出去并给出替代方案，不会假装已经发送。
- 站内通知在**同步时自动生成**（每个源每次同步一条「有 N 篇新文章」），但每日摘要邮件需要外部定时任务触发，见下面的「定时任务」一节。
- Kindle 推送只保证「邮件成功交给 SMTP」；Amazon 侧的最终到达取决于发件域名信誉和白名单，服务端无从验证。
- 契约测试（`tests/contract/`）需要先起服务，不在 CI 的默认检查里。
- 全文抓取靠站点适配（`lib/rss-parser.ts` 里 36氪 / 少数派 / 虎嗅 / 极客公园 /
  爱范儿 / 品玩 / Solidot 各有选择器，其余走通用正文提取）。这些站的页面结构
  一改，对应适配就可能失灵，表现为「正文只有摘要那么短」。属预期内的维护成本。
- 部分 RSS 的封面图指向防盗链或已删除的地址，前端加载失败时会直接不显示图片，
  列表项退化成纯文字（而不是留一个灰色空块）。

## 定时任务（可选）

两个需要外部调度器触发的任务。放在应用外，是因为 standalone 进程会重启、
可能多实例，进程内定时器既不可靠也不好观测。

```bash
# 1) 定时同步所有订阅源
curl -X POST http://localhost:3000/api/sync

# 2) 每日摘要邮件（需要 SMTP 和 CRON_SECRET）
curl -X POST http://localhost:3000/api/cron/digest \
     -H "Authorization: Bearer $CRON_SECRET"
```

`CRON_SECRET` 没配置时 `/api/cron/digest` 返回 503（而不是默认放行）——
这个接口要遍历所有用户发信，不能基于任何人的登录态。

crontab 示例（每天早上 8 点发摘要，每 2 小时同步一次）：

```cron
0 8 * * *  curl -s -X POST http://localhost:3000/api/cron/digest -H "Authorization: Bearer $CRON_SECRET"
0 */2 * * * curl -s -X POST http://localhost:3000/api/sync
```

只有同时满足以下三条的用户才会收到摘要：打开了「邮件摘要」开关、
资料里有邮箱、且过去 24 小时内他订阅的源有新文章。


## 开发计划

- [x] 项目初始化、数据库设计
- [x] 用户认证（注册 / 登录 / 登出 / 当前用户）
- [x] RSS 解析与同步
- [x] 阅读器、RSS 市场、订阅管理
- [x] 收藏、阅读历史、通知
- [x] 正文净化、接口鉴权、限流
- [x] Docker 部署与健康检查
- [x] CI（类型检查 + lint + 构建 + 单元测试）
- [ ] 定时同步
- [ ] 邮件服务（找回密码）

## 贡献

欢迎提交 Issue 和 Pull Request。提交前请确认：

```bash
npm run typecheck && npm run lint && npm run test:unit
```

## 许可证

[MIT](LICENSE)
