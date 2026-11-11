# AI Agent 工作流指南 - 小程序/Web开发篇

## 1. 概述

### 1.1 文档目的

本文档旨在为小程序和Web开发项目提供一套完整的 AI Agent Skills 调度最佳实践。通过系统化的技能组合和调用顺序，帮助开发者高效完成各类开发任务，包括但不限于微信小程序、支付宝小程序、抖音小程序等主流小程序平台，以及现代Web应用开发。

### 1.2 适用项目类型

| 平台类型 | 技术选型 | 特点 |
|----------|----------|------|
| 微信小程序 | 原生开发、Taro、Uni-app | 用户基数大、生态完善 |
| 支付宝小程序 | 原生开发、Remax | 支付能力强、商业场景丰富 |
| 抖音小程序 | 原生开发、Tiky | 流量红利、社交传播强 |
| H5 移动端 | React/Vue + 响应式 | 跨平台、无需审核 |
| 混合开发 | Capacitor、Flutter | 一次开发、多端部署 |
| Web 应用 | Next.js、React、Vue | 丰富的 Web API、灵活部署 |
| SSR/SSG 应用 | Next.js、Nuxt.js | SEO 友好、首屏加载快 |
| PWA 应用 | Web App Manifest | 离线能力、安装体验 |

### 1.3 核心开发场景

小程序开发与传统 Web 开发存在显著差异，主要体现在以下几个方面：

| 维度 | 小程序开发 | 传统 Web 开发 |
|------|------------|---------------|
| 渲染模式 | 双线程架构（渲染层+逻辑层） | 单线程浏览器环境 |
| API 能力 | 平台特有 API、限制较多 | Web API 丰富 |
| 打包体积 | 严格限制（通常 2MB 以内） | 相对宽松 |
| 更新机制 | 审核制、增量更新 | 实时更新 |
| 调试方式 | 模拟器+真机调试 | 浏览器开发者工具 |

现代 Web 开发与传统 Web 开发的差异：

| 维度 | 现代 Web 开发 | 传统 Web 开发 |
|------|---------------|---------------|
| 构建工具 | Vite、Webpack 5 | Grunt、Gulp |
| 框架 | React 18+、Vue 3 | jQuery、传统框架 |
| 数据流 | React Query、Pinia | 手动管理 |
| 部署方式 | Serverless、CDN | 传统服务器 |

---

## 2. 可用 Skills 完整清单

### 2.1 Skills 分类总览

本项目集成了专业 Skills，覆盖从前端开发到后端部署、从产品设计到运维监控的完整开发周期。以下是按照功能域分类的核心 Skills 清单：

#### 2.1.1 前端开发类 Skills（核心 30+）

| Skill 名称 | 用途 | 适用场景 | 优先级 |
|------------|------|----------|--------|
| `visual-engineering` | UI 组件快速构建 | 页面布局、组件开发 | ⭐⭐⭐ |
| `ui-ux-pro-max` | UI/UX 设计智能辅助 | 设计评审、交互优化 | ⭐⭐⭐ |
| `frontend-design` | 前端界面设计 | 高设计质量界面 | ⭐⭐⭐ |
| `frontend-testing` | 前端测试 | Vitest + RTL 测试 | ⭐⭐⭐ |
| `frontend-code-review` | 前端代码审查 | 代码质量检查 | ⭐⭐ |
| `web-design-guidelines` | Web 设计规范检查 | 无障碍性、设计一致性 | ⭐⭐ |
| `next-best-practices` | Next.js 最佳实践 | SSR/SSG 优化 | ⭐⭐⭐ |
| `vercel-react-best-practices` | React 性能优化 | 组件优化、渲染优化 | ⭐⭐⭐ |
| `vercel-composition-patterns` | React 组合模式 | 高级组件架构 | ⭐⭐ |
| `tailwind-design-system` | Tailwind CSS 设计系统 | 组件库、样式规范 | ⭐⭐⭐ |
| `shadcn-ui` | Shadcn UI 组件 | 现代化 UI 组件 | ⭐⭐⭐ |
| `react-components` | React 组件开发 | 组件设计与实现 | ⭐⭐⭐ |
| `react-native-best-practices` | React Native 最佳实践 | 移动端开发 | ⭐⭐ |
| `react-native-expo` | Expo 开发 | RN 快速开发 | ⭐⭐ |

#### 2.1.2 Vue 生态 Skills（核心 10+）

