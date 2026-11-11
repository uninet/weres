# WeRSS - API 契约测试用例文档

## 文档信息
- **版本**: v1.0
- **创建日期**: 2026-02-04
- **测试范围**: API 契约验证
- **测试工具**: Playwright + JSON Schema + OpenAPI
- **测试依据**: OpenAPI 规范 (tests/contract/openapi-schema.yaml)

---

## 测试目标

### 主要目标
1. 验证所有 API 端点符合 OpenAPI 规范定义
2. 确保请求/响应格式、数据类型正确
3. 验证错误处理和状态码使用正确
4. 确保认证和授权机制有效
5. 验证输入验证和边界条件处理

### 质量目标
- 契约测试覆盖率: ≥90%
- 通过率: ≥95%
- P0 级缺陷: 0 个
- P1 级缺陷: ≤3 个

---

## API 端点覆盖范围

| 模块 | 端点 | 方法 | 测试用例数 | 状态 |
|------|--------|------|------------|------|
| Auth | /auth/register | POST | 4 | ⬜ |
| Auth | /auth/login | POST | 4 | ⬜ |
| Articles | /articles | GET | 6 | ⬜ |
| Articles | /articles/:id | GET | 3 | ⬜ |
| Articles | /articles/:id/read | POST | 1 | ⬜ |
| Feeds | /feeds | GET, POST | 3 | ⬜ |
| Feeds | /feeds/:id | DELETE | 2 | ⬜ |
| Groups | /groups | GET, POST, DELETE | 12 | ⬜ |
| Favorites | /favorites | GET | 12 | ⬜ |
| Favorites | /favorites/:id | POST, DELETE | 12 | ⬜ |
| Sync | /sync | POST | 10 | ⬜ |
| **总计** | | | **69** | |

---

## 测试用例列表

### 认证模块 (Auth)

#### TC-ACT-001: 用户注册 - 有效请求
**优先级**: P0 | **类型**: 契约测试 | **端点**: POST /auth/register

**前置条件**:
- API 服务正常运行
- 数据库连接正常
- 邮箱未被注册

**测试步骤**:
1. 构造有效的注册请求：
   ```json
   {
     "email": "test@example.com",
     "password": "Test@123456",
     "nickname": "TestUser"
   }
   ```
2. 发送 POST 请求到 /auth/register
3. 验证响应状态码和结构

**预期结果**:
- [ ] HTTP 状态码: 200
- [ ] 响应包含 `success: true`
- [ ] 响应包含 `data` 对象
- [ ] `data` 包含 `user` 对象（符合 User Schema）
- [ ] `data` 包含 `token` 字符串（JWT 格式）
- [ ] User 对象包含必需字段：id, email, nickname, createdAt
- [ ] User Schema 验证通过

**Schema 参考**: tests/schemas/user.schema.json

---

#### TC-ACT-002: 用户注册 - 无效邮箱格式
**优先级**: P0 | **类型**: 契约测试 | **端点**: POST /auth/register

**前置条件**:
- API 服务正常运行

**测试步骤**:
1. 构造无效邮箱格式的注册请求：
   ```json
   {
     "email": "invalid-email",
     "password": "Test@123456",
     "nickname": "TestUser"
   }
   ```
2. 发送 POST 请求到 /auth/register
3. 验证响应状态码和错误信息

**预期结果**:
- [ ] HTTP 状态码: 400
- [ ] 响应包含 `success: false`
- [ ] 响应包含 `error` 字段（描述错误原因）

---

#### TC-ACT-003: 用户注册 - 弱密码
**优先级**: P1 | **类型**: 契约测试 | **端点**: POST /auth/register

**前置条件**:
- API 服务正常运行

**测试步骤**:
1. 构造弱密码的注册请求：
   ```json
   {
     "email": "weakpwd@example.com",
     "password": "123",
     "nickname": "TestUser"
   }
   ```
2. 发送 POST 请求到 /auth/register

**预期结果**:
- [ ] HTTP 状态码: 400
- [ ] 响应包含 `success: false`
- [ ] 响应包含 `error` 字段（提示密码强度要求）

---

#### TC-ACT-004: 用户注册 - 缺失必需字段
**优先级**: P0 | **类型**: 契约测试 | **端点**: POST /auth/register

**前置条件**:
- API 服务正常运行

**测试步骤**:
1. 构造缺失字段的注册请求：
   ```json
   {
     "email": "incomplete@example.com",
     "password": "Test@123456"
     // 缺少 nickname
   }
   ```
2. 发送 POST 请求到 /auth/register

**预期结果**:
- [ ] HTTP 状态码: 400
- [ ] 响应包含 `success: false`
- [ ] 响应包含 `error` 字段

---

#### TC-ACT-005: 用户登录 - 有效凭据
**优先级**: P0 | **类型**: 契约测试 | **端点**: POST /auth/login

**前置条件**:
- 用户已注册
- 用户凭据正确

**测试步骤**:
1. 构造有效的登录请求：
   ```json
   {
     "email": "user@example.com",
     "password": "Test@123456"
   }
   ```
