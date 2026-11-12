# Web版RSS阅读平台 - 数据架构设计

> ⚠️ **本目录是设计阶段的原始文档，不是当前实现的说明。**
>
> 这份规格写于项目动工之前，描述的是当时设想的方案。实现过程中做了
> 几处方向性调整，因此下面这些内容**已经过时**：
>
> - 数据库：文档写 PostgreSQL / Supabase，实际用的是 **SQLite**（Prisma + 单文件）
> - 部署：文档写 Vercel Serverless，实际主推 **Docker 自托管**（也有 standalone 直跑）
> - RSS 市场：文档写「含 GitHub、微信公众号重点分类」，实际是 **894 个中文源**，
>   按技术 / 新闻 / 博客 / 商业 / 生活 / 科学 / 视频分类，没有单独突出 GitHub 与公众号
> - 分享：文档写「支持分享到微信、QQ」，实际是 **复制原文链接**（没接社交 SDK）
> - 手机注册：文档写「邮箱或手机号注册」，实际只做了邮箱
>
> 保留它们是因为需求取舍的记录本身有价值 —— 想知道「为什么最后没按这个做」，
> 可以对照 `README.md` 的现状与 `docs/TEST-PLAN.md` 的验收标准。
> **不要按这里的描述来理解或修改代码。**
>
> 记录时间：2026-11-12

## 1. ER图 (Entity Relationship Diagram)

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    数据库ER图                                                │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│     users       │       │  subscriptions   │       │     feeds       │
├─────────────────┤       ├──────────────────┤       ├─────────────────┤
│ id (PK)         │◄──────┤ id (PK)          │──────►│ id (PK)         │
│ email           │   1:N │ user_id (FK)     │  N:1  │ url (unique)    │
│ phone           │       │ feed_id (FK)     │       │ title           │
│ password_hash   │       │ group_id (FK)    │       │ description     │
│ nickname        │       │ is_notify        │       │ icon            │
│ avatar          │       │ created_at       │       │ category        │
│ bio             │       └──────────────────┘       │ last_sync_at    │
│ status          │              │                   │ sync_status     │
│ email_verified  │              │                   │ error_count     │
│ created_at      │              │                   │ created_at      │
│ updated_at      │              │                   └─────────────────┘
└─────────────────┘              │
        │                        │
        │ 1:N                    │ N:1
        ▼                        ▼
┌─────────────────┐       ┌──────────────────┐
│     groups      │       │  market_feeds    │
├─────────────────┤       ├──────────────────┤
│ id (PK)         │       │ id (PK)          │
│ user_id (FK)    │       │ feed_id (FK)     │───────┐
│ name            │       │ category         │       │
│ sort_order      │       │ is_featured      │       │
│ created_at      │       │ subscriber_count │       │
└─────────────────┘       │ avg_update_freq  │       │
                          │ status           │       │
                          └──────────────────┘       │
                                                   │
┌─────────────────┐       ┌──────────────────┐     │
│  read_history   │       │    favorites     │     │
├─────────────────┤       ├──────────────────┤     │
│ id (PK)         │       │ id (PK)          │     │
│ user_id (FK)    │       │ user_id (FK)     │     │
│ article_id (FK) │       │ article_id (FK)  │     │
│ read_at         │       │ created_at       │     │
└─────────────────┘       └──────────────────┘     │
                                                   │
                          ┌──────────────────┐     │
                          │    articles      │◄────┘
                          ├──────────────────┤
                          │ id (PK)          │
                          │ feed_id (FK)     │
                          │ title            │
                          │ link             │
                          │ description      │
                          │ content          │
                          │ author           │
                          │ pub_date         │
                          │ image_url        │
                          │ is_read          │
                          │ created_at       │
                          └──────────────────┘

┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│  notifications  │       │   login_logs     │       │    tags         │
├─────────────────┤       ├──────────────────┤       ├─────────────────┤
│ id (PK)         │       │ id (PK)          │       │ id (PK)         │
│ user_id (FK)    │       │ user_id (FK)     │       │ user_id (FK)    │
│ type            │       │ ip_address       │       │ name            │
│ title           │       │ user_agent       │       │ color           │
│ content         │       │ device_info      │       │ created_at      │
│ is_read         │       │ login_at         │       └─────────────────┘
│ created_at      │       └──────────────────┘                │
└─────────────────┘                                          │
                                                             │ 1:N
                                                             ▼
                                               ┌─────────────────────────┐
                                               │    article_tags         │
                                               ├─────────────────────────┤
                                               │ id (PK)                 │
                                               │ article_id (FK)         │
                                               │ tag_id (FK)             │
                                               └─────────────────────────┘