| Skill 名称 | 用途 | 适用场景 | 优先级 |
|------------|------|----------|--------|
| `vue-best-practices` | Vue.js 最佳实践 | Vue 3 开发规范 | ⭐⭐⭐ |
| `vue-pinia-best-practices` | Pinia 状态管理 | 状态管理方案 | ⭐⭐⭐ |
| `vue-router-best-practices` | Vue Router 路由管理 | 路由配置与守卫 | ⭐⭐ |
| `vue-testing-best-practices` | Vue 组件测试 | 单元测试、集成测试 | ⭐⭐ |
| `vue-jsx-best-practices` | Vue JSX 语法 | JSX 语法规范 | ⭐ |
| `vue-options-api-best-practices` | Options API | 传统 Vue 写法 | ⭐ |
| `vue-debug-guides` | Vue 调试指南 | 问题诊断 | ⭐⭐ |
| `pinia` | Pinia 状态管理 | 轻量级状态管理 | ⭐⭐⭐ |
| `nuxt` | Nuxt.js 开发 | SSR/SSG 应用 | ⭐⭐ |
| `vite` | Vite 构建工具 | 现代构建工具 | ⭐⭐⭐ |
| `vitest` | Vitest 测试 | 单元测试框架 | ⭐⭐⭐ |

#### 2.1.3 后端开发类 Skills（核心 20+）

| Skill 名称 | 用途 | 适用场景 | 优先级 |
|------------|------|----------|--------|
| `backend-development` | 后端系统开发 | API 设计、业务逻辑 | ⭐⭐⭐ |
| `nodejs-backend` | Node.js 后端模式 | Express/NestJS 开发 | ⭐⭐⭐ |
| `nestjs-best-practices` | NestJS 最佳实践 | 企业级后端开发 | ⭐⭐⭐ |
| `fastapi-router-py` | FastAPI 路由 | Python API 开发 | ⭐⭐ |
| `database-schema-designer` | 数据库设计 | Schema 建模、索引优化 | ⭐⭐⭐ |
| `supabase-postgres-best-practices` | PostgreSQL 最佳实践 | 数据库查询优化 | ⭐⭐ |
| `redis-best-practices` | Redis 缓存策略 | 缓存设计、数据结构 | ⭐⭐ |
| `prisma-automation` | Prisma ORM | 数据库操作 | ⭐⭐ |
| `zustand-store-ts` | Zustand 状态 | React 状态管理 | ⭐⭐ |
| `react-flow-node-ts` | React Flow 节点 | 流程图组件开发 | ⭐ |

#### 2.1.4 测试质量类 Skills（核心 10+）

| Skill 名称 | 用途 | 适用场景 | 优先级 |
|------------|------|----------|--------|
| `test-master` | 测试策略与实现 | 单元测试、测试框架 | ⭐⭐⭐ |
| `integration-testing` | 集成测试设计 | API 集成、组件交互 | ⭐⭐⭐ |
| `playwright-testing` | Playwright 测试 | 浏览器自动化测试 | ⭐⭐⭐ |
| `qa-testing-playwright` | E2E 测试 | 端到端自动化测试 | ⭐⭐⭐ |
| `qa-testing-strategy` | 测试策略制定 | 风险评估、覆盖率规划 | ⭐⭐ |
| `qa-expert` | QA 流程与规范 | 测试计划、缺陷管理 | ⭐⭐ |
| `api-contract-testing` | API 契约测试 | 服务间契约验证 | ⭐⭐ |
| `test-driven-development` | TDD 实践 | 测试驱动开发 | ⭐⭐ |
| `webapp-testing` | Web 应用测试 | 本地应用验证 | ⭐⭐ |
| `systematic-debugging` | 系统化调试 | 问题诊断、修复 | ⭐⭐ |

#### 2.1.5 产品需求类 Skills（核心 8+）

| Skill 名称 | 用途 | 适用场景 | 优先级 |
|------------|------|----------|--------|
| `product-requirements` | 产品需求分析 | 需求收集、PRD 生成 | ⭐⭐⭐ |
| `intent-interview` | 需求访谈与澄清 | 模糊需求澄清 | ⭐⭐⭐ |
| `project-planning` | 项目规划文档 | 阶段划分、验收标准 | ⭐⭐⭐ |
| `project-workflow` | 项目工作流管理 | 完整生命周期管理 | ⭐⭐ |
| `product-manager` | 产品需求管理 | PRD 编写、优先级排序 | ⭐⭐ |
| `product-management` | 产品运营管理 | 战略规划、指标定义 | ⭐⭐ |
| `requirements-analysis` | 需求问题诊断 | 需求分析与评估 | ⭐⭐ |
| `requirements-clarity` | 需求清晰度评估 | 复杂需求梳理 | ⭐⭐ |
| `docs-ai-prd` | AI 优化文档 | PRD、技术规范 | ⭐⭐ |

#### 2.1.6 部署运维类 Skills（核心 10+）