2. 发送 POST 请求到 /auth/login
3. 验证响应状态码和结构

**预期结果**:
- [ ] HTTP 状态码: 200
- [ ] 响应包含 `success: true`
- [ ] 响应包含 `data.user`（符合 User Schema）
- [ ] 响应包含 `data.token`（JWT 格式）
- [ ] Token 格式符合 JWT 标准：`[header].[payload].[signature]`

---

#### TC-ACT-006: 用户登录 - 无效凭据
**优先级**: P0 | **类型**: 契约测试 | **端点**: POST /auth/login

**前置条件**:
- API 服务正常运行

**测试步骤**:
1. 构造无效的登录请求：
   ```json
   {
     "email": "nonexistent@example.com",
     "password": "WrongPassword123"
   }
   ```
2. 发送 POST 请求到 /auth/login

**预期结果**:
- [ ] HTTP 状态码: 401
- [ ] 响应包含 `success: false`
- [ ] 响应包含 `error` 字段

---

#### TC-ACT-007: 用户登录 - 缺失字段
**优先级**: P0 | **类型**: 契约测试 | **端点**: POST /auth/login

**前置条件**:
- API 服务正常运行

**测试步骤**:
1. 构造缺失字段的登录请求：
   ```json
   {
     "email": "user@example.com"
     // 缺少 password
   }
   ```
2. 发送 POST 请求到 /auth/login

**预期结果**:
- [ ] HTTP 状态码: 400
- [ ] 响应包含 `success: false`
- [ ] 响应包含 `error` 字段

---

#### TC-ACT-008: 响应 Content-Type 验证
**优先级**: P1 | **类型**: 契约测试 | **端点**: POST /auth/login

**前置条件**:
- 用户已注册

**测试步骤**:
1. 发送有效的登录请求
2. 检查响应头 Content-Type

**预期结果**:
- [ ] Content-Type 头包含 `application/json`

---

### 文章模块 (Articles)

#### TC-ACT-009: 获取文章列表 - 默认参数
**优先级**: P0 | **类型**: 契约测试 | **端点**: GET /articles

**前置条件**:
- 用户已登录
- 有授权 token

**测试步骤**:
1. 发送 GET 请求到 /articles（带 Authorization 头）
2. 验证响应状态码和结构

**预期结果**:
- [ ] HTTP 状态码: 200
- [ ] 响应包含 `success: true`
- [ ] 响应包含 `data.articles`（数组）
- [ ] 响应包含 `data.total`（数字）
- [ ] 响应包含 `data.hasMore`（布尔值）
- [ ] 如果有文章，每篇文章符合 Article Schema
- [ ] Schema 验证通过

**Schema 参考**: tests/schemas/article.schema.json

---

#### TC-ACT-010: 获取文章列表 - 分页参数
**优先级**: P0 | **类型**: 契约测试 | **端点**: GET /articles

**前置条件**:
- 用户已登录

**测试步骤**:
1. 发送 GET 请求到 /articles?limit=5&offset=0
2. 验证响应结构

**预期结果**:
- [ ] HTTP 状态码: 200
- [ ] 返回的文章数量 ≤ limit 参数值
- [ ] total 字段为总数量（非当前页数量）

---

#### TC-ACT-011: 获取文章列表 - 按已读状态筛选
**优先级**: P0 | **类型**: 契约测试 | **端点**: GET /articles

**前置条件**:
- 用户已登录
- 有已读和未读文章

**测试步骤**:
1. 发送 GET 请求到 /articles?isRead=false
2. 验证返回的文章

**预期结果**:
- [ ] HTTP 状态码: 200
- [ ] 所有返回的文章 `isRead` 为 false

---

#### TC-ACT-012: 获取文章列表 - 按收藏状态筛选
**优先级**: P1 | **类型**: 契约测试 | **端点**: GET /articles

**前置条件**:
- 用户已登录
- 有收藏的文章

**测试步骤**:
1. 发送 GET 请求到 /articles?isStarred=true
2. 验证返回的文章

**预期结果**:
- [ ] HTTP 状态码: 200
- [ ] 所有返回的文章 `isStarred` 为 true

---

#### TC-ACT-013: 获取文章列表 - 搜索参数
**优先级**: P1 | **类型**: 契约测试 | **端点**: GET /articles

**前置条件**:
- 用户已登录

**测试步骤**:
1. 发送 GET 请求到 /articles?search=keyword
2. 验证响应结构

**预期结果**:
- [ ] HTTP 状态码: 200
- [ ] 返回文章数组（可能为空）
- [ ] 返回的文章包含搜索关键词

---

#### TC-ACT-014: 获取文章列表 - 无效分页参数
**优先级**: P1 | **类型**: 契约测试 | **端点**: GET /articles

**前置条件**:
- 用户已登录

**测试步骤**:
1. 发送 GET 请求到 /articles?limit=1000（超出最大值）
2. 验证响应处理

**预期结果**:
- [ ] HTTP 状态码为 200 或 400
- [ ] 如果 200，返回的文章数量 ≤ 100（最大限制）

---

