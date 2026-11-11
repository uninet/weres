# Web版RSS阅读平台 - API接口契约

## 1. API设计规范

### 1.1 RESTful设计原则
- 使用HTTP动词表示操作：GET（查询）、POST（创建）、PUT/PATCH（更新）、DELETE（删除）
- 使用复数名词表示资源：/users, /feeds, /articles
- 使用嵌套路径表示关联：/users/{id}/subscriptions
- 使用查询参数进行过滤、排序、分页

### 1.2 响应格式
```json
{
  "success": true,
  "data": {},
  "message": "操作成功",
  "error": null
}
```

### 1.3 错误处理
```json
{
  "success": false,
  "data": null,
  "message": "错误描述",
  "error": {
    "code": "ERROR_CODE",
    "details": "详细错误信息"
  }
}
```

### 1.4 分页参数
- `page`: 页码（从1开始）
- `limit`: 每页数量（默认20，最大100）
- `cursor`: 游标（用于无限滚动）

### 1.5 认证方式
- 使用 JWT Token
- Header: `Authorization: Bearer {token}`

---

## 2. 认证接口 (/api/auth)

### 2.1 用户注册
```
POST /api/auth/register
```

**请求体：**
```json
{
  "type": "email",  // "email" | "phone"
  "email": "user@example.com",
  "phone": null,
  "password": "password123",
  "code": "123456",  // 验证码
  "agreeTerms": true
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "nickname": null,
      "status": "PENDING_VERIFICATION"
    },
    "message": "注册成功，请查收验证邮件"
  },
  "message": "注册成功"
}
```

### 2.2 用户登录
```
POST /api/auth/login
```

**请求体：**
```json
{
  "type": "email",  // "email" | "phone"
  "email": "user@example.com",
  "phone": null,
  "password": "password123",
  "remember": true
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "token": "jwt_token",
    "user": {
      "id": "user_id",
      "email": "user@example.com",
      "nickname": "用户名",
      "avatar": "https://..."
    }
  },
  "message": "登录成功"
}
```

### 2.3 发送验证码
```
POST /api/auth/send-code
```

**请求体：**
```json
{
  "type": "email",  // "email" | "phone"
  "target": "user@example.com",
  "purpose": "register"  // "register" | "login" | "reset_password"
}
```

### 2.4 忘记密码
```
POST /api/auth/forgot-password
```

**请求体：**
```json
{
  "type": "email",
  "email": "user@example.com",
  "code": "123456",
  "newPassword": "newpassword123"
}
```

### 2.5 刷新Token
```
POST /api/auth/refresh
```

**响应：**
```json
{
  "success": true,
  "data": {
    "token": "new_jwt_token"
  }
}
```

### 2.6 退出登录
```
POST /api/auth/logout
```

---

## 3. 用户接口 (/api/users)