| Skill 名称 | 用途 | 适用场景 | 优先级 |
|------------|------|----------|--------|
| `ci-cd-best-practices` | CI/CD 最佳实践 | 流水线配置、部署策略 | ⭐⭐⭐ |
| `vercel-automation` | Vercel 部署 | 云部署、环境管理 | ⭐⭐⭐ |
| `docker-hub-automation` | Docker 容器化 | 容器化部署 | ⭐⭐ |
| `git-master` | Git 操作专家 | 提交、合并、版本管理 | ⭐⭐⭐ |
| `kubernetes` | K8s 编排 | 容器编排 | ⭐⭐ |
| `nginx` | Nginx 配置 | 反向代理、负载均衡 | ⭐⭐ |
| `supabase-automation` | Supabase 部署 | 后端即服务 | ⭐⭐ |
| `render-automation` | Render 部署 | 云部署 | ⭐⭐ |

#### 2.1.7 第三方集成 Skills（200+）

**开发与协作**：
- `github-automation` - GitHub 自动化
- `gitlab-automation` - GitLab 自动化
- `slack-automation` - Slack 集成
- `notion-automation` - Notion 集成
- `jira-automation` - Jira 项目管理
- `figma-automation` - Figma 设计协作
- `linear-automation` - Linear 项目管理

**营销与商务**：
- `stripe-automation` - 支付处理
- `shopify-automation` - 电商平台
- `mailchimp-automation` - 邮件营销
- `hubspot-automation` - CRM 营销
- `zendesk-automation` - 客服系统

**社交媒体**：
- `twitter-automation` / `x-automation` - X/Twitter
- `linkedin-automation` - LinkedIn
- `youtube-automation` - YouTube
- `instagram-automation` - Instagram

**数据分析**：
- `google-analytics-automation` - GA 分析
- `mixpanel-automation` - 用户行为分析
- `segment-automation` - 数据管道

#### 2.1.8 辅助工具类 Skills（50+）

| Skill 名称 | 用途 | 适用场景 |
|------------|------|----------|
| `find-skills` | Skills 发现与安装 | 扩展能力边界 |
| `brainstorming` | 头脑风暴 | 创意生成、方案探索 |
| `component-refactoring` | 组件重构 | 复杂组件拆分优化 |
| `copywriting` | 文案撰写 | 产品文案、营销文案 |
| `content-strategy` | 内容策略 | 内容规划 |
| `seo-audit` | SEO 审计 | 搜索引擎优化 |
| `file-organizer` | 文件整理 | 项目结构优化 |

### 2.2 Skills 优先级矩阵

根据小程序/Web开发的实际需求，以下是核心 Skills 的推荐优先级：

#### ⭐⭐⭐ 最高优先级（核心必备）

| Skill | 适用场景 | 使用频率 |
|-------|----------|----------|
| `visual-engineering` | UI 组件快速构建、页面开发 | 每日 |
| `backend-development` | API 设计、业务逻辑实现 | 每日 |
| `vue-best-practices` | Vue.js 项目开发 | Vue 项目 |
| `vercel-react-best-practices` | React/Next.js 项目开发 | React 项目 |
| `next-best-practices` | Next.js 应用开发 | Next.js 项目 |
| `tailwind-design-system` | 样式系统、组件库 | 每日 |
| `shadcn-ui` | 现代化 UI 组件 | 每日 |
| `test-master` | 测试策略与实现 | 每日 |
| `database-schema-designer` | 数据库设计 | 新项目 |
| `product-requirements` | 需求分析与 PRD | 新项目 |
| `project-planning` | 项目规划与里程碑 | 新项目 |

#### ⭐⭐ 高优先级（质量保障）

| Skill | 适用场景 | 使用频率 |
|-------|----------|----------|
| `ui-ux-pro-max` | UI/UX 设计优化 | 每周 |
| `frontend-design` | 高质量界面设计 | 每周 |
| `frontend-testing` | 前端单元测试 | 每日 |
| `integration-testing` | API 集成测试 | 每周 |
| `playwright-testing` | E2E 自动化测试 | 每周 |
| `nestjs-best-practices` | 企业级后端开发 | NestJS 项目 |
| `supabase-postgres-best-practices` | PostgreSQL 优化 | 数据库优化 |
| `redis-best-practices` | 缓存策略设计 | 性能优化 |
| `ci-cd-best-practices` | 持续集成部署 | 项目发布 |
| `git-master` | 版本控制管理 | 每日 |
| `vercel-automation` | 自动化部署 | 项目发布 |

#### ⭐ 中优先级（特定场景）