#### TC-ACT-015: 获取单篇文章 - 有效 ID
**优先级**: P0 | **类型**: 契约测试 | **端点**: GET /articles/:id

**前置条件**:
- 用户已登录
- 文章 ID 有效

**测试步骤**:
1. 从文章列表获取一个有效的 articleId
2. 发送 GET 请求到 /articles/{articleId}
3. 验证响应结构

**预期结果**:
- [ ] HTTP 状态码: 200
- [ ] 响应包含完整文章详情
- [ ] 包含 `content` 字段（完整 HTML 内容）
- [ ] 包含 `feed` 对象（符合 Feed Schema）
- [ ] Schema 验证通过

---

#### TC-ACT-016: 获取单篇文章 - 无效 ID
**优先级**: P0 | **类型**: 契约测试 | **端点**: GET /articles/:id

**前置条件**:
- 用户已登录

**测试步骤**:
1. 发送 GET 请求到 /articles/non-existent-id
2. 验证错误响应

**预期结果**:
- [ ] HTTP 状态码: 404
- [ ] 响应包含 `success: false`
- [ ] 响应包含 `error` 字段

---

#### TC-ACT-017: 获取单篇文章 - 缺失授权
**优先级**: P0 | **类型**: 契约测试 | **端点**: GET /articles/:id

**前置条件**:
- API 服务正常运行

**测试步骤**:
1. 不带 Authorization 头发送 GET 请求
2. 验证响应

**预期结果**:
- [ ] HTTP 状态码: 401

---

#### TC-ACT-018: 标记文章为已读
**优先级**: P0 | **类型**: 契约测试 | **端点**: POST /articles/:id/read

**前置条件**:
- 用户已登录
- 有未读文章

**测试步骤**:
1. 获取一篇未读文章的 ID
2. 发送 POST 请求到 /articles/{articleId}/read
3. 验证响应并确认状态更新

**预期结果**:
- [ ] HTTP 状态码: 200
- [ ] 响应包含 `success: true`
- [ ] 再次查询该文章，`isRead` 为 true

---

#### TC-ACT-019: 响应 Schema 验证 - 空列表
**优先级**: P2 | **类型**: 契约测试 | **端点**: GET /articles

**前置条件**:
- 用户已登录

**测试步骤**:
1. 发送搜索不存在的关键词的请求
2. 验证空列表的响应结构

**预期结果**:
- [ ] HTTP 状态码: 200
- [ ] `articles` 为空数组 []
- [ ] `total` 为 0
- [ ] `hasMore` 为 false

---

#### TC-ACT-020: Content-Type 验证
**优先级**: P1 | **类型**: 契约测试 | **端点**: GET /articles

**前置条件**:
- 用户已登录

**测试步骤**:
1. 发送 GET 请求到 /articles
2. 验证响应头

**预期结果**:
- [ ] Content-Type 头包含 `application/json`

---

### 订阅源模块 (Feeds)

#### TC-ACT-021: 获取订阅源列表
**优先级**: P0 | **类型**: 契约测试 | **端点**: GET /feeds

**前置条件**:
- 用户已登录

**测试步骤**:
1. 发送 GET 请求到 /feeds（带 Authorization）
2. 验证响应结构

**预期结果**:
- [ ] HTTP 状态码: 200
- [ ] 响应包含 `data`（数组）
- [ ] 如果有订阅源，每个符合 Feed Schema
- [ ] Schema 验证通过

**Schema 参考**: tests/schemas/feed.schema.json

---

#### TC-ACT-022: 订阅 RSS 源 - 有效 URL
**优先级**: P0 | **类型**: 契约测试 | **端点**: POST /feeds

**前置条件**:
- 用户已登录

**测试步骤**:
1. 构造有效的订阅请求：
   ```json
   {
     "url": "https://36kr.com/feed",
     "groupId": null
   }
   ```
2. 发送 POST 请求到 /feeds
3. 验证响应结构

**预期结果**:
- [ ] HTTP 状态码: 200（或 400 如果 RSS 验证失败）
- [ ] 如果 200，响应包含 `success: true`
- [ ] 响应包含 `data`（符合 Feed Schema）
- [ ] `data.url` 与请求 URL 一致
- [ ] `data.id` 已定义
- [ ] `data.title` 已定义

---

#### TC-ACT-023: 订阅 RSS 源 - 无效 URL
**优先级**: P0 | **类型**: 契约测试 | **端点**: POST /feeds

**前置条件**:
- 用户已登录

**测试步骤**:
1. 构造无效 URL 的订阅请求：
   ```json
   {
     "url": "not-a-valid-url",
     "groupId": null
   }
   ```
2. 发送 POST 请求到 /feeds

**预期结果**:
- [ ] HTTP 状态码: 400-499
- [ ] 响应包含 `success: false`
- [ ] 响应包含 `error` 字段

---

#### TC-ACT-024: 订阅 RSS 源 - 缺失 URL
**优先级**: P0 | **类型**: 契约测试 | **端点**: POST /feeds

**前置条件**:
- 用户已登录

