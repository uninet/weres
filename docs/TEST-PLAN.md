# WeRSS 测试计划与测试用例

> 目标：证明本项目在本机 Docker 环境内可以完整跑通，覆盖订阅管理、阅读器交互、快捷键、全文抓取、数据导入导出、鉴权与安全。
>
> 全部用例都在 `docker compose up -d` 起的真实容器里执行，不接受「代码读起来是对的」作为通过标准。

## 1. 测试范围

| 编号 | 范围 | 说明 |
|------|------|------|
| A | 订阅管理 | 订阅、取消订阅、重复订阅、无效源、订阅后出现在左栏、分组增删改与越权 |
| B | 阅读器交互 | 三栏布局、文章切换、已读/未读、收藏（含图标状态与 toast）、滚动即已读 |
| C | 键盘快捷键 | m/n/j/k/o/s/v/t/f/r/,/?/Esc 全量键位 |
| D | 内容质量 | 全文抓取、缩略图、摘要无 HTML 标签、正文无面包屑 |
| E | 排序与筛选 | 最新/最旧排序、未读筛选、收藏筛选、搜索 |
| F | 数据导入导出 | OPML 导出、OPML 导入 |
| G | 阅读主题 | 浅色/米黄/电子墨水/深色四档 |
| H | 文本转语音 | 支持检测、播放/停止 |
| I | 鉴权与安全 | 未登录 401、越权隔离、XSS 净化、密钥校验、SSRF 拦截、匿名注入、限流不可绕过 |
| J | 运维 | 健康检查、重启幂等、容器非 root |
| K | Kindle 推送 | 状态接口、未配 SMTP 的降级提示、真实投递、越权 404、投递记录 |
| T | 文章标签 | 创建/幂等、打标签、读回、计数、越权 404、移除、删除标签并自我清理 |
| M | 密码重置 | 未配 SMTP 的 503、不泄漏账号存在性、无效/过期 token、弱密码、完整链路、一次性 |
| N | 用户偏好设置 | 紧凑视图、未读角标、自动标记已读、持久化、自动同步 |
| O | 通知生成与偏好 | 通知开关落库、同步后自动生成通知、摘要接口鉴权 |

## 2. 环境准备

```bash
cd /Users/yelon/Documents/Projects/00-Active/web/werss3

# 1) 必须有 JWT_SECRET 且长度 ≥32
grep -q '^JWT_SECRET=.\{32,\}' .env || echo "JWT_SECRET=$(openssl rand -base64 32)" >> .env

# 2) 构建并启动
docker compose up -d --build

# 3) 等待健康
until curl -sf http://127.0.0.1:3000/api/health >/dev/null; do sleep 2; done

# 4) 登录拿 cookie（后续所有需要身份的用例都用它）
curl -s -c /tmp/werss-cookie.txt -X POST http://127.0.0.1:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"123456"}'
```

演示账号来自 `npm run db:seed`，容器首次启动会自动执行。若数据库非空则跳过 seed，此时用自己注册的账号。

## 3. 用例

### A. 订阅管理

| ID | 用例 | 步骤 | 期望 |
|----|------|------|------|
| A-01 | 从市场页订阅 | 打开 `/market`，点任意未订阅卡片的「订阅」 | 顶部出现「订阅成功」toast；按钮变「已订阅」；`POST /api/feeds/subscriptions` 返回 200 |
| A-02 | 订阅后出现在左栏 | 订阅后进入 `/reader` | 左侧栏出现该源，且位于某个分组下（不能隐身） |
| A-03 | 取消订阅 | 在 `/subscriptions` 点对应源的取消订阅 | 出现「取消订阅成功」；列表移除；左栏同步消失 |
| A-04 | 重复订阅 | 对已订阅的源再调一次 `POST /api/feeds/subscriptions` | 返回 200 且 `message` 含「已经订阅过」；不产生重复记录、不报 500 |
| A-05 | 无效源 | 自定义 tab 输入 `https://example.com/not-a-feed` | 明确报错「无效的 RSS 链接」或「订阅失败：…」，不能静默 |
| A-06 | UA 内容协商的源 | 订阅 `https://www.gcores.com/rss` | 订阅成功（该站对浏览器 UA 返回 HTML，必须走朴素 UA 重试） |

### B. 阅读器交互