### 3.1 获取当前用户信息
```
GET /api/users/me
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "user_id",
    "email": "user@example.com",
    "phone": "13800138000",
    "nickname": "用户名",
    "avatar": "https://...",
    "bio": "个人简介",
    "status": "ACTIVE",
    "emailVerified": "2024-01-01T00:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### 3.2 更新用户信息
```
PATCH /api/users/me
```

**请求体：**
```json
{
  "nickname": "新昵称",
  "avatar": "https://...",
  "bio": "新简介"
}
```

### 3.3 修改密码
```
PUT /api/users/me/password
```

**请求体：**
```json
{
  "oldPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

### 3.4 绑定/解绑手机号
```
PUT /api/users/me/phone
```

**请求体（绑定）：**
```json
{
  "phone": "13800138000",
  "code": "123456"
}
```

**请求体（解绑）：**
```json
{
  "phone": null,
  "code": "123456"
}
```

### 3.5 绑定/解绑邮箱
```
PUT /api/users/me/email
```

### 3.6 获取登录日志
```
GET /api/users/me/login-logs?page=1&limit=20
```

**响应：**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "log_id",
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "deviceInfo": "Chrome on Windows",
        "loginAt": "2024-01-01T00:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100
    }
  }
}
```

### 3.7 注销账号
```
DELETE /api/users/me
```

**请求体：**
```json
{
  "password": "password123",
  "confirm": true
}
```

---

## 4. RSS订阅接口 (/api/feeds)

### 4.1 获取用户订阅列表
```
GET /api/feeds/subscriptions
```

**查询参数：**
- `groupId`: 按分组筛选
- `sort`: 排序方式（`time` | `name` | `update`）

**响应：**
```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "id": "group_id",
        "name": "技术博客",
        "sortOrder": 0,
        "subscriptions": [
          {
            "id": "sub_id",
            "feed": {
              "id": "feed_id",
              "title": "RSS源名称",
              "description": "描述",
              "icon": "https://...",
              "url": "https://...",
              "lastSyncAt": "2024-01-01T00:00:00Z",
              "unreadCount": 5
            },
            "isNotify": true,
            "createdAt": "2024-01-01T00:00:00Z"
          }
        ]
      }
    ],
    "ungrouped": [
      // 未分组的订阅
    ]
  }
}
```

### 4.2 添加订阅
```
POST /api/feeds/subscriptions
```

**请求体：**
```json
{
  "url": "https://example.com/feed.xml",
  "groupId": "group_id",
  "isNotify": true
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "id": "sub_id",
    "feed": {
      "id": "feed_id",
      "title": "RSS源名称",
      "description": "描述",
      "icon": "https://..."
    },
    "message": "订阅成功"
  }
}
```

### 4.3 验证RSS源
```
POST /api/feeds/validate
```

**请求体：**
```json
{
  "url": "https://example.com/feed.xml"
}
```

**响应：**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "feed": {
      "title": "RSS源名称",
      "description": "描述",
      "icon": "https://...",
      "url": "https://example.com/feed.xml"
    }
  }
}
```

### 4.4 更新订阅设置
```
PATCH /api/feeds/subscriptions/{id}
```

**请求体：**
```json
{
  "groupId": "new_group_id",
  "isNotify": false
}
```

### 4.5 取消订阅
```
DELETE /api/feeds/subscriptions/{id}
```

### 4.6 批量取消订阅
```
DELETE /api/feeds/subscriptions/batch
```

**请求体：**
```json
{
  "ids": ["sub_id_1", "sub_id_2"]
}
```

---

## 5. 分组接口 (/api/groups)

### 5.1 获取分组列表
```
GET /api/groups
```

### 5.2 创建分组
```
POST /api/groups
```

**请求体：**
```json
{
  "name": "新分组",
  "sortOrder": 0
}
```

### 5.3 更新分组
```
PATCH /api/groups/{id}
```

**请求体：**
```json
{
  "name": "新名称",
  "sortOrder": 1
}
```

### 5.4 删除分组
```
DELETE /api/groups/{id}
```

**查询参数：**
- `moveTo`: 将订阅移动到的分组ID（可选，默认归为未分组）

### 5.5 移动订阅到分组
```
PUT /api/groups/{id}/subscriptions
```

**请求体：**
```json
{
  "subscriptionIds": ["sub_id_1", "sub_id_2"]
}
```

---

## 6. 文章接口 (/api/articles)

### 6.1 获取文章列表
```
GET /api/articles
```

**查询参数：**
- `feedId`: 按RSS源筛选
- `groupId`: 按分组筛选
- `isRead`: 按已读状态筛选（`true` | `false`）
- `isFavorite`: 按收藏状态筛选
- `search`: 搜索关键词
- `startDate`: 开始日期
- `endDate`: 结束日期
- `sort`: 排序（`date_desc` | `date_asc`）
- `page`: 页码
- `limit`: 每页数量
- `cursor`: 游标