**测试步骤**:
1. 构造缺失 URL 的请求：
   ```json
   {
     "groupId": null
   }
   ```
2. 发送 POST 请求到 /feeds

**预期结果**:
- [ ] HTTP 状态码: 400
- [ ] 响应包含 `success: false`

---

#### TC-ACT-025: 订阅 RSS 源 - 带分组
**优先级**: P1 | **类型**: 契约测试 | **端点**: POST /feeds

**前置条件**:
- 用户已登录
- 已创建分组

**测试步骤**:
1. 创建一个分组，获取 groupId
2. 构造带分组的订阅请求：
   ```json
   {
     "url": "https://sspai.com/feed",
     "groupId": "group-id"
   }
   ```
3. 发送 POST 请求到 /feeds
4. 验证响应

**预期结果**:
- [ ] HTTP 状态码: 200
- [ ] 响应数据 `groupId` 与请求一致
- [ ] Schema 验证通过

---

#### TC-ACT-026: 删除订阅源
**优先级**: P0 | **类型**: 契约测试 | **端点**: DELETE /feeds/:id

**前置条件**:
- 用户已登录
- 有已订阅的源

**测试步骤**:
1. 获取一个有效的 feedId
2. 发送 DELETE 请求到 /feeds/{feedId}
3. 验证删除成功
4. 重新获取订阅源列表确认

**预期结果**:
- [ ] HTTP 状态码: 200
- [ ] 响应包含 `success: true`
- [ ] 删除后订阅源列表中不包含该源

---

#### TC-ACT-027: 删除订阅源 - 无效 ID
**优先级**: P1 | **类型**: 契约测试 | **端点**: DELETE /feeds/:id

**前置条件**:
- 用户已登录

**测试步骤**:
1. 发送 DELETE 请求到 /feeds/non-existent-id
2. 验证响应

**预期结果**:
- [ ] HTTP 状态码为 200 或 404
- [ ] 响应包含 `success` 字段

---

#### TC-ACT-028: 获取订阅源 - 缺失授权
**优先级**: P0 | **类型**: 契约测试 | **端点**: GET /feeds

**前置条件**:
- API 服务正常运行

**测试步骤**:
1. 不带 Authorization 头发送 GET 请求
2. 验证响应

**预期结果**:
- [ ] HTTP 状态码: 401

---

#### TC-ACT-029: 订阅 RSS 源 - 缺失授权
**优先级**: P0 | **类型**: 契约测试 | **端点**: POST /feeds

**前置条件**:
- API 服务正常运行

**测试步骤**:
1. 不带 Authorization 头发送 POST 请求
2. 验证响应

**预期结果**:
- [ ] HTTP 状态码: 401

---

#### TC-ACT-030: Feed Schema 验证 - 所有字段
**优先级**: P1 | **类型**: 契约测试 | **端点**: POST /feeds

**前置条件**:
- 用户已登录

**测试步骤**:
1. 创建一个订阅源
2. 验证返回的数据包含所有必需字段

**预期结果**:
- [ ] Feed 对象包含：id, title, url
- [ ] Schema 验证通过

---

### 分组模块 (Groups)

#### TC-ACT-031: 获取分组列表
**优先级**: P0 | **类型**: 契约测试 | **端点**: GET /groups

**前置条件**:
- 用户已登录

**测试步骤**:
1. 发送 GET 请求到 /groups（带 Authorization）
2. 验证响应结构

**预期结果**:
- [ ] HTTP 状态码: 200
- [ ] 响应包含 `data`（数组）
- [ ] 如果有分组，每个符合 Group Schema
- [ ] Schema 验证通过

**Schema 参考**: tests/schemas/group.schema.json

---

#### TC-ACT-032: 创建分组 - 有效输入
**优先级**: P0 | **类型**: 契约测试 | **端点**: POST /groups

**前置条件**:
- 用户已登录

**测试步骤**:
1. 构造有效的分组请求：
   ```json
   {
     "name": "Test Group",
     "description": "This is a test group"
   }
   ```
2. 发送 POST 请求到 /groups
3. 验证响应

**预期结果**:
- [ ] HTTP 状态码: 200
- [ ] 响应包含 `success: true`
- [ ] 响应数据 `name` 与请求一致
- [ ] 响应数据包含 `id` 和 `createdAt`
- [ ] Schema 验证通过

---

#### TC-ACT-033: 创建分组 - 缺失名称
**优先级**: P0 | **类型**: 契约测试 | **端点**: POST /groups

**前置条件**:
- 用户已登录

**测试步骤**:
1. 构造缺失名称的请求
2. 发送 POST 请求到 /groups

**预期结果**:
- [ ] HTTP 状态码: 400
- [ ] 响应包含 `success: false`

---

#### TC-ACT-034: 创建分组 - 名称过长
**优先级**: P1 | **类型**: 契约测试 | **端点**: POST /groups

**前置条件**:
- 用户已登录

**测试步骤**:
1. 构造名称超过 100 字符的请求
2. 发送 POST 请求到 /groups

**预期结果**:
- [ ] HTTP 状态码为 200 或 400
- [ ] 如果 200，名称被截断到最大长度