```

---

## 2. Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// 用户表
model User {
  id            String    @id @default(cuid())
  email         String?   @unique
  phone         String?   @unique
  passwordHash  String?   @map("password_hash")
  nickname      String?
  avatar        String?
  bio           String?
  status        UserStatus @default(ACTIVE)
  emailVerified DateTime? @map("email_verified")
  phoneVerified DateTime? @map("phone_verified")
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  // 关联
  subscriptions Subscription[]
  groups        Group[]
  favorites     Favorite[]
  readHistories ReadHistory[]
  notifications Notification[]
  loginLogs     LoginLog[]
  tags          Tag[]

  @@map("users")
}

enum UserStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
  PENDING_VERIFICATION
}

// RSS源表（全局）
model Feed {
  id          String     @id @default(cuid())
  url         String     @unique
  title       String
  description String?
  icon        String?
  category    FeedCategory @default(OTHER)
  language    String?
  lastSyncAt  DateTime?  @map("last_sync_at")
  syncStatus  SyncStatus @default(PENDING) @map("sync_status")
  errorCount  Int        @default(0) @map("error_count")
  lastError   String?    @map("last_error")
  isActive    Boolean    @default(true) @map("is_active")
  createdAt   DateTime   @default(now()) @map("created_at")
  updatedAt   DateTime   @updatedAt @map("updated_at")

  // 关联
  subscriptions Subscription[]
  articles      Article[]
  marketFeed    MarketFeed?

  @@index([category])
  @@index([syncStatus])
  @@index([isActive])
  @@map("feeds")
}

enum FeedCategory {
  TECH
  NEWS
  GITHUB
  WECHAT
  LIFE
  FINANCE
  BLOG
  OTHER
}

enum SyncStatus {
  PENDING
  SYNCING
  SUCCESS
  ERROR
}

// 用户订阅表
model Subscription {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  feedId    String   @map("feed_id")
  groupId   String?  @map("group_id")
  isNotify  Boolean  @default(true) @map("is_notify")
  createdAt DateTime @default(now()) @map("created_at")

  // 关联
  user  User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  feed  Feed   @relation(fields: [feedId], references: [id], onDelete: Cascade)
  group Group? @relation(fields: [groupId], references: [id], onDelete: SetNull)

  @@unique([userId, feedId])
  @@index([userId])
  @@index([feedId])
  @@map("subscriptions")
}

// 订阅分组表
model Group {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  name      String
  sortOrder Int      @default(0) @map("sort_order")
  createdAt DateTime @default(now()) @map("created_at")

  // 关联
  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  subscriptions Subscription[]

  @@index([userId])
  @@map("groups")
}

// RSS市场表
model MarketFeed {
  id              String        @id @default(cuid())
  feedId          String        @unique @map("feed_id")
  category        FeedCategory
  isFeatured      Boolean       @default(false) @map("is_featured")
  subscriberCount Int           @default(0) @map("subscriber_count")
  avgUpdateFreq   Int?          @map("avg_update_freq") // 平均更新频率（分钟）
  status          MarketStatus  @default(ACTIVE)
  createdAt       DateTime      @default(now()) @map("created_at")
  updatedAt       DateTime      @updatedAt @map("updated_at")

  // 关联
  feed Feed @relation(fields: [feedId], references: [id], onDelete: Cascade)

  @@index([category])
  @@index([isFeatured])
  @@index([status])
  @@map("market_feeds")
}

enum MarketStatus {
  ACTIVE
  INACTIVE
  DEPRECATED
}

// 文章表
model Article {
  id          String    @id @default(cuid())
  feedId      String    @map("feed_id")
  title       String
  link        String
  description String?
  content     String?   @db.Text
  author      String?
  pubDate     DateTime  @map("pub_date")
  imageUrl    String?   @map("image_url")
  guid        String?   @unique
  createdAt   DateTime  @default(now()) @map("created_at")

  // 关联
  feed          Feed           @relation(fields: [feedId], references: [id], onDelete: Cascade)
  favorites     Favorite[]
  readHistories ReadHistory[]
  articleTags   ArticleTag[]

  @@index([feedId])
  @@index([pubDate])
  @@index([createdAt])
  @@map("articles")
}

// 收藏表
model Favorite {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  articleId String   @map("article_id")
  createdAt DateTime @default(now()) @map("created_at")

  // 关联
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  article Article @relation(fields: [articleId], references: [id], onDelete: Cascade)

  @@unique([userId, articleId])
  @@index([userId])
  @@index([articleId])
  @@map("favorites")
}

// 阅读历史表
model ReadHistory {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  articleId String   @map("article_id")
  readAt    DateTime @default(now()) @map("read_at")

  // 关联
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  article Article @relation(fields: [articleId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([articleId])
  @@index([readAt])
  @@map("read_histories")
}

// 标签表
model Tag {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  name      String
  color     String   @default("#3B82F6")
  createdAt DateTime @default(now()) @map("created_at")

  // 关联
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  articleTags ArticleTag[]

  @@unique([userId, name])
  @@index([userId])
  @@map("tags")
}

// 文章标签关联表
model ArticleTag {
  id        String @id @default(cuid())
  articleId String @map("article_id")
  tagId     String @map("tag_id")

  // 关联
  article Article @relation(fields: [articleId], references: [id], onDelete: Cascade)
  tag     Tag     @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@unique([articleId, tagId])
  @@index([articleId])
  @@index([tagId])
  @@map("article_tags")
}

// 通知表
model Notification {
  id        String           @id @default(cuid())
  userId    String           @map("user_id")
  type      NotificationType
  title     String
  content   String?
  data      Json?            // 额外数据（如feedId, articleId等）
  isRead    Boolean          @default(false) @map("is_read")
  createdAt DateTime         @default(now()) @map("created_at")

  // 关联
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([isRead])
  @@index([createdAt])
  @@map("notifications")
}

enum NotificationType {
  FEED_UPDATE
  SYSTEM
  SECURITY
}

// 登录日志表
model LoginLog {
  id          String   @id @default(cuid())
  userId      String   @map("user_id")
  ipAddress   String   @map("ip_address")
  userAgent   String   @map("user_agent")
  deviceInfo  String?  @map("device_info")
  loginAt     DateTime @default(now()) @map("login_at")

  // 关联
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([loginAt])
  @@map("login_logs")
}
```