| ID | 用例 | 步骤 | 期望 |
|----|------|------|------|
| B-01 | 三栏布局 | 打开 `/reader` | 左栏源列表、中栏文章列表、右栏正文同时可见 |
| B-02 | 切文章 | 点击中栏任意一条 | 右栏切换为该文章，标题一致 |
| B-03 | 自动已读 | 点击未读文章 | 该文章未读蓝点消失，变已读状态 |
| B-04 | 收藏 | 点右栏「收藏文章」 | toast「已收藏」；再次点击「已取消收藏」 |
| B-05 | 滚动即已读 | 打开一篇长文，把正文滚到底 | 中栏该条从「未读」变「已读」 |

### C. 键盘快捷键

| ID | 按键 | 期望 |
|----|------|------|
| C-01 | `n` | 切到下一篇 |
| C-02 | `m` | 切回上一篇 |
| C-03 | `j` / `k` | 与 n / m 等效（Vim 习惯） |
| C-04 | `Space` | **正文向下翻一屏**（不切文章） |
| C-05 | `Shift + Space` | 正文向上翻一屏 |
| C-06 | `o` | 新标签打开原文 |
| C-07 | `s` | 收藏/取消收藏，有 toast |
| C-08 | `v` | 已读 ↔ 未读切换 |
| C-09 | `t` | 外观在四档间切换 |
| C-10 | `f` | 进入沉浸模式（左右两栏隐藏） |
| C-11 | `,` | 打开「更多」面板 |
| C-12 | `?` | 弹出快捷键帮助面板 |
| C-13 | `Esc` | 退出沉浸 / 关闭面板 |
| C-14 | 在搜索框内按 `m` | **不**切换文章（只输入 m） |
| C-15 | `Cmd/Ctrl + R` | 交给浏览器，不拦截 |

> **空格为什么是翻页而不是下一篇**：网页阅读器的第一直觉是「空格 = 往下翻一屏」，
> 大量阅读类产品（Kindle、Reeder、浏览器本身）都这样。切文章用 `n` / `m`，
> 是明确的方向键语义；把空格占作切文章会让人读到一半想往下看时被强行换文。

### S. 正文排版（RSS 原文的干扰）

收录的源大多来自公众号与资讯站，它们的正文 HTML 里带着自己那套「居中窄栏」
排版（`max-width: 680px`、`margin: 0 auto`、重复的标题与页头）。不处理的话
阅读器等于在别人的页面上套自己的壳，出现两类可见问题：

| 编号 | 场景 | 预期 | 判定方式 |
| --- | --- | --- | --- |
| S-01 | 正文行宽 | 桌面 1600px 窗口下正文段落宽度 > 680px | 实测段落 `getBoundingClientRect().width` |
| S-02 | 标题不重复 | 顶部标题只出现一次，正文开头不再重复一遍 | 比对 `article h1` 与正文首块文本 |
| S-03 | 分节标题不被误删 | 正文中间的 `<h2>`/`<div>` 标题保留 | 断言正文含中间小标题文本 |
| S-04 | 列表接口不返回全文 | `/api/articles` 响应体积 < 100KB（原为 2–3MB） | 统计响应字节数 |
| S-05 | 详情接口返回净化后的全文 | 有正文、长度 > 1000 | `/api/articles/:id` 的 `data.content` |

> **S-02 的实现注意**：不能只扫顶层元素。实测某源把标题埋在
> 「居中容器 > 页头 > 标题行」三层里，只认顶层会漏；也不能无脑扫全文，
> 否则正文中间的分节标题会被当成「重复标题」删掉。当前策略是按文档顺序
> 遍历，遇到「不含块级子元素、且文本等于标题」的元素就删掉并立刻停止，
> 中途累计到 200 字以上则判定「已进入正文」不再寻找。

### W. 全文抓取（存量补齐）

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| D-01 | 抽样取各源文章调用详情接口 | 最长正文 > 3000 字符 |
| D-06 | 补抓存量短文 | 补抓后正文不短于补抓前 |

> **D-06 的由来**：`syncFeed` 里原来是 `if (existingArticle) continue;`——
> 文章一旦入库就再也不会被重新抓取。第一次同步时落地页没抓到，那篇就
> 永远停在摘要状态。实测少数派同一批文章里，老文章 34736 字 60 图、
> 新文章 203 字 0 图，差别只在入库时机。现在已存在的文章若正文短于
> 800 字，会补抓一次并更新。补抓有 20 秒时间预算，避免一个永久超时的源
> 拖垮整次同步。

### V. 服务端健壮性

这一组全是回归测试：下面每一条都对应一个真实修掉过的缺陷，不是假想的边界。

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| V-01 | 8 个写接口 × {空 body, 空字符串, 坏 JSON} | 全部 4xx，不能是 500 |
| V-02 | `?limit=999999` / `?pageSize=999999` | 夹到 100 |
| V-03 | `?limit=0` | 夹到 1，不返回空页 |
| V-04 | `/api/favorites?search=React` | 200（SQLite 不支持 `mode: "insensitive"`，曾经整条 500） |
| V-05 | 市场页订阅数 | 与实际 `subscriptions` 行数一致 |