**响应：**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "article_id",
        "title": "文章标题",
        "description": "文章摘要...",
        "content": "文章内容...",
        "author": "作者",
        "pubDate": "2024-01-01T00:00:00Z",
        "imageUrl": "https://...",
        "link": "https://original-url.com",
        "isRead": false,
        "feed": {
          "id": "feed_id",
          "title": "RSS源名称",
          "icon": "https://..."
        },
        "tags": [
          {
            "id": "tag_id",
            "name": "标签名",
            "color": "#3B82F6"
          }
        ]
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100,
      "hasMore": true,
      "nextCursor": "cursor_string"
    }
  }
}
```

### 6.2 获取文章详情
```
GET /api/articles/{id}
```

### 6.3 标记已读/未读
```
PATCH /api/articles/{id}/read
```

**请求体：**
```json
{
  "isRead": true
}
```

### 6.4 批量标记已读
```
POST /api/articles/batch/read
```

**请求体：**
```json
{
  "ids": ["article_id_1", "article_id_2"],
  "isRead": true,
  "all": false,  // 是否标记所有（当为true时，ids无效）
  "feedId": "feed_id"  // 配合all使用，标记某RSS源的所有文章
}
```

### 6.5 收藏/取消收藏
```
POST /api/articles/{id}/favorite
```

**请求体：**
```json
{
  "isFavorite": true
}
```

### 6.6 获取收藏列表
```
GET /api/articles/favorites?page=1&limit=20&search=关键词
```

### 6.7 添加标签
```
POST /api/articles/{id}/tags
```

**请求体：**
```json
{
  "tagIds": ["tag_id_1", "tag_id_2"]
}
```

### 6.8 移除标签
```
DELETE /api/articles/{id}/tags/{tagId}
```

---

## 7. 标签接口 (/api/tags)

### 7.1 获取标签列表
```
GET /api/tags
```

### 7.2 创建标签
```
POST /api/tags
```

**请求体：**
```json
{
  "name": "标签名",
  "color": "#3B82F6"
}
```

### 7.3 更新标签
```
PATCH /api/tags/{id}
```

### 7.4 删除标签
```
DELETE /api/tags/{id}
```

---

## 8. RSS市场接口 (/api/market)

### 8.1 获取分类列表
```
GET /api/market/categories
```

**响应：**
```json
{
  "success": true,
  "data": [
    {
      "id": "tech",
      "name": "科技",
      "icon": "icon_url",
      "count": 100
    },
    {
      "id": "github",
      "name": "GitHub",
      "icon": "icon_url",
      "count": 50,
      "isFeatured": true
    }
  ]
}
```

### 8.2 获取市场RSS源列表
```
GET /api/market/feeds
```

**查询参数：**
- `category`: 分类ID
- `search`: 搜索关键词
- `sort`: 排序（`subscribers` | `update` | `name`）
- `page`: 页码
- `limit`: 每页数量

**响应：**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "market_feed_id",
        "feed": {
          "id": "feed_id",
          "title": "RSS源名称",
          "description": "描述",
          "icon": "https://...",
          "url": "https://..."
        },
        "category": "TECH",
        "isFeatured": true,
        "subscriberCount": 1000,
        "avgUpdateFreq": 1440,
        "status": "ACTIVE"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 100
    }
  }
}
```

### 8.3 获取热门RSS源
```
GET /api/market/feeds/featured
```

**查询参数：**
- `limit`: 数量（默认10）

### 8.4 从市场订阅
```
POST /api/market/feeds/{id}/subscribe
```

**请求体：**
```json
{
  "groupId": "group_id",
  "isNotify": true
}
```

### 8.5 搜索GitHub项目
```
GET /api/market/github/search?q=react&page=1
```