---

#### TC-ACT-035: 创建分组 - 空名称
**优先级**: P1 | **类型**: 契约测试 | **端点**: POST /groups

**前置条件**:
- 用户已登录

**测试步骤**:
1. 构造空名称的请求
2. 发送 POST 请求到 /groups

**预期结果**:
- [ ] HTTP 状态码 ≥ 400
- [ ] 响应包含 `success: false`

---

#### TC-ACT-036: 删除分组
**优先级**: P0 | **类型**: 契约测试 | **端点**: DELETE /groups/:id

**前置条件**:
- 用户已登录
- 有分组

**测试步骤**:
1. 创建一个分组获取 groupId
2. 发送 DELETE 请求到 /groups/{groupId}
3. 验证删除成功

**预期结果**:
- [ ] HTTP 状态码: 200
- [ ] 响应包含 `success: true`
- [ ] 删除后分组列表中不包含该分组

---

#### TC-ACT-037: 删除分组 - 无效 ID
**优先级**: P1 | **类型**: 契约测试 | **端点**: DELETE /groups/:id

**前置条件**:
- 用户已登录

**测试步骤**:
1. 发送 DELETE 请求到 /groups/non-existent-id
2. 验证响应

**预期结果**:
- [ ] HTTP 状态码为 200 或 404
- [ ] 响应包含 `success` 字段

---

#### TC-ACT-038: 获取分组 - 缺失授权
**优先级**: P0 | **类型**: 契约测试 | **端点**: GET /groups

**前置条件**:
- API 服务正常运行

**测试步骤**:
1. 不带 Authorization 头发送 GET 请求
2. 验证响应

**预期结果**:
- [ ] HTTP 状态码: 401

---

#### TC-ACT-039: 创建分组 - 缺失授权
**优先级**: P0 | **类型**: 契约测试 | **端点**: POST /groups

**前置条件**:
- API 服务正常运行

**测试步骤**:
1. 不带 Authorization 头发送 POST 请求
2. 验证响应

**预期结果**:
- [ ] HTTP 状态码: 401

---

#### TC-ACT-040: 分组 Schema 验证 - 包含订阅源
**优先级**: P1 | **类型**: 契约测试 | **端点**: GET /groups

**前置条件**:
- 用户已登录
- 有包含订阅源的分组

**测试步骤**:
1. 获取分组列表
2. 验证包含订阅源的分组结构

**预期结果**:
- [ ] 分组包含 `feeds` 数组
- [ ] feeds 中的每个订阅源符合 Feed Schema
- [ ] Schema 验证通过

---

#### TC-ACT-041: 获取分组 - 空列表
**优先级**: P2 | **类型**: 契约测试 | **端点**: GET /groups

**前置条件**:
- 用户已登录

**测试步骤**:
1. 发送 GET 请求到 /groups
2. 验证空列表的响应结构

**预期结果**:
- [ ] HTTP 状态码: 200
- [ ] 返回空数组 []
- [ ] 响应结构有效

---

#### TC-ACT-042: 创建分组 - 名称包含特殊字符
**优先级**: P2 | **类型**: 契约测试 | **端点**: POST /groups

**前置条件**:
- 用户已登录

**测试步骤**:
1. 构造名称包含特殊字符的请求
2. 发送 POST 请求到 /groups

**预期结果**:
- [ ] HTTP 状态码为 200 或 400
- [ ] 响应结构正确

---

### 收藏模块 (Favorites)

#### TC-ACT-043: 获取收藏列表
**优先级**: P0 | **类型**: 契约测试 | **端点**: GET /favorites

**前置条件**:
- 用户已登录

**测试步骤**:
1. 发送 GET 请求到 /favorites（带 Authorization）
2. 验证响应结构

**预期结果**:
- [ ] HTTP 状态码: 200
- [ ] 响应包含 `data`（数组）
- [ ] 所有收藏文章 `isStarred` 为 true
- [ ] Schema 验证通过

**Schema 参考**: tests/schemas/article.schema.json

---

#### TC-ACT-044: 添加文章到收藏
**优先级**: P0 | **类型**: 契约测试 | **端点**: POST /favorites/:articleId

**前置条件**:
- 用户已登录
- 有文章 ID

**测试步骤**:
1. 发送 POST 请求到 /favorites/{articleId}
2. 验证响应
3. 确认文章出现在收藏列表

**预期结果**:
- [ ] HTTP 状态码: 200
- [ ] 响应包含 `success: true`
- [ ] 收藏列表包含该文章
- [ ] 文章 `isStarred` 为 true

---

#### TC-ACT-045: 重复添加收藏
**优先级**: P1 | **类型**: 契约测试 | **端点**: POST /favorites/:articleId

**前置条件**:
- 用户已登录
- 文章已在收藏中

**测试步骤**:
1. 对已收藏的文章再次发送收藏请求
2. 验证响应

**预期结果**:
- [ ] HTTP 状态码为 200 或 409
- [ ] 响应结构正确

---