| Skill | 适用场景 | 使用频率 |
|-------|----------|----------|
| `api-contract-testing` | 前后端契约验证 | API 开发 |
| `web-design-guidelines` | 无障碍性检查 | 项目验收 |
| `intent-interview` | 需求访谈 | 需求阶段 |
| `requirements-analysis` | 需求分析 | 需求阶段 |
| `vue-testing-best-practices` | Vue 组件测试 | Vue 项目 |
| `react-native-best-practices` | 移动端开发 | RN 项目 |
| `fastapi-router-py` | Python API 开发 | Python 后端 |
| `component-refactoring` | 组件重构 | 代码重构 |
| `systematic-debugging` | 系统化调试 | Bug 修复 |
| `seo-audit` | SEO 优化 | 上线前 |

#### 按需使用（第三方集成）

根据项目需要选择对应的第三方服务集成 skills：
- **支付**: `stripe-automation`
- **电商**: `shopify-automation`
- **邮件**: `mailchimp-automation`, `sendgrid-automation`
- **协作**: `slack-automation`, `notion-automation`, `jira-automation`
- **分析**: `google-analytics-automation`, `mixpanel-automation`

---

## 3. 小程序/Web开发场景与 Skills 调度

### 3.1 场景一：新建项目

**触发条件**：从零开始创建全新小程序或Web项目

**推荐 Skills 组合**：

| 顺序 | Skill | 产出 | 说明 |
|------|-------|------|------|
| 1 | `intent-interview` | 需求澄清文档 | 明确产品定位、核心功能、目标用户 |
| 2 | `product-requirements` | 完整 PRD | 详细功能列表、非功能需求 |
| 3 | `project-planning` | 实现阶段计划 | 里程碑、验收标准 |
| 4 | `database-schema-designer` | 数据库设计 | 数据模型、关系设计 |
| 5 | `visual-engineering` | 初始项目结构 | 目录结构、基础组件 |
| 6 | `frontend-design` | 首页/核心页面设计 | 高质量 UI 实现 |

**示例流程（Web项目）**：

```
用户：创建一个 RSS 阅读平台
→ intent-interview: 访谈确定核心功能（RSS订阅、文章阅读、分类管理）
→ product-requirements: 生成 PRD（功能模块、用户流程、非功能需求）
→ project-planning: 划分为 3 个阶段（基础功能、高级功能、优化）
→ database-schema-designer: 设计用户表、订阅表、文章表结构
→ visual-engineering: 创建项目脚手架和基础目录结构
→ frontend-design: 实现首页和核心功能页面
```

**示例流程（小程序项目）**：

```
用户：创建一个社区团购小程序
→ intent-interview: 访谈确定核心功能（商品展示、购物车、订单、支付）
→ product-requirements: 生成 PRD（功能模块、用户流程、非功能需求）
→ project-planning: 划分为 3 个阶段（基础功能、交易闭环、扩展功能）
→ database-schema-designer: 设计商品表、订单表、用户表结构
→ visual-engineering: 创建项目脚手架和基础目录结构
→ frontend-design: 实现首页和商品列表页
```

### 3.2 场景二：页面与组件开发

**触发条件**：开发具体的页面或组件

**推荐 Skills 组合**：

| 顺序 | Skill | 产出 | 说明 |
|------|-------|------|------|
| 1 | `visual-engineering` | 组件代码 | 快速生成组件代码 |
| 2 | `ui-ux-pro-max` | 设计优化建议 | 交互、动画、视觉优化 |
| 3 | `web-design-guidelines` | 无障碍检查 | 确保符合 Web 标准 |
| 4 | `vue-best-practices` | 代码审查 | Vue 最佳实践检查 |

**适用技术栈变体**：

- 微信小程序原生：`visual-engineering` + 微信小程序 API 适配
- Taro (React)：`visual-engineering` + `vercel-react-best-practices`
- Taro (Vue)：`visual-engineering` + `vue-best-practices`
- Uni-app：`visual-engineering` + `vue-best-practices`
- Next.js：`visual-engineering` + `next-best-practices` + `vercel-react-best-practices`
- Vue 3：`visual-engineering` + `vue-best-practices` + `vue-pinia-best-practices`

### 3.3 场景三：业务逻辑与 API 开发

**触发条件**：实现后端 API 或业务逻辑

**推荐 Skills 组合**：

| 顺序 | Skill | 产出 | 说明 |
|------|-------|------|------|
| 1 | `backend-development` | API 实现 | 业务逻辑、接口设计 |
| 2 | `nodejs-backend` | 架构模式 | 中间件、路由、错误处理 |
| 3 | `database-schema-designer` | 数据模型 | 表结构、关系 |
| 4 | `supabase-postgres-best-practices` | 查询优化 | SQL 性能优化 |
| 5 | `redis-best-practices` | 缓存策略 | 热点数据缓存 |
| 6 | `integration-testing` | 集成测试 | API 端到端测试 |