---

## 3. 数据库索引设计

### 3.1 核心查询索引

| 表名 | 索引字段 | 索引类型 | 用途 |
|------|----------|----------|------|
| users | email | B-tree Unique | 邮箱登录查询 |
| users | phone | B-tree Unique | 手机号登录查询 |
| feeds | url | B-tree Unique | RSS源URL唯一性 |
| feeds | category | B-tree | 按分类筛选 |
| feeds | sync_status | B-tree | 同步状态查询 |
| articles | feed_id | B-tree | 按RSS源查询文章 |
| articles | pub_date | B-tree | 按发布时间排序 |
| subscriptions | user_id | B-tree | 查询用户订阅 |
| subscriptions | user_id, feed_id | B-tree Unique | 防止重复订阅 |
| favorites | user_id | B-tree | 查询用户收藏 |
| read_histories | user_id | B-tree | 查询阅读历史 |
| notifications | user_id, is_read | B-tree | 查询未读通知 |

### 3.2 全文搜索索引

```sql
-- 文章标题和描述全文搜索
CREATE INDEX idx_articles_search ON articles USING gin(to_tsvector('chinese', title || ' ' || COALESCE(description, '')));

-- RSS源标题和描述全文搜索
CREATE INDEX idx_feeds_search ON feeds USING gin(to_tsvector('chinese', title || ' ' || COALESCE(description, '')));
```

---

## 4. 数据关系说明

### 4.1 用户与订阅关系
- **一对多**: 一个用户可以订阅多个RSS源 (User → Subscription)
- **一对多**: 一个用户可以创建多个分组 (User → Group)
- **多对多**: 用户通过Subscription关联Feed

### 4.2 RSS源与文章关系
- **一对多**: 一个RSS源包含多篇文章 (Feed → Article)
- **一对一**: 一个Feed对应一个MarketFeed（如果在市场中）

### 4.3 用户与内容交互
- **多对多**: 用户收藏文章 (User ↔ Article via Favorite)
- **多对多**: 用户阅读文章 (User ↔ Article via ReadHistory)
- **多对多**: 用户给文章打标签 (User → Tag → ArticleTag → Article)

---

## 5. 数据约束

### 5.1 唯一性约束
- `users.email` - 邮箱唯一
- `users.phone` - 手机号唯一
- `feeds.url` - RSS源URL唯一
- `subscriptions(user_id, feed_id)` - 用户不能重复订阅同一源
- `favorites(user_id, article_id)` - 用户不能重复收藏同一文章
- `tags(user_id, name)` - 用户标签名唯一
- `article_tags(article_id, tag_id)` - 文章标签组合唯一

### 5.2 外键约束
- 所有关联字段都设置外键约束
- 用户删除时级联删除相关数据
- RSS源删除时级联删除相关文章和订阅

### 5.3 检查约束
- `users.status` - 枚举值限制
- `feeds.sync_status` - 枚举值限制
- `notifications.type` - 枚举值限制

---

## 6. 数据迁移策略

### 6.1 初始迁移
```bash
# 生成初始迁移
npx prisma migrate dev --name init

# 部署到生产
npx prisma migrate deploy
```

### 6.2 后续变更
- 使用 `prisma migrate dev` 开发环境
- 使用 `prisma migrate deploy` 生产环境
- 重大变更需要数据迁移脚本

---

## 7. 数据备份策略

### 7.1 自动备份 (Supabase)
- 每日自动备份
- 保留30天备份
- 支持时间点恢复

### 7.2 手动备份
```bash
# 导出数据
pg_dump $DATABASE_URL > backup.sql

# 导入数据
psql $DATABASE_URL < backup.sql
```

---

## 8. 性能优化

### 8.1 查询优化
- 使用连接池
- 分页查询（cursor-based）
- 选择性字段查询

### 8.2 数据归档
- 定期归档旧文章（>1年）
- 清理已删除用户的孤立数据
- 清理已读历史（>6个月）

### 8.3 缓存策略
- Redis缓存热门RSS源
- 缓存用户订阅列表
- 缓存RSS市场数据
