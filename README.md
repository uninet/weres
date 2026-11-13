# WeRSS - Web 版 RSS 阅读平台

一款自托管的 Web RSS 阅读器：订阅任意 RSS 源、三栏沉浸式阅读、收藏与阅读历史，
内置一个精选 RSS 源市场方便快速上手。

本项目的目标是「拉下来就能跑」：不依赖任何境外服务，不需要外部 API Key，
数据库是一个本地 SQLite 文件，可以用 `npm run dev`、也可以 `docker compose up` 启动。

## 功能特性

**阅读**
- 三栏布局（订阅源 / 文章列表 / 正文），可折叠
- 响应式：手机上自动变成三级页面（侧栏 → 列表 → 正文），点进正文后有返回按钮，不会三栏挤在一起
- 正文清洗：订阅源自带的「居中窄栏」样式（`max-width: 680px`）会被解除，原文重复一遍的标题也会剥掉，正文真正铺满可用宽度
- 列表接口只返回标题与摘要，点开文章时才拉全文——一页 50 条从 2–3MB 降到 40KB 左右
- 密码策略：注册与重置都要求 8–72 位且含字母和数字；登录接口只校验 6 位下限，保证策略收紧前注册的老账号（含演示账号）不会被锁在门外
- 接口健壮性：畸形请求体、超界分页参数统一返回 4xx 并夹到合法范围，不会变成 500 或一次拉出整表
- 存量文章自动补齐：已入库但正文过短（<800 字）的文章，下次同步时会补抓一次落地页，不必删除重建
- 文章列表带封面缩略图（从 RSS 的 enclosure / media:* 或正文首图提取）
- 正文自动抓取全文：RSS 只给摘要的源会回源抓落地页正文
- 多种阅读主题与正文字体、字号、行距、页宽调节
- 推送到 Kindle：填一次 Kindle 邮箱，每篇文章都能一键发到设备上（需服务端配置 SMTP，见下）
- 沉浸式阅读模式
- 正文占满视口：工具栏浮在正文之上（滚动时自动淡出、回到顶部重现），翻页计数在右下角，不再有一条横带占掉正文顶部
- 顶部无横栏：导航、主题、设置、个人中心统一收在左下角入口里，把整块屏幕上方完整让给内容
- **快捷键**：`Space` / `Shift+Space` 上下翻一屏，`n` / `m` 下一篇 / 上一篇，`j` / `k` 等效，`?` 查看全部键位
- 字号、字体、行距、页宽、四档主题、朗读、标签、Kindle、分享统一收在右上角「更多」菜单里，工具栏只留收藏 / 沉浸 / 更多三项
- 文章已读/未读状态、收藏、阅读历史
- **文章标签**：自建标签给任意文章打标记，下拉里直接新建，和「分组」区分开（分组组织订阅源，标签组织文章）

**订阅**
- 添加任意 RSS / Atom 源，管理分组
- **添加订阅页 `/add`**：上半屏粘一个 RSS 链接直接订，下半屏按分类浏览市场源（每组 10 个，「更多」展开该组全部）；订阅与取消订阅都有结果提示，按钮状态即时翻转。侧栏 FEEDS 右侧的红色「添加」文字是入口
- 内置 RSS 市场：收录 890+ 个中文源（技术 / 新闻 / 博客 / 商业 / 生活 / 科学 / 视频），支持搜索与分类筛选，一键订阅
- 源图标缺失时用**本地生成**的首字 SVG 兜底，不请求 dicebear 等第三方服务——断网、内网部署都不会裂图
- 手动同步单个源或全部源

**账号**
- 首页：未登录看到的是介绍页（自托管、开源、数据在你自己机器上），已登录访问 `/` 直接进阅读器
- 四个认证页（登录 / 注册 / 忘记密码 / 重置密码）共用一套外壳：同一个品牌区、同样的卡片、同样的配色
- 登录页带「演示账号一键填入」，本地试用不用手打
- 注册页的密码要求清单与服务端规则逐条对齐，不额外要求大写字母或特殊字符
- 注册时被迫勾选的「用户协议 / 隐私政策」是真页面（`/terms`），不再是 `href="#"` 死链
- 邮箱 + 密码注册登录（bcrypt 存储密码哈希，JWT 放在 HttpOnly Cookie）
- 个人中心：资料就地编辑、订阅/收藏/已读三个数字可点直达、通知偏好即时同步到服务端
- 自助改密码（校验当前密码，改完清掉未用的重置链接）和自助注销（需输入密码 + 二次确认，级联清空全部数据）
- 通知、设置
- 访客/演示模式（可选，默认在开发环境开启、生产关闭；演示账号不允许注销）