**Python API 开发特定组合**：

| 顺序 | Skill | 产出 | 说明 |
|------|-------|------|------|
| 1 | `fastapi-router-py` | Python API | FastAPI 路由开发 |
| 2 | `pydantic-models-py` | 数据模型 | 请求/响应模型定义 |
| 3 | `integration-testing` | 集成测试 | API 端到端测试 |

### 3.4 场景四：状态管理设计

**触发条件**：设计应用状态管理方案

**推荐 Skills 组合**：

| 顺序 | Skill | 产出 | 说明 |
|------|-------|------|------|
| 1 | `vue-pinia-best-practices` | Store 设计 | 状态模型、actions |
| 2 | `create-adaptable-composable` | 业务逻辑抽象 | 复用逻辑封装 |
| 3 | `vue-best-practices` | 代码审查 | 响应式最佳实践 |

**React 状态管理特定组合**：

| 顺序 | Skill | 产出 | 说明 |
|------|-------|------|------|
| 1 | `zustand-store-ts` | Zustand Store | 状态管理实现 |
| 2 | `vercel-react-best-practices` | React 最佳实践 | 组件优化 |
| 3 | `vercel-composition-patterns` | 组件架构 | 高级组合模式 |

### 3.5 场景五：测试覆盖

**触发条件**：需要为小程序/Web应用编写测试

**推荐 Skills 组合**：

| 测试类型 | Skills 组合 | 说明 |
|----------|-------------|------|
| 单元测试 | `test-master` | 组件、工具函数、Hooks 测试 |
| 组件测试 | `vue-testing-best-practices` | Vue 组件测试 |
| E2E 测试 | `qa-testing-playwright` | 完整用户流程测试 |
| 集成测试 | `integration-testing` | API 集成、数据流 |
| 契约测试 | `api-contract-testing` | 前后端接口契约 |

**小程序特殊考虑**：

由于小程序运行在特殊环境，E2E 测试需要使用 `playwright-testing` 配合小程序开发者工具进行真机或模拟器测试。

**Web 特殊考虑**：

对于现代 Web 应用，需要考虑 SSR、PWA、离线功能等特殊场景的测试。

### 3.6 场景六：Bug 修复与调试

**触发条件**：修复已知问题

**推荐 Skills 组合**：

| Bug 类型 | Skills 组合 | 说明 |
|----------|-------------|------|
| UI 问题 | `visual-engineering` -> `ui-ux-pro-max` | 样式、布局、交互修复 |
| 逻辑错误 | `backend-development` -> `test-master` | 业务逻辑修复 + 测试补充 |
| 性能问题 | `vercel-react-best-practices` -> `systematic-debugging` | 性能分析与优化 |
| 类型错误 | `vue-best-practices` / `next-best-practices` | TypeScript 类型修复 |
| 数据库慢 | `supabase-postgres-best-practices` -> `database-schema-designer` | 查询优化 |
| 缓存失效 | `redis-best-practices` -> `backend-development` | 缓存策略修复 |
| SSR 水合错误 | `next-best-practices` -> `vercel-react-best-practices` | Next.js 水合修复 |

### 3.7 场景七：性能优化

**触发条件**：应用性能优化

**推荐 Skills 组合**：

| 优化类型 | Skills 组合 | 产出 |
|----------|-------------|------|
| 前端性能 | `vercel-react-best-practices` + `frontend-testing` | 渲染优化方案 |
| 构建优化 | `vite` + `turborepo` | 构建速度提升 |
| 数据库优化 | `supabase-postgres-best-practices` + `database-schema-designer` | 查询优化、索引设计 |
| 缓存优化 | `redis-best-practices` + `backend-development` | 缓存策略 |
| 图片优化 | `vercel-react-best-practices` | 图片加载优化 |
| 代码分割 | `next-best-practices` | 懒加载策略 |

### 3.8 场景八：安全加固

**触发条件**：安全审计与加固

**推荐 Skills 组合**：

| 安全领域 | Skills 组合 | 说明 |
|----------|-------------|------|
| 认证授权 | `better-auth-best-practices` + `better-auth-security-best-practices` | 身份验证安全 |
| API 安全 | `backend-development` + `api-contract-testing` | 接口安全规范 |
| 依赖安全 | `ci-cd-best-practices` | 依赖漏洞扫描 |
| 数据安全 | `database-schema-designer` + `supabase-postgres-best-practices` | 数据加密、权限 |

### 3.9 场景九：第三方服务集成

**触发条件**：集成外部 API 或服务

**推荐 Skills 组合**：