> **V 组的由来**：`POST /api/groups` 不带 body 一直返回 500「创建失败」——
> `await req.json()` 在空 body 时抛 SyntaxError，落进路由的 catch 就变成 500，
> 但这是调用方少传参数，属于 400。同样的写法散落在 8 个接口里，统一改用
> `lib/request.ts` 的 `readJsonBody()`，返回判别式联合强迫调用方处理失败分支。
> V-05 则是因为 `MarketFeed.subscriberCount` 靠 increment/decrement 维护，
> 但只有 `/api/subscriptions` 一条路径在维护它，UI 实际走的
> `/api/feeds/subscriptions` 从不碰——实测同一时刻「少数派」显示 0、实际有 1 个订阅。
> 改成在 `/api/market` 里一次 `groupBy` 实时统计。

### U. 导航入口（顶栏取消）

原来阅读器顶部有 `h-14` 的横栏：logo / 全部·稍后阅读·未读 / 主题 / 设置 / 个人中心，
和内容上下排列，等于整块屏幕顶部被切掉 56px。这些入口都不是阅读时要一直看着的，
所以整条取消，收进左侧栏底部的一个按钮，展开是纵向菜单。

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| U-01 | 顶部不再有横栏 | 正文距窗口顶部 0（`article` top ≤ 4px） |
| U-02 | 左下角入口可见 | `button[title="导航与设置"]` 宽 > 4px |
| U-03 | 菜单含筛选项 | 全部 / 稍后阅读 / 未读 |
| U-04 | 菜单含外观子菜单 | 展开后有浅色 / 米黄 / 电子墨水 / 深色 |
| U-05 | 菜单含侧栏折叠 | 「收起侧栏」→ 侧栏宽度 256 → 64，按钮缩成图标 |
| U-06 | 菜单含设置与个人中心 | 两项都是链接 |
| U-07 | 入口不遮挡源列表 | 入口与列表滚动区的重叠高度 ≤ 4px |

> **U 组的实现注意**：入口放在侧栏这一列的 flex 尾部（不是整页绝对定位），
> 因为绝对定位会压住最后几条源——实测过，`雷峰网`、`爱范儿` 两条被盖住。
> 侧栏收起时按钮要缩成 40px 图标，否则 240px 宽会横向溢出到列表栏上。

### T. 悬浮工具栏（正文占满视口）

原来阅读器顶部有一条 `h-12` 的实体工具栏（折叠 / 上篇下篇 / `3 / 50` 计数 /
收藏 / 沉浸 / 更多）。它和正文是上下排列的，等于正文顶部白扣掉 48px；
`3 / 50` 又和翻页按钮挤在同一行，为了显示两个数字占掉一整条横带。

现在工具栏改成绝对定位的悬浮层，正文从画面最上沿开始；计数胶囊移到右下角。

| 编号 | 场景 | 预期 |
| --- | --- | --- |
| T-01 | 正文顶部不被工具栏占据 | `article h1` 距窗口顶部 < 200px |
| T-02 | 工具栏在顶部可见 | 滚动位置 0 时工具栏 `opacity: 1` |
| T-03 | 滚动后工具栏淡出 | `scrollTop > 24` 时 `opacity: 0` |
| T-04 | 进度胶囊不占行内位置 | 胶囊为绝对定位，不参与工具栏布局 |
| T-05 | 回到顶部工具栏重现 | `scrollTop` 归零后 `opacity: 1` |

> **T 组的实现注意**：工具栏淡出靠监听 `[data-radix-scroll-area-viewport]` 的
> `scroll` 事件，不是 `window`——正文滚动发生在 Radix 内部的容器里。
> 触屏没有 hover，所以判定条件是「`scrollTop < 24` 就显示」，
> 不能依赖鼠标位置。

### R. 响应式布局

桌面三栏并排在 390px 手机上会把正文压到几乎为零，所以小屏改成三级页面
（侧栏 → 列表 → 正文），每屏只显示一栏。