#### TC-ACT-046: 移除收藏
**优先级**: P0 | **类型**: 契约测试 | **端点**: DELETE /favorites/:articleId

**前置条件**:
- 用户已登录
- 有收藏的文章

**测试步骤**:
1. 发送 DELETE 请求到 /favorites/{articleId}
2. 验证删除成功
3. 确认文章从收藏列表移除

**预期结果**:
- [ ] HTTP 状态码: 200
- [ ] 响应包含 `success: true`
- [ ] 收藏列表中不包含该文章

---

#### TC-ACT-047: 移除未收藏的文章
**优先级**: P1 | **类型**: 契约测试 | **端点**: DELETE /favorites/:articleId

**前置条件**:
- 用户已登录

**测试步骤**:
1. 对未收藏的文章发送删除请求
2. 验证响应

**预期结果**:
- [ ] HTTP 状态码为 200 或 404
- [ ] 响应包含 `success` 字段

---

#### TC-ACT-048: 获取收藏 - 缺失授权
**优先级**: P0 | **类型**: 契约测试 | **端点**: GET /favorites

**前置条件**:
- API 服务正常运行

**测试步骤**:
1. 不带 Authorization 头发送 GET 请求
2. 验证响应

**预期结果**:
- [ ] HTTP 状态码: 401

---

#### TC-ACT-049: 添加收藏 - 缺失授权
**优先级**: P0 | **类型**: 契约测试 | **端点**: POST /favorites/:articleId

**前置条件**:
- API 服务正常运行

**测试步骤**:
1. 不带 Authorization 头发送 POST 请求
2. 验证响应

**预期结果**:
- [ ] HTTP 状态码: 401

---

#### TC-ACT-050: 移除收藏 - 缺失授权
**优先级**: P0 | **类型**: 契约测试 | **端点**: DELETE /favorites/:articleId

**前置条件**:
- API 服务正常运行

**测试步骤**:
1. 不带 Authorization 头发送 DELETE 请求
2. 验证响应

**预期结果**:
- [ ] HTTP 状态码: 401

---

#### TC-ACT-051: 收藏 Schema 验证
**优先级**: P1 | **类型**: 契约测试 | **端点**: GET /favorites

**前置条件**:
- 用户已登录
- 有收藏的文章

**测试步骤**:
1. 获取收藏列表
2. 验证响应数据结构

**预期结果**:
- [ ] 收藏文章符合 Article Schema
- [ ] 包含所有必需字段

---

#### TC-ACT-052: 获取收藏 - 空列表
**优先级**: P2 | **类型**: 契约测试 | **端点**: GET /favorites

**前置条件**:
- 用户已登录
- 无收藏的文章

**测试步骤**:
1. 清空所有收藏
2. 获取收藏列表
3. 验证响应结构

**预期结果**:
- [ ] HTTP 状态码: 200
- [ ] 返回空数组 []
- [ ] 响应包含 `success: true`

---

#### TC-ACT-053: 收藏与已读状态一致性
**优先级**: P1 | **类型**: 契约测试 | **端点**: GET /favorites & GET /articles?isStarred=true

**前置条件**:
- 用户已登录
- 有收藏的文章

**测试步骤**:
1. 获取收藏列表
2. 获取已标记收藏的文章列表
3. 比较结果

**预期结果**:
- [ ] 两个列表数量一致
- [ ] 数据一致性正确

---

#### TC-ACT-054: 切换收藏状态
**优先级**: P1 | **类型**: 契约测试 | **端点**: POST /favorites/:articleId & DELETE /favorites/:articleId

**前置条件**:
- 用户已登录
- 有文章 ID

**测试步骤**:
1. 记录文章初始收藏状态
2. 添加收藏
3. 验证状态变为收藏
4. 移除收藏
5. 验证状态恢复

**预期结果**:
- [ ] 收藏状态正确切换
- [ ] 每次操作后状态正确

---

### 同步模块 (Sync)

#### TC-ACT-055: 手动触发同步
**优先级**: P0 | **类型**: 契约测试 | **端点**: POST /sync

**前置条件**:
- 用户已登录
- 有订阅的 RSS 源

**测试步骤**:
1. 发送 POST 请求到 /sync
2. 验证响应结构

**预期结果**:
- [ ] HTTP 状态码为 200 或 202
- [ ] 响应包含 `success: true`
- [ ] 响应包含 `data.synced`（数字）
- [ ] 响应包含 `data.newArticles`（数字）
- [ ] synced 和 newArticles 值 ≥ 0

---

#### TC-ACT-056: 同步响应结构验证
**优先级**: P0 | **类型**: 契约测试 | **端点**: POST /sync

**前置条件**:
- 用户已登录

**测试步骤**:
1. 发送 POST 请求到 /sync
2. 验证完整响应结构

**预期结果**:
- [ ] 响应包含必需字段：synced, newArticles
- [ ] 如果存在可选字段（errors, failedFeeds），格式正确
- [ ] 所有字段类型正确

---

#### TC-ACT-057: 同步 - 缺失授权
**优先级**: P0 | **类型**: 契约测试 | **端点**: POST /sync