| 服务类型 | Skills 组合 | 说明 |
|----------|-------------|------|
| 支付集成 | `stripe-automation` + `backend-development` | 支付流程 |
| 邮件服务 | `sendgrid-automation` / `mailchimp-automation` | 邮件发送 |
| 文件存储 | `supabase-automation` | 文件上传下载 |
| 消息推送 | `slack-automation` / `discord-automation` | 消息通知 |
| 数据分析 | `google-analytics-automation` + `mixpanel-automation` | 埋点分析 |
| CRM 集成 | `hubspot-automation` / `salesforce-automation` | 客户管理 |
| 社交媒体 | `twitter-automation` / `linkedin-automation` | 社交分享 |

### 3.10 场景十：数据迁移与备份

**触发条件**：数据库迁移、数据备份恢复

**推荐 Skills 组合**：

| 任务类型 | Skills 组合 | 说明 |
|----------|-------------|------|
| 数据库迁移 | `database-schema-designer` + `supabase-postgres-best-practices` | Schema 迁移 |
| 数据备份 | `backend-development` + `ci-cd-best-practices` | 自动化备份 |
| 数据同步 | `integration-testing` + `backend-development` | 数据一致性 |
| 数据清洗 | `backend-development` + `database-schema-designer` | 数据质量 |

### 3.11 场景十一：团队协作与文档

**触发条件**：团队协作、文档编写

**推荐 Skills 组合**：

| 任务类型 | Skills 组合 | 说明 |
|----------|-------------|------|
| API 文档 | `api-contract-testing` + `docs-ai-prd` | API 文档生成 |
| 技术文档 | `docs-ai-prd` + `product-requirements` | 技术规范 |
| 代码审查 | `frontend-code-review` + `git-master` | 代码质量 |
| 项目管理 | `project-workflow` + `jira-automation` | 任务跟踪 |
| 知识管理 | `notion-automation` + `docs-ai-prd` | 知识库建设 |

### 3.12 场景十二：发布与部署

**触发条件**：小程序/Web应用上线发布

**推荐 Skills 组合**：

| 顺序 | Skill | 产出 | 说明 |
|------|-------|------|------|
| 1 | `ci-cd-best-practices` | CI/CD 流水线 | GitHub Actions、自动化测试 |
| 2 | `test-master` | 测试报告 | 质量门禁 |
| 3 | `git-master` | 版本管理 | 标签、发布分支 |
| 4 | `vercel-automation` | 部署 | Vercel 云部署 |

---

## 4. 技术栈专项指南

### 4.1 微信小程序原生开发

**项目特点**：

- 双线程架构（渲染层 Webview + 逻辑层 JScore）
- 独立的 WXML、WXSS、JS、JSON 语法
- 丰富的微信 API（支付、登录、分享等）
- 严格的包体积限制（主包 2MB，分包 2MB）

**推荐 Skills 组合**：

| 优先级 | Skill | 用途 |
|--------|-------|------|
| 1 | `visual-engineering` | 页面/组件开发 |
| 2 | `ui-ux-pro-max` | 交互设计优化 |
| 3 | `web-design-guidelines` | 无障碍性检查 |
| 4 | `test-master` + `playwright-testing` | 自动化测试 |
| 5 | `wechat-miniprogram` | 小程序特有 API |

**关键注意事项**：

- 使用分包加载优化体积
- 合理使用 setData（避免频繁全量更新）
- 做好页面路径配置（app.json）
- 注意用户隐私合规（getUserProfile 等接口）

### 4.2 Taro 开发框架

**项目特点**：

- 支持 React/Vue 语法
- 一次开发、多端运行（微信、支付宝、H5、RN）
- 编译时框架，需编译为各端代码
- 完善的 Taro UI 组件库

**推荐 Skills 组合**：

| 优先级 | Skill | 用途 |
|--------|-------|------|
| 1 | `visual-engineering` | 组件开发 |
| 2 | `vercel-react-best-practices` | React 性能优化 |
| 3 | `vue-best-practices`（Vue 模式） | Vue 最佳实践 |
| 4 | `test-master` | 单元测试 |

**关键注意事项**：

- 注意各端 API 差异（条件编译）
- 使用 taro-ui 或 NutUI 保证多端一致性
- 做好 Taro 版本管理（避免升级破坏）
- H5 端注意 SEO 优化

### 4.3 Uni-app 开发框架

**项目特点**：

- 基于 Vue.js
- 跨平台能力强（iOS、Android、H5、各家小程序）
- 使用 uView UI 组件库
- 运行时框架（与 Taro 编译时不同）

**推荐 Skills 组合**：