| ID | 用例 | 步骤 | 期望 |
|----|------|------|------|
| R-01 | 桌面正文宽度 | 1600×1000 打开阅读器 | `article` 宽度 > 800px |
| R-02 | 桌面无横向溢出 | 同上 | `body.scrollWidth ≤ innerWidth + 2` |
| R-03 | 桌面三栏齐全 | 同上 | 侧栏、列表、正文同时可见 |
| R-04 | 桌面折叠按钮 | 同上 | 有「折叠列表」按钮 |
| R-05 | 移动端无横向溢出 | 390×844 打开阅读器 | `body.scrollWidth ≤ innerWidth + 2` |
| R-06 | 移动端首屏只显示侧栏 | 同上 | 列表项不可见（宽度/高度为 0） |
| R-07 | 移动端隐藏折叠按钮 | 同上 | 不出现桌面语义的「折叠/展开列表」按钮 |
| R-08 | 移动端点源进入列表 | 点一个源 | 列表可见、正文不出现（**不自动选中第一篇**） |
| R-09 | 移动端点文章进入正文 | 点列表第一项 | `article` 存在且占满整宽 |
| R-10 | 移动端返回列表 | 点工具栏返回 | 正文消失、列表可见 |

> 自动选中这条最容易漏：桌面要靠自动选中填满右栏，小屏却会让人点完源
> 瞬间跳进正文、以为没反应。代码里用 `matchMedia("(max-width: 767px)")`
> 在小屏跳过自动选中。

### D. 内容质量

| ID | 用例 | 步骤 | 期望 |
|----|------|------|------|
| D-01 | 全文抓取 | 订阅少数派，同步后看正文长度 | 正文 > 10000 字符（RSS 只给摘要，需回源抓全文） |
| D-02 | 缩略图 | 查看中栏列表 | 有图源的条目显示缩略图；加载失败时退化为纯文字，不显示灰块 |
| D-03 | 摘要无 HTML | 订阅 IT之家后看列表摘要 | 摘要为纯文本，不出现 `<p data-vmark=...>` |
| D-04 | 正文无面包屑 | 打开 IT之家文章 | 正文不含「首页 > IT资讯 > 业界」这类导航 |
| D-05 | 无乱码 | 检查正文 | 不含 U+FFFD（`�`）替换字符 |

### E. 排序与筛选

| ID | 用例 | 步骤 | 期望 |
|----|------|------|------|
| E-01 | 最新在前 | 默认打开 `/reader` | 第一条是最新发布 |
| E-02 | 从旧到新 | 点中栏排序按钮 | 顺序反转，第一条变成最早的 |
| E-03 | 未读筛选 | 顶部切到「未读」 | 只显示未读文章 |
| E-04 | 收藏筛选 | 切到「稍后阅读」 | 只显示已收藏 |
| E-05 | 搜索 | 搜索框输入关键词 | 只显示标题/摘要命中该词的文章 |
| E-06 | 分页上界 | `GET /api/articles?pageSize=999999` | `pageSize` 被夹到 100，不返回全表 |

### F. 数据导入导出

| ID | 用例 | 步骤 | 期望 |
|----|------|------|------|
| F-01 | 导出 OPML | 设置页点「导出」 | 下载 `.opml` 文件，内容是合法 OPML 2.0，含全部订阅 |
| F-02 | 导入 OPML | 设置页点「导入」，选一个 OPML | toast 显示成功条数；订阅出现在左栏「导入」分组 |

### G. 阅读主题

| ID | 用例 | 期望 |
|----|------|------|
| G-01 | 四档可切 | 浅色 / 米黄 / 电子墨水 / 深色 均可选中且立即生效 |
| G-02 | 持久化 | 刷新页面后主题保持 |
| G-03 | 电子墨水 | 选中后正文为低对比度米灰底，无阴影 |

### H. 文本转语音

| ID | 用例 | 期望 |
|----|------|------|
| H-01 | 支持检测 | 工具栏出现朗读按钮（浏览器支持 speechSynthesis 时） |
| H-02 | 播放/停止 | 点击开始朗读，再点停止 |

### I. 鉴权与安全