**导航**
- 五个主入口（阅读 / 市场 / 订阅 / 收藏 / 我的）在移动端底部常驻，不再有「进得去出不来」的页面
- 次级页面（历史 / 通知 / 设置 / 帮助）统一外壳：等高顶栏 + 返回入口，风格与阅读器一致
- 高频操作两步内抵达：个人中心里「收藏 / 历史 / 通知 / 设置」各一行直接进
- 收藏与历史里点标题进**站内阅读器**接着读，想跳原站另有「打开原文」图标
- 文章通知点了直接打开对应文章(`/reader?articleId=…`)

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
>
> 自己注册时密码要求 **8–72 位且同时包含字母和数字**。演示账号的
> `123456` 是历史遗留：登录接口刻意只校验 6 位下限，否则策略一收紧，
> 所有老账号（包括这个演示号）都会被锁在门外。

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

## 备份与恢复

整个应用的状态就是一个 SQLite 文件（容器内 `/data/werss.db`，对应具名卷
`werss-data`）。**备份它 = 备份了一切**，文章正文、订阅、收藏、已读记录都在里面。

### 备份

```bash
# 在宿主机执行：生成一致性快照，再取出来
docker exec werss sh -lc 'cd /app && npm run db:backup -- /data/werss-backup.db'
docker cp werss:/data/werss-backup.db ./werss-backup-$(date +%F).db
```

`npm run db:backup` 内部用 `VACUUM INTO`，会写出一份整理过、事务一致的副本。
不用 `docker cp` 直接拷正在使用的 `.db`：SQLite 在 WAL 模式下有独立的 `-wal` 文件，
拷到写入中途的状态时，问题是恢复那一刻才发现的 —— 而那时旧库已经被覆盖了。

（本地开发时同一个脚本也能用：`npm run db:backup` 默认写到 `DATABASE_URL`
同目录的 `werss-backup-YYYY-MM-DD.db`。）

### 恢复

```bash
docker compose down

# 把备份写回卷里
docker run --rm -v werss_werss-data:/data -v "$PWD:/backup" alpine \
  sh -lc 'cp /backup/werss-2026-11-13.db /data/werss.db'

# 关键一步：修属主。
# 容器里的进程是 uid 1001（nextjs），卷被 root 写进去之后它就没有写权限了，
# 表现是「网页能打开、一登录就 500」，而 /api/health 仍然回 200
# （健康检查会写一次探针，所以它会正确报 readonly —— 但很多人不会去看）。
docker run --rm -v werss_werss-data:/data alpine \
  sh -lc 'chown -R 1001:65533 /data && chmod 644 /data/werss.db'

docker compose up -d
```

如果恢复后 `/api/health` 返回 `{"status":"degraded","database":"readonly"}`，
就是属主没改对，按上面那行 `chown` 重做一次即可。