| 优先级 | Skill | 用途 |
|--------|-------|------|
| 1 | `visual-engineering` | 组件开发 |
| 2 | `vue-best-practices` | Vue 开发规范 |
| 3 | `vue-pinia-best-practices` | 状态管理 |
| 4 | `frontend-design` | 高质量 UI |

**关键注意事项**：

- Vue2/Vue3 版本选择（推荐 Vue3 + Script Setup）
- 条件编译处理平台差异
- 使用 uni-ui 组件库保证兼容性
- H5 端配置 manifest.json

### 4.4 H5 移动端开发

**项目特点**：

- 纯 Web 技术栈
- 无包体积限制
- 可直接上线、无审核
- 可通过 WebView 嵌入 App

**推荐 Skills 组合**：

| 优先级 | Skill | 用途 |
|--------|-------|------|
| 1 | `visual-engineering` | 响应式布局 |
| 2 | `frontend-design` | 移动端设计 |
| 3 | `vercel-react-best-practices` | React 优化 |
| 4 | `vue-best-practices` | Vue 开发 |
| 5 | `test-master` | 测试覆盖 |

**关键注意事项**：

- 移动端 viewport 配置
- 300ms 点击延迟处理
- 安全区域适配（刘海屏等）
- 离线缓存（PWA/Service Worker）

### 4.5 Next.js Web 开发

**项目特点**：

- React 框架，支持 SSR/SSG
- 文件系统路由
- 内置优化（代码分割、图片优化等）
- 支持 API Routes

**推荐 Skills 组合**：

| 优先级 | Skill | 用途 |
|--------|-------|------|
| 1 | `visual-engineering` | 页面/组件开发 |
| 2 | `next-best-practices` | Next.js 最佳实践 |
| 3 | `vercel-react-best-practices` | React 优化 |
| 4 | `tailwind-design-system` | 样式系统 |

**关键注意事项**：

- 合理使用 RSC 边界
- 优化数据获取策略
- 注意水合问题
- 利用内置优化功能

### 4.6 Vue 3 Web 开发

**项目特点**：

- Composition API
- 响应式系统改进
- 更好的 TypeScript 支持
- 模块化设计

**推荐 Skills 组合**：

| 优先级 | Skill | 用途 |
|--------|-------|------|
| 1 | `visual-engineering` | 组件开发 |
| 2 | `vue-best-practices` | Vue 3 最佳实践 |
| 3 | `vue-pinia-best-practices` | 状态管理 |
| 4 | `vue-router-best-practices` | 路由管理 |

**关键注意事项**：

- 优先使用 Composition API
- 合理使用响应式 API
- 注意性能优化
- 确保 TypeScript 类型安全

---

## 5. Skills 组合速查表

### 5.1 日常开发场景速查

| 场景 | 推荐 Skills（按顺序） |
|------|----------------------|
| 新建项目 | `intent-interview` -> `product-requirements` -> `project-planning` -> `database-schema-designer` -> `visual-engineering` |
| 开发页面 | `visual-engineering` -> `ui-ux-pro-max` -> `web-design-guidelines` |
| 开发组件 | `visual-engineering` -> `vue-best-practices` -> `create-adaptable-composable` |
| API 开发 | `backend-development` -> `nodejs-backend` -> `supabase-postgres-best-practices` |
| 写测试 | `test-master` -> `integration-testing` -> `qa-testing-playwright` |
| Bug 修复 | `backend-development`（分析）-> `test-master`（验证）-> `visual-engineering`（修复）|
| 发布上线 | `ci-cd-best-practices` -> `git-master` -> `test-master` |

### 5.2 问题排查速查

| 问题类型 | 首选 Skill | 备选 Skill |
|----------|-------------|------------|
| 页面不渲染 | `visual-engineering` | `vue-best-practices` |
| 接口调不通 | `backend-development` | `integration-testing` |
| 性能卡顿 | `vercel-react-best-practices` | `test-master` |
| 类型报错 | `vue-best-practices` | `frontend-design` |
| 样式错乱 | `ui-ux-pro-max` | `web-design-guidelines` |
| 数据库慢 | `supabase-postgres-best-practices` | `database-schema-designer` |
| 缓存失效 | `redis-best-practices` | `backend-development` |

### 5.3 Web 开发特定场景

| 场景 | 推荐 Skills（按顺序） |
|------|----------------------|
| SSR 水合修复 | `next-best-practices` -> `vercel-react-best-practices` |
| PWA 实现 | `visual-engineering` -> `web-design-guidelines` -> `test-master` |
| API 设计 | `backend-development` -> `api-contract-testing` |
| 组件库开发 | `visual-engineering` -> `tailwind-design-system` -> `frontend-testing` |
| 性能优化 | `vercel-react-best-practices` -> `test-master` -> `qa-testing-strategy` |