| ID | 用例 | 步骤 | 期望 |
|----|------|------|------|
| I-01 | 未登录读订阅 | 不带 Cookie `GET /api/subscriptions` | **401** |
| I-02 | 未登录读文章 | 不带 Cookie `GET /api/articles/<任意id>` | **401** |
| I-03 | 越权隔离 | 用户 A 用自己的 Cookie 读用户 B 的文章 id | 404 |
| I-04 | XSS 净化 | 源正文含 `<img onerror=...><script>` | 返回内容中 `onerror` 与 `<script>` 均被移除 |
| I-05 | 伪造 token | 用 `your-secret-key` 签的 JWT 请求 `/api/auth/me` | 401 |
| I-06 | 弱密钥拒绝启动 | `JWT_SECRET=your-jwt-secret-key-change-in-production` 启动 | 服务端抛 `AuthConfigError`，不签发票据 |
| I-07 | SSRF 环回 | `POST /api/feeds/validate` body `{"url":"http://127.0.0.1:3000/api/health"}` | **400**「不允许访问内网地址」 |
| I-08 | SSRF 云元数据 | 同上，url 换成 `http://169.254.169.254/latest/meta-data/` | **400**（且必须在 1 秒内返回，不能真的发起连接） |
| I-09 | SSRF 私有网段 | 同上，url 换成 `http://10.0.0.1/` | **400** |
| I-10 | SSRF 非 http 协议 | 同上，url 换成 `file:///etc/passwd` | **400**「只支持 http / https 协议」 |
| I-11 | SSRF 域名解析到内网 | 同上，url 换成 `http://127.0.0.1.nip.io:3000/` | **400**（证明不是只拦 IP 字面量） |
| I-12 | 通知不可匿名写入 | 不带 Cookie `POST /api/notifications` | **405**（该接口不接受外部创建） |
| I-13 | 限流不可被伪造 IP 绕过 | 连续 `POST /api/feeds/validate`，每次换一个 `X-Forwarded-For` | 在 120 次内出现 **429**（证明有全局上限兜底；只按 IP 限流时永远不会 429） |

### J. 运维

| ID | 用例 | 期望 |
|----|------|------|
| J-01 | 健康检查 | `GET /api/health` 返回 200 `{"status":"ok","database":"ok"}` |
| J-02 | 重启幂等 | `docker compose restart` 后数据不丢、不重复 seed |
| J-03 | 非 root | `docker compose exec werss id` 显示 uid=1001 |
| J-04 | 数据库可连 | 健康检查里 `database:"ok"`，库文件在 `/data/werss.db` |

### O. 通知生成与偏好设置

| 用例 | 说明 | 期望 |
|------|------|------|
| O-01 | `/api/profile` 返回 `notifyNewArticles` / `emailDigest` | 两个字段都是布尔值 |
| O-02 | 关闭新文章通知 | `notifyNewArticles=false` 落库 |
| O-03 | 重新打开 | `notifyNewArticles=true` 落库 |
| O-04 | 通知列表可读 | 200，`notifications` 是数组 |
| O-05 | 同步后产生订阅更新通知 | 有新增时出现 `FEED_UPDATE` 通知 |
| O-06 | 摘要任务默认拒绝 | 未配 `CRON_SECRET` 时 503 |

这两个开关必须存服务端而不是 localStorage：读它们的是服务端的同步任务
（生成通知）和定时任务（发摘要），浏览器存储它们读不到。

### M. 密码重置

| ID | 用例 | 步骤 | 期望 |
|----|------|------|------|
| M-01 | 未配 SMTP | 服务端无 SMTP 配置时 `POST /api/auth/forgot-password` | **503**，文案指明缺 SMTP，不假装已发送 |
| M-02 | 不泄漏账号存在性 | 用未注册邮箱请求重置 | 与已注册邮箱返回**完全相同**的 200 响应 |
| M-03 | 无效 token | `POST /api/auth/reset-password` 带随机 token | 400「重置链接无效或已过期」 |
| M-04 | 弱密码 | 新密码 `123` | 400，指出至少 8 位 |
| M-05 | 完整链路 | 配 SMTP → 申请 → 收信取链接 → 重置 | 200；旧密码登录 401，新密码登录 200 |
| M-06 | token 一次性 | 同一 token 第二次重置 | 400，不能重放 |
| M-07 | 缺 token 页面 | 直接访问 `/reset-password` 不带 `?token=` | 提示链接不完整，不渲染密码表单 |

### N. 用户偏好设置

这些开关早前只存在于设置页的局部 state 里，**没有任何代码读取**，拨了等于没拨。以下用例断言的是「拨动之后行为真的变了」。

| ID | 用例 | 步骤 | 期望 |
|----|------|------|------|
| N-01 | 紧凑视图 | 开启后刷新阅读器 | 列表摘要段落数归零，标题仍在 |
| N-02 | 未读角标 | 关闭 `showUnreadBadge` 后刷新 | 导航栏未读角标不再渲染 |
| N-03 | 自动标记已读 | 关闭 `autoMarkRead` 后点开文章 | 未读圆点数量不变 |
| N-04 | 设置持久化 | 拨动开关后刷新页面 | 设置值保持（存 localStorage） |
| N-05 | 自动同步 | 开启 `autoSync` 并设间隔 | 进入阅读器后按间隔触发同步 |

### X. 账号自助（改密码 / 注销）