**前置条件**:
- API 服务正常运行

**测试步骤**:
1. 不带 Authorization 头发送 POST 请求
2. 验证响应

**预期结果**:
- [ ] HTTP 状态码: 401

---

#### TC-ACT-058: 同步 - 无订阅源
**优先级**: P1 | **类型**: 契约测试 | **端点**: POST /sync

**前置条件**:
- 用户已登录
- 无订阅的 RSS 源

**测试步骤**:
1. 创建新用户（无订阅源）
2. 触发同步
3. 验证响应

**预期结果**:
- [ ] HTTP 状态码为 200 或 202
- [ ] synced 为 0
- [ ] newArticles 为 0

---

#### TC-ACT-059: 同步响应时间
**优先级**: P2 | **类型**: 契约测试 | **端点**: POST /sync

**前置条件**:
- 用户已登录
- 有订阅源

**测试步骤**:
1. 触发同步并测量响应时间
2. 验证响应在合理时间内

**预期结果**:
- [ ] HTTP 状态码为 200 或 202
- [ ] 响应时间 < 30 秒

---

#### TC-ACT-060: 同步发现新文章
**优先级**: P1 | **类型**: 契约测试 | **端点**: POST /sync

**前置条件**:
- 用户已登录
- 有新文章可同步

**测试步骤**:
1. 触发同步
2. 验证响应中的新文章数

**预期结果**:
- [ ] HTTP 状态码为 200 或 202
- [ ] newArticles > 0 表示有新文章
- [ ] 响应结构正确

---

#### TC-ACT-061: 同步错误处理
**优先级**: P1 | **类型**: 契约测试 | **端点**: POST /sync

**前置条件**:
- 用户已登录

**测试步骤**:
1. 触发同步
2. 验证错误处理的响应结构

**预期结果**:
- [ ] 即使同步失败，响应结构有效
- [ ] 响应包含 success 和 data 字段

---

#### TC-ACT-062: 连续同步请求
**优先级**: P2 | **类型**: 契约测试 | **端点**: POST /sync

**前置条件**:
- 用户已登录

**测试步骤**:
1. 触发第一次同步
2. 立即触发第二次同步
3. 验证响应

**预期结果**:
- [ ] HTTP 状态码为 200、202 或 429（限流）
- [ ] 如果 429，表示限流生效
- [ ] 响应结构正确

---

#### TC-ACT-063: 同步数据完整性
**优先级**: P1 | **类型**: 契约测试 | **端点**: POST /sync

**前置条件**:
- 用户已登录
- 有订阅源

**测试步骤**:
1. 记录同步前的文章总数
2. 触发同步
3. 记录同步后的文章总数
4. 验证数据一致性

**预期结果**:
- [ ] 同步后文章数 ≥ 同步前文章数
- [ ] 如果有新文章，数量增加

---

#### TC-ACT-064: 同步响应包含有效字段
**优先级**: P0 | **类型**: 契约测试 | **端点**: POST /sync

**前置条件**:
- 用户已登录

**测试步骤**:
1. 触发同步
2. 验证响应包含所有必需字段

**预期结果**:
- [ ] 响应包含 synced（数字）
- [ ] 响应包含 newArticles（数字）
- [ ] 值 ≥ 0
- [ ] 类型正确

---

## 测试执行跟踪