> 不想执行这几条命令的话，也可以退回到最朴素的做法：`docker cp` 出 `.db` 文件即可，
> 恢复时 `docker cp` 回去并同样 `chown -R 1001:65533 /data`。

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
| `npm run verify` | **发布前主验收**：`e2e-verify` + `ui-verify` 两套共 140 条 |
| `npm run verify:e2e` | 接口验收 86 条（订阅、阅读器、快捷键、内容、鉴权、健壮性、账号自助…） |
| `npm run verify:ui` | 浏览器验收 54 条（响应式、正文排版、悬浮工具栏、导航入口、添加订阅页…） |
| `npm run test` | Playwright 全部 project（UI + 6 组契约） |
| `npm run test:contract` | 接口契约测试 65 条（6 组，需先起服务） |
| `npm run db:backup` | 备份数据库到 `DATABASE_URL` 同目录（`VACUUM INTO`，一致性快照） |
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
│   ├── (auth)/                # 登录 / 注册 / 忘记密码 / 重置密码（共用 components/auth-shell.tsx）
│   ├── (main)/                # 需登录的主应用（reader / market / add / subscriptions / ...）
│   ├── terms/                 # 使用条款与隐私说明（公开页，注册页链接指向它）
│   ├── page.tsx               # 首页：未登录看介绍，已登录直接进阅读器
│   ├── icon.svg               # favicon（Next 文件约定自动注入）
│   ├── api/                   # API 路由
│   │   ├── auth/              # 登录、注册、登出、当前用户
│   │   ├── articles/          # 文章列表、详情、已读、收藏
│   │   ├── feeds/             # 订阅、校验、同步
│   │   ├── groups/            # 分组
│   │   ├── favorites/         # 收藏
│   │   ├── history/           # 阅读历史
│   │   ├── notifications/     # 通知
│   │   ├── market/            # RSS 市场
│   │   ├── profile/           # 个人资料、改密码、注销
│   │   ├── opml/              # OPML 导入导出
│   │   ├── tags/              # 文章标签
│   │   ├── kindle/            # Kindle 推送
│   │   └── health/            # 健康检查
│   ├── not-found.tsx          # 全局 404
│   └── error.tsx              # 全局错误边界
├── components/                # UI 组件（含 reader/ 阅读器、ui/ shadcn）
│   ├── add-feed/feed-row.tsx  # 添加订阅页的单行（图标 + 标题 + 订阅/已订阅按钮）
│   ├── page-shell.tsx         # 次级页面统一外壳（等高顶栏 + 返回 + 限宽内容区）
│   ├── auth-shell.tsx         # 四个认证页统一外壳（品牌区 + 卡片）
│   └── bottom-nav.tsx         # 移动端常驻底部导航（读 lib/navigation.ts）
├── hooks/                     # 数据获取与 UI 状态 hooks
├── lib/
│   ├── auth.ts                # JWT 签发/校验、鉴权入口
│   ├── navigation.ts          # 全站导航唯一信息源（主入口 / 次级入口）
│   ├── sanitize.ts            # RSS 正文 HTML 白名单净化
│   ├── rss-parser.ts          # RSS 抓取与解析
│   ├── feed-icon.ts           # 本地生成首字 SVG 图标（不依赖第三方服务）
│   ├── market.ts              # 市场数据唯一来源（扁平 / 按分类两种切法共用）
│   ├── prisma.ts              # Prisma 客户端单例
│   └── rate-limit.ts          # 登录/注册限流
├── prisma/
│   ├── schema.prisma          # 数据模型
│   ├── migrations/            # 迁移历史
│   └── dev.db                 # 本地数据库（已 gitignore）
├── scripts/                   # 数据种子脚本（seed.ts / seed-presets.ts）
├── data/
│   └── market-feeds.json      # RSS 市场目录（891 个源的 url/标题/分类）
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
| POST | `/api/auth/forgot-password` | 发送密码重置邮件（未配 SMTP 时返回 503，且不消耗发信额度） |
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
| GET | `/api/market` | RSS 市场源列表（默认扁平返回全部；加 `?grouped=1` 按分类返回，可带 `category` 与 `perGroup`，首屏从 483KB 压到 24KB） |
| GET | `/api/kindle/push` | 读取推送状态与最近投递记录 |
| POST | `/api/kindle/push` | 把一篇文章推到 Kindle |
| GET/PATCH | `/api/profile` | 读写个人资料（含 Kindle 邮箱） |
| POST | `/api/profile/password` | 自助改密码（校验当前密码，清掉未用的重置链接） |
| POST | `/api/profile/delete` | 自助注销（需 `confirm: "DELETE"` + 密码，级联删全部数据） |
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
- **鉴权**：所有用户态接口都在路由内校验登录状态，并按 `userId` 过滤数据。
  读文章详情、标记已读、收藏**都**会校验「当前用户是否订阅了该源」，未订阅一律 404
  （不用 403：状态码差异本身就能被用来枚举 id 是否存在）。
  收藏这条尤其要留意 —— 少了归属校验时，任何人拿到一个 articleId 就能收藏别人的文章，
  再通过 `GET /api/favorites` 读到它的标题、链接、作者、摘要，收藏夹就成了越权读文章的旁路。
- **令牌**：读 Cookie 也读 `Authorization: Bearer`，两者走同一个校验函数
  （`getCurrentUserFromRequest`）。早期 `read`/`favorite` 两个路由只读 Cookie，
  用 Bearer 调一律 401 —— 同一规则散在多处实现就会这样漂移。
- **密钥**：无硬编码兜底值，示例值与短密钥会被显式拒绝。
- **响应头**：`nosniff`、`X-Frame-Options: SAMEORIGIN`、`Referrer-Policy`、
  `Permissions-Policy` 等，见 `next.config.mjs`。