个人中心原本有四个按钮全是占位 toast（「密码修改功能开发中」等），
后端根本没有对应接口。这两条接口是本轮补的，所以要有独立用例守住。

| ID | 用例 | 步骤 | 期望 |
|----|------|------|------|
| X-01 | 注册临时账号 | `POST /api/auth/register` 用 `selfservice<时间戳>@example.com` | 200 |
| X-02 | 临时账号登录 | 用该账号登录 | 200 |
| X-03 | 旧密码错误被拒 | `POST /api/profile/password` 带错 currentPassword | 400「当前密码不正确」 |
| X-04 | 新密码不符合策略 | 新密码 `abcdefgh`（无数字） | 400「密码需包含字母/数字」 |
| X-05 | 合法请求可改密码 | 旧密码正确 + `Str0ngPass2026` | 200 |
| X-06 | 新密码可登录 | 用新密码登录 | 200 |
| X-07 | 旧密码失效 | 用旧密码登录 | 401 |
| X-08 | 注销缺少 confirm | `POST /api/profile/delete` 不传 confirm | 400「请确认注销操作」 |
| X-09 | 注销密码错误 | 传 `confirm: "DELETE"` 但密码错 | 400「密码不正确」 |
| X-10 | 注销前重新登录 | 恢复会话 | 200 |
| X-11 | 校验通过可以注销 | 正确 confirm + 密码 | 200 |
| X-12 | 注销后无法登录 | 用原密码登录 | 401 |

> **必须用临时账号**：注销不可逆，`prisma.user.delete()` 靠 schema 的
> `onDelete: Cascade` 清掉订阅/收藏/历史。用演示账号测会把 seed 数据删光，
> 后续所有用例连带失败。脚本里 `selfservice${Date.now()}@example.com`
> 就是这个原因。

> **演示账号不可注销**：`GUEST_USER_ID` 那条闸在服务端拦着，返回 403
> 「演示账号不支持注销」——别人 clone 下来跑测试不该把自己的演示环境删掉。

### Y. 列表摘要不含 HTML 源码

历史页曾经显示成这样：

```
…想让客厅的 HomePod、书房的 ...<a href="https://sspai.com/post/118921" target="_blank">查看全文</a>
```

根因是三处都没净化：订阅导入时 `description: item.description || ''` 原样落库，
`/api/history` 和 `/api/favorites` 又把 `article.description` 原样返回。
（`/api/articles` 早就做了 `sanitizePlainText`，所以只有这两个页面露馅。）

| ID | 用例 | 步骤 | 期望 |
|----|------|------|------|
| Y-1 | 历史摘要 | `GET /api/history?limit=50` | 每条 `article.description` 不含 `/<[a-z][^>]*>/i` |
| Y-2 | 收藏摘要 | `GET /api/favorites?limit=50` | 同上 |
| Y-3 | 文章列表摘要 | `GET /api/articles?limit=50` | 同上 |

写入口（`app/api/feeds/subscriptions/route.ts`）也补了 `sanitizePlainText`，
但**出口必须再净化一次**：数据库里已经存在改造前入库的脏数据，
只修写入口不会让存量数据变干净。

### Z. 页面导航与外壳一致性

改造前 7 个次级页面各画各的顶栏（三种高度、两套导航语言），
而阅读器已经取消顶栏改悬浮工具栏，风格割裂。现在统一走 `PageShell`。

| ID | 用例 | 期望 |
|----|------|------|
| Z-01 | 所有次级页面顶栏高度一致 | 均为 56px（`h-14`） |
| Z-02 | 次级页面都有返回入口 | 除「我的」外均有返回箭头（「我的」是主入口，不该有返回） |
| Z-03 | 移动端底部导航常驻 | 任意页面都显示 5 项主导航，不再只在 4 个 href 上显示 |
| Z-04 | 收藏/历史点标题进站内阅读器 | 地址变为 `/reader?articleId=<id>`，不跳出站点 |
| Z-05 | 收藏/历史「打开原文」跳外链 | 新标签页打开原始链接，带 `noopener,noreferrer` |
| Z-06 | 通知点击进目标文章 | `/reader?articleId=<id>`（此前误写成 `?article=`，入口从未生效） |
| Z-07 | 无第三方图标请求 | 页面加载不请求 `api.dicebear.com`，图标为本地生成的 SVG |

## 4. 自动化执行

一条命令跑完 A–Y 的全部可自动化用例：

```bash
node scripts/e2e-verify.mjs
```