| 用例ID | 状态 | 执行日期 | 执行人 | 备注 |
|--------|------|----------|--------|------|
| TC-ACT-001 | ⬜ 未执行 | - | - | - |
| TC-ACT-002 | ⬜ 未执行 | - | - | - |
| TC-ACT-003 | ⬜ 未执行 | - | - | - |
| TC-ACT-004 | ⬜ 未执行 | - | - | - |
| TC-ACT-005 | ⬜ 未执行 | - | - | - |
| TC-ACT-006 | ⬜ 未执行 | - | - | - |
| TC-ACT-007 | ⬜ 未执行 | - | - | - |
| TC-ACT-008 | ⬜ 未执行 | - | - | - |
| TC-ACT-009 | ⬜ 未执行 | - | - | - |
| TC-ACT-010 | ⬜ 未执行 | - | - | - |
| TC-ACT-011 | ⬜ 未执行 | - | - | - |
| TC-ACT-012 | ⬜ 未执行 | - | - | - |
| TC-ACT-013 | ⬜ 未执行 | - | - | - |
| TC-ACT-014 | ⬜ 未执行 | - | - | - |
| TC-ACT-015 | ⬜ 未执行 | - | - | - |
| TC-ACT-016 | ⬜ 未执行 | - | - | - |
| TC-ACT-017 | ⬜ 未执行 | - | - | - |
| TC-ACT-018 | ⬜ 未执行 | - | - | - |
| TC-ACT-019 | ⬜ 未执行 | - | - | - |
| TC-ACT-020 | ⬜ 未执行 | - | - | - |
| TC-ACT-021 | ⬜ 未执行 | - | - | - |
| TC-ACT-022 | ⬜ 未执行 | - | - | - |
| TC-ACT-023 | ⬜ 未执行 | - | - | - |
| TC-ACT-024 | ⬜ 未执行 | - | - | - |
| TC-ACT-025 | ⬜ 未执行 | - | - | - |
| TC-ACT-026 | ⬜ 未执行 | - | - | - |
| TC-ACT-027 | ⬜ 未执行 | - | - | - |
| TC-ACT-028 | ⬜ 未执行 | - | - | - |
| TC-ACT-029 | ⬜ 未执行 | - | - | - |
| TC-ACT-030 | ⬜ 未执行 | - | - | - |
| TC-ACT-031 | ⬜ 未执行 | - | - | - |
| TC-ACT-032 | ⬜ 未执行 | - | - | - |
| TC-ACT-033 | ⬜ 未执行 | - | - | - |
| TC-ACT-034 | ⬜ 未执行 | - | - | - |
| TC-ACT-035 | ⬜ 未执行 | - | - | - |
| TC-ACT-036 | ⬜ 未执行 | - | - | - |
| TC-ACT-037 | ⬜ 未执行 | - | - | - |
| TC-ACT-038 | ⬜ 未执行 | - | - | - |
| TC-ACT-039 | ⬜ 未执行 | - | - | - |
| TC-ACT-040 | ⬜ 未执行 | - | - | - |
| TC-ACT-041 | ⬜ 未执行 | - | - | - |
| TC-ACT-042 | ⬜ 未执行 | - | - | - |
| TC-ACT-043 | ⬜ 未执行 | - | - | - |
| TC-ACT-044 | ⬜ 未执行 | - | - | - |
| TC-ACT-045 | ⬜ 未执行 | - | - | - |
| TC-ACT-046 | ⬜ 未执行 | - | - | - |
| TC-ACT-047 | ⬜ 未执行 | - | - | - |
| TC-ACT-048 | ⬜ 未执行 | - | - | - |
| TC-ACT-049 | ⬜ 未执行 | - | - | - |
| TC-ACT-050 | ⬜ 未执行 | - | - | - |
| TC-ACT-051 | ⬜ 未执行 | - | - | - |
| TC-ACT-052 | ⬜ 未执行 | - | - | - |
| TC-ACT-053 | ⬜ 未执行 | - | - | - |
| TC-ACT-054 | ⬜ 未执行 | - | - | - |
| TC-ACT-055 | ⬜ 未执行 | - | - | - |
| TC-ACT-056 | ⬜ 未执行 | - | - | - |
| TC-ACT-057 | ⬜ 未执行 | - | - | - |
| TC-ACT-058 | ⬜ 未执行 | - | - | - |
| TC-ACT-059 | ⬜ 未执行 | - | - | - |
| TC-ACT-060 | ⬜ 未执行 | - | - | - |
| TC-ACT-061 | ⬜ 未执行 | - | - | - |
| TC-ACT-062 | ⬜ 未执行 | - | - | - |
| TC-ACT-063 | ⬜ 未执行 | - | - | - |
| TC-ACT-064 | ⬜ 未执行 | - | - | - |

**图例**:
- ⬜ 未执行
- 🟡 执行中
- ✅ 通过
- ❌ 失败
- ⏸️ 跳过

---

## 缺陷统计

| 严重程度 | 数量 | 状态 |
|----------|------|------|
| P0 - 阻断性 | 0 | 待修复: 0, 已修复: 0 |
| P1 - 严重 | 0 | 待修复: 0, 已修复: 0 |
| P2 - 一般 | 0 | 待修复: 0, 已修复: 0 |
| P3 - 轻微 | 0 | 待修复: 0, 已修复: 0 |
| **总计** | **0** | **通过率: 0%** |

---

## OpenAPI 规范验证

### 规范文件位置
- **完整规范**: `tests/contract/openapi-schema.yaml`

### 规范覆盖情况
- ✅ 路径定义: 12 端点
- ✅ 模式定义: User, Article, Feed, Group, Error
- ✅ 安全方案: Bearer Auth (JWT)
- ✅ 标签组织: Auth, Articles, Feeds, Groups, Favorites, Sync

### 契约验证工具
- **JSON Schema**: tests/schemas/*.schema.json
- **验证库**: jsonschema (npm)

---

## 执行指南

### 本地执行
```bash
# 运行所有契约测试
npm run test:contract

# 运行特定模块测试
npx playwright test tests/contract/auth
npx playwright test tests/contract/articles
npx playwright test tests/contract/feeds
```

### CI/CD 集成
```yaml
# .github/workflows/contract-tests.yml
- name: Run Contract Tests
  run: npm run test:contract
```

### 生成覆盖率报告
```bash
# 结合 Playwright HTML 报告
npx playwright show-report
```

---

## 参考文档

- [OpenAPI 规范](./openapi-schema.yaml)
- [测试计划](./01-TEST-PLAN.md)
- [UI 测试用例](./02-UI-TEST-CASES.md)
- [集成测试用例](./03-INTEGRATION-TEST-CASES.md)

---

**文档版本**: v1.0
**最后更新**: 2026-02-04
**下次评审**: 2026-02-11