- **健康检查探写权限**：`/api/health` 除了 `SELECT 1` 还会删一次不存在的记录。
  只读库上 `SELECT 1` 照样成功，于是容器 healthy 而所有写操作 500
  （恢复备份时用 root `cp` 覆盖库文件就会踩到，属主变成 root）。
  现在这种情况返回 503 + `{"database":"readonly"}` 并带上修复提示。
- **图片**：关掉了 Next 的服务端图片优化（`images.unoptimized`）。
  原先允许任意 https 域，等于把服务器变成开放代理。
- **出站请求（SSRF 防护）**：`lib/url-safety.ts` 会拒绝服务端去请求环回地址、
  私有网段（`10/8`、`172.16/12`、`192.168/16`）、链路本地（含云厂商元数据
  `169.254.169.254`）、非 `http(s)` 协议，以及**解析到内网 IP 的域名**。
  只看主机名字符串是不够的 —— `127.0.0.1`、`[::1]`、`2130706433`、
  或一个解析到内网的公网域名都能绕过去，所以这里做的是「解析出真实 IP 再查」。
  所有 RSS 抓取（订阅、验证、OPML 导入、同步）和全文抓取都经过这一层。
  内网自建 RSSHub 这类正当需求，用 `ALLOW_PRIVATE_FEED_URLS=true` 显式放开。

  **重定向逐跳校验**：只查第一跳是不够的 —— 一个公网 URL 302 到
  `http://169.254.169.254/...`，`fetch` 默认会跟过去，校验就白做了。
  `fetchWithSafety()` 用 `redirect: "manual"` 自己跟跳转，**每一跳都重新校验**，
  最多 5 跳；3xx 的响应体主动 `cancel()`，否则连接会悬着。

  已知局限：DNS 解析与实际连接之间存在时间窗，理论上存在 DNS rebinding 攻击。
  彻底封堵需要在 socket 层固定解析结果，代价是接管整个 HTTP 客户端，
  当前实现选择不引入这个复杂度。

- **速率限制（按访客 + 全局两层）**。第一层按访客限流，负责公平；第二层是全局上限，
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
- 依赖审计（`npm audit`）仍有告警，剩下的大多是 **构建/测试工具链** 里的传递依赖
  （`vitest`/`tinypool`、`eslint-config-next`、`glob`、`postcss` 等），
  生产运行时用不到。`next@14.2.35` 本身还挂着一批已公告的 CVE，
  它们集中在 Server Actions、`middleware.ts`、`next/image` 三块 ——
  本项目一处都没用（`grep -c '"use server"' app/ lib/ components/` 为 0，
  没有 `middleware.ts`，没有 `next/image`），因此实际暴露面远小于清单长度。
  升级到 Next 15 才能真正清零，但那是破坏性变更（React 19、`params`/`searchParams`
  变成 Promise），没有在一次改动里一起做。
- 全文抓取靠站点适配（`lib/rss-parser.ts` 里 36氪 / 少数派 / 虎嗅 / 极客公园 /
  爱范儿 / 品玩 / Solidot 各有选择器，其余走通用正文提取）。这些站的页面结构
  一改，对应适配就可能失灵，表现为「正文只有摘要那么短」。属预期内的维护成本。
- 部分 RSS 的封面图指向防盗链或已删除的地址，前端加载失败时会直接不显示图片，
  列表项退化成纯文字（而不是留一个灰色空块）。

## RSS 市场数据来源

`data/market-feeds.json` 收录了 891 个公开可访问的中文 RSS 源（URL / 标题 / 一句话简介 / 分类），
用来让新部署的实例开箱就有一个能逛的市场，而不是一个空列表。

- **来源**：整理自 [QiReader](https://qireader.com) 的公开发现页与中文 RSS 社区长期公开的订阅列表，
  这些地址本身是各站点主动对外提供的 feed（站点自己就希望被订阅）。
- **只登记，不转载**：仓库里只存 URL 与元信息，不缓存、不分发任何正文内容。
  正文始终由你自己的实例按需去源站抓取，版权归原作者与来源站点。
- **已做的清理**：条目里原本夹带的第三方联系邮箱、个人微信号已全部移除；
  也剔除了资源索引类（torrent / 磁力）条目 —— 它们不是内容源，收录在公开仓库里不合适。
- **发现某个源失效或内容不当**：直接改这个 JSON 提 PR，或在你自己的实例里取消订阅即可。
  市场是「建议清单」不是「白名单」，订阅行为始终由使用者自己发起。

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