脚本会：
1. 检查 `/api/health`；
2. 登录拿 cookie；
3. 逐条断言 A–Y 的 API 层用例；
4. 用 Playwright 打开真实浏览器验证 UI 层用例（订阅 toast、左栏可见、快捷键、主题）；
5. 输出 PASS/FAIL 汇总表，任一条失败则退出码非 0。

## 5. 通过标准

- A–Y 全部用例 PASS；
- `npx tsc --noEmit`、`npx next lint`、`npx vitest run` 均无错误；
- 容器 `healthy`，重启后数据一致。

## 6. 已知不覆盖

| 项 | 原因 |
|----|------|
| Kindle 真实投递到设备 | 已实现并实测到「邮件成功交给 SMTP」为止；Amazon 侧的投递时效取决于发件域名信誉与白名单，自动化测试无法验证最终到达 |
| 多设备同步 | 单机 SQLite，没有账号服务端 |
| 移动端触屏手势 | 桌面 Docker 环境无法真实模拟触屏惯性滚动 |
| 从旧到新的跨源去重 | 不同源可能转载同一篇文章，属于内容去重功能，未实现 |

---

## 7. 自动化验收脚本

手工用例适合验收「手感」，但不适合每次改代码都重跑一遍。仓库里带了两套脚本，覆盖上面绝大多数用例：

```bash
npm run verify:e2e   # API 层，85 个用例
npm run verify:ui    # 浏览器层，33 个用例（Playwright + 系统 Chrome）
npm run verify       # 两套串联，任一失败则退出码非 0
```

**分工**：

| 脚本 | 验证什么 | 不验证什么 |
|------|----------|-----------|
| `scripts/e2e-verify.mjs` | 接口契约、状态码、数据库副作用、鉴权边界 | 界面渲染、键盘交互、视觉状态 |
| `scripts/ui-verify.mjs` | 只有真浏览器能验的：快捷键、主题持久化、toast 可见性、收藏图标状态 | 接口的完整字段矩阵 |

**可覆盖的参数**（都读环境变量）：

```bash
BASE_URL=http://127.0.0.1:3001 TEST_EMAIL=test@example.com TEST_PASSWORD=123456 npm run verify
```

**已知的、刻意为之的「测试宽容」**：

- **A-01 订阅用例会依次尝试多个源**。RSS 市场收录 890+ 个第三方站点，其中总有停更、下线、TLS 握手失败的。如果只点第一个，测试就会变成「今天某个第三方站点是否在线」的探测，而不是「订阅功能是否可用」。所以脚本最多试 8 个候选源，只要有一个成功就算通过，并在输出里标明用的是哪个。
- **D-01 正文长度用例跨整个列表抽样**。原来只取前 8 篇，碰上全是快讯源的那一页会误判「全文抓取坏了」。现在按等距抽 20 篇取最大值。
- **A-01（UI）同样逐个尝试**，且只要出现任何非「请先登录」的 toast 就算反馈链路通——因为「订阅失败：TLS 握手失败」也证明按钮确实接上了后端。

**CI 里的位置**：`.github/workflows/ci.yml` 目前只跑 `typecheck` + `lint` + `build` + `test:unit`，不跑 `verify:*`。原因是这两套脚本需要一个真实运行的实例和网络访问，放在 CI 里要么起服务（增加构建时间），要么依赖外网（结果不稳定）。要接进 CI，建议单独开一个 job：

```yaml
  verify:
    runs-on: ubuntu-latest
    needs: verify
    steps:
      - uses: actions/checkout@v4
      - run: docker compose up -d --build
      - run: |
          until curl -sf http://127.0.0.1:3000/api/health; do sleep 2; done
      - run: npm run verify
        env:
          JWT_SECRET: ci-only-secret-at-least-32-characters-long
```

---

## 8. 本轮实测结果

```
npm run verify:e2e   → 结果：85/85 通过（未配 SMTP）/ 88/88 通过（配了 SMTP）
npm run verify:ui    → 结果：33/33 通过
npx vitest run       → 31 passed (3 files)
node node_modules/typescript/lib/_tsc.js --noEmit  → PASS
npx next lint        → 0 error（仅 no-img-element / exhaustive-deps 警告）
```

脚本可以连续跑多次：I-13 会把全局限流桶打满，脚本随后等它自然过期再返回，
不会污染下一轮；T-10/T-12 会把自己创建的验收标签删掉，不在用户标签列表里留垃圾。

容器状态：`docker compose ps` → `werss` **Up (healthy)**，端口 `0.0.0.0:3000->3000`。

### 密码重置的完整链路验证（2026-11-12）

用本地 SMTP 桩（`smtp-server` 监听 2526）+ 独立容器（端口 3020，`SMTP_HOST=host.docker.internal`）实测：