**响应：**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "name": "facebook/react",
        "description": "React library",
        "stars": 200000,
        "rssUrl": "https://github.com/facebook/react/releases.atom"
      }
    ]
  }
}
```

### 8.6 搜索微信公众号
```
GET /api/market/wechat/search?q=科技&page=1
```

---

## 9. 阅读历史接口 (/api/history)

### 9.1 获取阅读历史
```
GET /api/history?page=1&limit=20
```

### 9.2 删除阅读历史
```
DELETE /api/history/{id}
```

### 9.3 批量删除阅读历史
```
DELETE /api/history/batch
```

**请求体：**
```json
{
  "ids": ["history_id_1", "history_id_2"],
  "all": false
}
```

### 9.4 清空阅读历史
```
DELETE /api/history/all
```

---

## 10. 通知接口 (/api/notifications)

### 10.1 获取通知列表
```
GET /api/notifications?page=1&limit=20&isRead=false
```

**响应：**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "notif_id",
        "type": "FEED_UPDATE",
        "title": "RSS源更新",
        "content": "您订阅的\"RSS源名称\"有5篇新文章",
        "data": {
          "feedId": "feed_id",
          "articleCount": 5
        },
        "isRead": false,
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "unreadCount": 10
  }
}
```

### 10.2 标记已读
```
PATCH /api/notifications/{id}/read
```

### 10.3 全部标记已读
```
POST /api/notifications/read-all
```

### 10.4 删除通知
```
DELETE /api/notifications/{id}
```

### 10.5 获取未读通知数
```
GET /api/notifications/unread-count
```

---

## 11. 首页接口 (/api/home)

### 11.1 获取首页数据
```
GET /api/home
```

**响应：**
```json
{
  "success": true,
  "data": {
    "frequentFeeds": [
      // 常用订阅（基于阅读频率）
    ],
    "popularFeeds": [
      // 热门RSS源
    ],
    "latestArticles": [
      // 最新更新文章
    ],
    "unreadCount": 50
  }
}
```

---

## 12. 错误码定义

| 错误码 | 描述 | HTTP状态码 |
|--------|------|------------|
| `INVALID_REQUEST` | 请求参数错误 | 400 |
| `UNAUTHORIZED` | 未授权 | 401 |
| `FORBIDDEN` | 禁止访问 | 403 |
| `NOT_FOUND` | 资源不存在 | 404 |
| `METHOD_NOT_ALLOWED` | 方法不允许 | 405 |
| `CONFLICT` | 资源冲突 | 409 |
| `RATE_LIMITED` | 请求过于频繁 | 429 |
| `INTERNAL_ERROR` | 服务器内部错误 | 500 |
| `SERVICE_UNAVAILABLE` | 服务不可用 | 503 |

### 业务错误码

| 错误码 | 描述 |
|--------|------|
| `USER_EXISTS` | 用户已存在 |
| `USER_NOT_FOUND` | 用户不存在 |
| `INVALID_CREDENTIALS` | 凭据无效 |
| `ACCOUNT_LOCKED` | 账号已锁定 |
| `EMAIL_NOT_VERIFIED` | 邮箱未验证 |
| `INVALID_CODE` | 验证码错误 |
| `CODE_EXPIRED` | 验证码已过期 |
| `FEED_EXISTS` | RSS源已存在 |
| `FEED_NOT_FOUND` | RSS源不存在 |
| `INVALID_FEED_URL` | 无效的RSS源URL |
| `FEED_PARSE_ERROR` | RSS源解析失败 |
| `SUBSCRIPTION_EXISTS` | 已订阅该源 |
| `GROUP_NOT_FOUND` | 分组不存在 |
| `ARTICLE_NOT_FOUND` | 文章不存在 |

---

## 13. 接口安全

### 13.1 认证要求
- 公开接口：/api/auth/*, /api/market/*
- 需要认证：其他所有接口

### 13.2 速率限制
- 认证接口：5次/分钟
- 普通接口：100次/分钟
- RSS验证：10次/分钟

### 13.3 输入验证
- 所有输入参数进行类型和格式验证
- 使用Zod进行Schema验证
- 防止SQL注入（使用Prisma ORM）
- 防止XSS攻击（输出转义）