---

## 6. 最佳实践与原则

### 6.1 Skills 调用基本原则

**原则一：场景优先**

- 先识别开发场景，再选择对应的 Skills 组合
- 避免不加选择地调用所有 Skills

**原则二：渐进增强**

- 先使用核心 Skills 完成基础功能
- 再使用增强 Skills 优化质量和体验

**原则三：验证闭环**

- 每个 Skills 产出都应该被后续 Skills 验证
- 形成开发 -> 审查 -> 测试 -> 修复的闭环

**原则四：适度组合**

- 简单任务使用单一 Skill 即可解决
- 复杂任务才需要多 Skills 组合

### 6.2 常见错误避免

| 错误类型 | 说明 | 正确做法 |
|----------|------|----------|
| 过度设计 | 为简单页面调用过多 Skills | 按需选择，简洁优先 |
| 顺序错乱 | 未按照推荐顺序调用 | 参考场景指南的顺序 |
| 验证缺失 | 缺少后续验证环节 | 每个产出都需要验证 |
| 技能重叠 | 调用功能重复的 Skills | 选择最适合的 Skills |

### 6.3 效率提升技巧

**技巧一：预定义模板**

对于常见场景，可以预设 Skills 组合模板，减少每次选择的时间。

**技巧二：并行调用**

独立的 Skills 可以并行调用，提高效率。例如：

```typescript
// 并行执行独立的审查任务
task(category="visual-engineering", ...)  // 页面开发
task(category="backend-development", ...)  // API 开发
```

**技巧三：会话续接**

使用 session_id 保持上下文，避免重复说明背景：

```typescript
// 正确：使用 session_id 续接会话
task(session_id="ses_abc123", prompt="继续修复类型错误...")

// 错误：新建会话丢失上下文
task(prompt="修复类型错误...")
```

**技巧四：Web 与小程序开发的差异化策略**

- 小程序开发：更关注体积优化、平台 API 适配
- Web 开发：更关注性能优化、SEO、PWA 功能

---

## 7. 附录

### 7.1 Skills 完整列表（按字母排序）

```
backend-development
brainstorming
ci-cd-best-practices
create-adaptable-composable
database-schema-designer
dev-browser
docs-ai-prd
executing-plans
fastapi-router-py
find-skills
frontend-design
frontend-testing
frontend-ui-ux
git-master
integration-testing
intent-interview
next-best-practices
nodejs-backend
orpc-contract-first
playwright
playwright-testing
product-management
product-manager
product-requirements
project-planning
project-workflow
pydantic-models-py
qa-expert
qa-testing-playwright
qa-testing-strategy
react-flow-node-ts
redis-best-practices
requirements-analysis
requirements-clarity
supabase-postgres-best-practices
systematic-debugging
tailwind-design-system
test-driven-development
test-master
ui-ux-pro-max
vercel-composition-patterns
vercel-react-best-practices
visual-engineering
vue-best-practices
vue-development-guides
vue-jsx-best-practices
vue-options-api-best-practices
vue-pinia-best-practices
vue-router-best-practices
web-design-guidelines
webapp-testing
writing-plans
zustand-store-ts
```

### 7.2 Skills 依赖关系图

```
                    需求层 Skills
                    intent-interview
                    product-requirements
                    requirements-analysis
                             |
                    规划层 Skills
                    project-planning
                    database-schema-designer
                             |
        +--------------------+--------------------+
        |                    |                    |
 前端 Skills            后端 Skills            测试 Skills
visual-engineering   backend-development    test-master
ui-ux-pro-max        nodejs-backend         integration-testing
frontend-design     redis-best-practices   qa-testing-playwright
vue-best-practices  supabase-postgres...   qa-expert
        |                    |                    |
        +--------------------+--------------------+
                             |
                    运维层 Skills
                    ci-cd-best-practices
                    git-master
```

### 7.3 文档版本

| 版本 | 更新日期 | 说明 |
|------|----------|------|
| v1.0 | 2026-02-14 | 初始版本，针对小程序开发场景 |
| v2.0 | 2026-02-15 | 扩展支持 Web 开发场景 |
| v3.0 | 2026-02-15 | 基于 Skills 全面更新，新增 12 个开发场景，完善优先级矩阵 |
| v4.0 | 2026-03-02 | 移除所有 Azure 相关 Skills，精简文档 |

---

**文档版本**: v4.0
**更新日期**: 2026-03-02
**适用项目**: 小程序开发项目（微信、支付宝、抖音、H5 等）和 Web 开发项目（Next.js、Vue、React 等）
**核心更新**: 
- 移除所有 Azure 相关 Skills
- 精简文档结构
- 保留核心开发 Skills