```
1. POST /api/auth/forgot-password {"email":"test@example.com"}
   → 200 {"success":true,"message":"如果该邮箱已注册，重置链接会在一分钟内送达"}
2. SMTP 桩收到邮件，base64 解码正文后取到链接：
   http://127.0.0.1:3020/reset-password?token=7cf8fe34...
3. POST /api/auth/reset-password {"token":"7cf8fe34...","password":"newpass2026"}
   → 200 {"success":true,"message":"密码已重置，请用新密码登录"}
4. 同一 token 再提交一次 → 400「重置链接无效或已过期」（一次性生效）
5. 旧密码 123456 登录 → 401「邮箱或密码错误」
6. 新密码 newpass2026 登录 → 200
```

未配 SMTP 的默认容器上：`POST /api/auth/forgot-password` → **503**「服务端未配置邮件通道，无法发送重置邮件」，文案给出替代方案，不假装发送。

---

## 9. Kindle 推送的实现与验证方式

**实现原理**：Kindle 的 Send-to-Kindle 本质是邮件流程 —— 把文件作为附件发到 `xxx@kindle.com`（国际）或 `xxx@kindle.cn`（中国），Amazon 收到后推送到设备。所以这里只需要一个能发信的 SMTP 账号，**不需要 Amazon API、不需要 OAuth、不需要任何 Key**，与项目「拉下来就能跑」的定位一致。

**发的是附件而不是正文**：Kindle 对邮件正文的排版支持很差，而 `.html` 附件会用设备自带的阅读引擎渲染，字号、断行、翻页都正常。文件名会成为书库里的书名，所以用文章标题。

**没配 SMTP 时**：接口返回 503 + 具体缺哪几个环境变量；前端据此隐藏阅读器里的推送按钮，设置页显示「暂不可用」，而不是画一个点了没反应的入口。

**权限**：只允许推送**自己订阅的源**里的文章。未订阅一律返回 404（与文章详情接口一致，不用状态码差异泄漏别人的文章 id 是否存在）。

**投递记录**：每次推送都落一行 `kindle_deliveries`（状态 + 失败原因）。SMTP 的报错对普通用户没有可操作性，所以做了翻译：

| SMTP 原始错误 | 返回给用户的话 |
|---|---|
| `not configured to receive` / `whitelist` | 请先把发件邮箱加入 Amazon 的「已批准的个人文档电子邮件列表」 |
| `attachment` / `too large` | 邮件过大，这篇文章的图片可能太多 |
| `auth` / `credential` | SMTP 认证失败，请检查 SMTP_USER / SMTP_PASSWORD |
| `ENOTFOUND` / `ECONNREFUSED` / `timeout` | 连不上 SMTP 服务器，请检查 SMTP_HOST / SMTP_PORT |

### 怎么验证真实投递

自动化测试不往真邮箱发垃圾邮件。本地验证用一个 SMTP 桩接收全部邮件：

```bash
# 1) 起一个只收不发的 SMTP 桩（端口 2525）
cd /tmp && npm i smtp-server
node -e "
const {SMTPServer}=require('smtp-server');
new SMTPServer({authOptional:true,disabledCommands:['STARTTLS','AUTH'],
  onData(s,sess,cb){let r='';s.on('data',c=>r+=c);s.on('end',()=>{
    console.log(JSON.stringify({to:sess.envelope.rcptTo.map(x=>x.address),
      bytes:r.length,attachment:/Content-Disposition:\s*attachment/i.test(r)}));cb();});}
}).listen(2525,'0.0.0.0')"

# 2) 让容器把邮件发到它
#    docker-compose 的 environment 里加：
#    SMTP_HOST=host.docker.internal  SMTP_PORT=2525  SMTP_SECURE=false
#    SMTP_USER=任意  SMTP_PASSWORD=任意  SMTP_FROM=sender@werss.local
#    extra_hosts: ["host.docker.internal:host-gateway"]

# 3) 推一篇
BASE_URL=http://127.0.0.1:3010 npm run verify:e2e   # K-04 会真的发一封
```

实测结果：SMTP 桩收到 `{ to: ["verify@kindle.cn"], bytes: 7238, attachment: true }`，`kindle_deliveries` 落库状态 `SENT`。

**测试桩不支持 AUTH 是刻意的**：`smtp-server` 自带的默认 TLS 证书早已过期，nodemailer 会直接拒绝（报 `certificate has expired`），而这正好也被用来验证了错误翻译链路 —— K-02/K-03 的分支就是这么测出来的。
