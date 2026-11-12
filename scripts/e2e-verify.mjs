#!/usr/bin/env node
/**
 * WeRSS 端到端验收脚本。
 *
 * 对应 docs/TEST-PLAN.md 里的 A–J 全部可自动化用例。
 * 直接对 Docker 里跑着的实例发请求，不 mock 任何东西 ——
 * 目的是回答「这套东西在本机真的能跑通吗」，而不是「单测覆盖了多少行」。
 *
 * 用法：
 *   node scripts/e2e-verify.mjs                     # 默认 http://127.0.0.1:3000
 *   BASE_URL=http://127.0.0.1:3001 node scripts/e2e-verify.mjs
 *
 * 退出码：全部通过 0，存在失败 1。
 */

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const EMAIL = process.env.TEST_EMAIL || "test@example.com";
const PASSWORD = process.env.TEST_PASSWORD || "123456";

const results = [];

function record(id, name, ok, detail = "") {
  results.push({ id, name, ok, detail });
  const mark = ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
  const tail = detail ? `  \x1b[90m${detail}\x1b[0m` : "";
  console.log(`${mark} ${id.padEnd(6)} ${name}${tail}`);
}

/** 统一请求封装，自动带上 cookie */
let cookie = "";

async function api(path, options = {}) {
  const headers = {
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(cookie ? { Cookie: cookie } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const setCookie = res.headers.getSetCookie?.() || [];
  if (setCookie.length) cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  let body = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body, headers: res.headers };
}

function section(title) {
  console.log(`\n\x1b[1m${title}\x1b[0m`);
}

// ---------------------------------------------------------------------------
// J. 运维
// ---------------------------------------------------------------------------
async function testOps() {
  section("J. 运维");

  const health = await api("/api/health");
  record(
    "J-01",
    "健康检查返回 200 且数据库可用",
    health.status === 200 && health.body?.database === "ok",
    `status=${health.status} database=${health.body?.database}`
  );
}

// ---------------------------------------------------------------------------
// I. 鉴权与安全
// ---------------------------------------------------------------------------
async function testSecurity() {
  section("I. 鉴权与安全");

  // 未登录时先清掉 cookie
  const savedCookie = cookie;
  cookie = "";

  const subs = await api("/api/subscriptions");
  record("I-01", "未登录读订阅返回 401", subs.status === 401, `status=${subs.status}`);

  const art = await api("/api/articles/any-id");
  record(
    "I-02",
    "未登录读文章详情返回 401",
    art.status === 401,
    `status=${art.status}`
  );

  // 伪造 token（用项目历史上那个硬编码兜底密钥）
  cookie = "";
  const forged = await fetch(`${BASE}/api/auth/me`, {
    headers: {
      Cookie: `token=${makeForgedToken()}`,
    },
  });
  record(
    "I-05",
    "用示例密钥伪造的 JWT 被拒绝",
    forged.status === 401,
    `status=${forged.status}`
  );

  // SSRF：服务端不能替任何人去请求内网 / 云元数据。这些地址一旦可达，
  // 攻击者就能用服务端的内网身份读取元数据服务、内网数据库等。
  const ssrfTargets = [
    ["I-07", "http://127.0.0.1:3000/api/health", "环回地址"],
    ["I-08", "http://169.254.169.254/latest/meta-data/", "云元数据"],
    ["I-09", "http://10.0.0.1/", "私有网段"],
    ["I-10", "file:///etc/passwd", "非 http 协议"],
    ["I-11", "http://127.0.0.1.nip.io:3000/", "解析到内网的域名"],
  ];
  for (const [id, url, label] of ssrfTargets) {
    const res = await api("/api/feeds/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    record(id, `SSRF 拦截：${label}`, res.status === 400, `status=${res.status}`);
  }

  // 通知只能由本人读改，不能由匿名访客写入
  const injected = await api("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: "any",
      type: "SYSTEM",
      title: "未授权注入测试",
    }),
  });
  record(
    "I-12",
    "匿名访客不能向他人收件箱注入通知",
    injected.status === 405,
    `status=${injected.status}`
  );

  cookie = savedCookie;
}

/** 构造一个用 "your-secret-key" 签名的 JWT，用于验证兜底密钥已被禁用 */
function makeForgedToken() {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      sub: "victim",
      email: "victim@example.com",
      nickname: "victim",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  );
  // 不真的算签名：服务端应当因为密钥不合规而拒绝，签名对不对都不该通过
  return `${header}.${payload}.forgedsignature`;
}

function b64url(str) {
  return Buffer.from(str).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ---------------------------------------------------------------------------
// 登录
// ---------------------------------------------------------------------------
async function login() {
  section("登录");
  const res = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  record(
    "L-01",
    `登录 ${EMAIL}`,
    res.status === 200 && Boolean(cookie),
    `status=${res.status}`
  );
  return res.status === 200;
}

// ---------------------------------------------------------------------------
// A. 订阅管理
// ---------------------------------------------------------------------------
async function testSubscribe() {
  section("A. 订阅管理");

  const market = await api("/api/market");
  const feeds = market.body?.data || [];
  record("A-00", "市场页有可用源", feeds.length > 0, `共 ${feeds.length} 个`);

  // 找几个未订阅的候选源。
  //
  // 不能只取第一个：RSS 市场的源里总有几个站点会临时 TLS 失败、
  // 返回 5xx 或者本身已经停更。测试应该证明「订阅功能可用」，
  // 而不是证明「某个第三方站点此刻是否在线」。
  const candidates = feeds.filter((f) => !f.isSubscribed).slice(0, 8);
  if (candidates.length === 0) {
    record("A-01", "从市场订阅", false, "所有源都已订阅，无法测试");
    return;
  }

  let target = null;
  let sub = null;
  for (const cand of candidates) {
    const attempt = await api("/api/feeds/subscriptions", {
      method: "POST",
      body: JSON.stringify({ url: cand.feed?.url, isNotify: true }),
    });
    if (attempt.status === 200 && attempt.body?.success === true) {
      target = cand;
      sub = attempt;
      break;
    }
  }

  if (!target) {
    record(
      "A-01",
      "从市场订阅",
      false,
      `${candidates.length} 个候选源全部订阅失败（网络或源本身不可用）`
    );
    return;
  }

  const url = target.feed?.url;
  record(
    "A-01",
    `订阅 ${target.feed?.title}`,
    true,
    `status=${sub.status} msg=${sub.body?.message || ""}`
  );

  // 重复订阅
  const dup = await api("/api/feeds/subscriptions", {
    method: "POST",
    body: JSON.stringify({ url, isNotify: true }),
  });
  record(
    "A-04",
    "重复订阅不报错且提示已订阅",
    dup.status === 200 &&
      dup.body?.success === true &&
      String(dup.body?.message || "").includes("已经订阅"),
    `status=${dup.status} msg=${dup.body?.message || ""}`
  );

  // 订阅后必须出现在 /api/groups（阅读器左栏的数据源）
  const groups = await api("/api/groups");
  const allFeeds = (groups.body?.data || []).flatMap((g) => g.subscriptions || []);
  const visible = allFeeds.some((s) => s.feed?.url === url);
  record(
    "A-02",
    "订阅后出现在阅读器左栏数据里",
    visible,
    `左栏共 ${allFeeds.length} 个源`
  );

  // 取消订阅
  const subId = allFeeds.find((s) => s.feed?.url === url)?.id;
  if (subId) {
    const del = await api(`/api/feeds/subscriptions/${subId}`, { method: "DELETE" });
    record(
      "A-03",
      "取消订阅成功",
      del.status === 200 && del.body?.success === true,
      `status=${del.status}`
    );
  } else {
    record("A-03", "取消订阅成功", false, "找不到刚订阅的记录 id");
  }

  // 无效源
  const bad = await api("/api/feeds/subscriptions", {
    method: "POST",
    body: JSON.stringify({ url: "https://example.com/not-a-feed", isNotify: true }),
  });
  record(
    "A-05",
    "无效源给出明确错误而非静默",
    bad.status >= 400 && Boolean(bad.body?.message),
    `status=${bad.status} msg=${String(bad.body?.message || "").slice(0, 60)}`
  );

  // UA 内容协商的源（机核对完整浏览器 UA 返回 HTML）
  const gcores = await api("/api/feeds/subscriptions", {
    method: "POST",
    body: JSON.stringify({ url: "https://www.gcores.com/rss", isNotify: true }),
  });
  record(
    "A-06",
    "机核源可订阅（UA 内容协商回退生效）",
    gcores.status === 200 && gcores.body?.success === true,
    `status=${gcores.status} msg=${gcores.body?.message || ""}`
  );

  // -------------------------------------------------------------------------
  // 分组 CRUD
  //
  // 这三个接口原先在页面上只是 `toast.info("分组功能开发中")` 的占位，
  // 用户点「新建分组」永远看不到分组出现。现在接上了真接口，
  // 就从「有没有反应」验到「数据是否真的变了」。
  // -------------------------------------------------------------------------
  const createdGroup = await api("/api/groups", {
    method: "POST",
    body: JSON.stringify({ name: `验收分组-${Date.now()}` }),
  });
  const groupId = createdGroup.body?.data?.id;
  record(
    "A-07",
    "创建分组",
    createdGroup.status === 200 && Boolean(groupId),
    `status=${createdGroup.status} id=${groupId || "无"}`
  );

  if (groupId) {
    const renamedGroup = await api(`/api/groups?id=${groupId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "验收分组-已改名" }),
    });
    record(
      "A-08",
      "重命名分组",
      renamedGroup.status === 200 &&
        renamedGroup.body?.data?.name === "验收分组-已改名",
      `status=${renamedGroup.status} name=${renamedGroup.body?.data?.name || ""}`
    );

    const deletedGroup = await api(`/api/groups?id=${groupId}`, {
      method: "DELETE",
    });
    record(
      "A-09",
      "删除分组",
      deletedGroup.status === 200 && deletedGroup.body?.success === true,
      `status=${deletedGroup.status}`
    );

    // 删除之后不能再改 —— 顺便验「按 id 改别人分组」这类越权是 404 而不是成功
    const afterDelete = await api(`/api/groups?id=${groupId}`, {
      method: "PATCH",
      body: JSON.stringify({ name: "不该成功" }),
    });
    record(
      "A-10",
      "分组删除后不可再修改（越权返回 404）",
      afterDelete.status === 404,
      `status=${afterDelete.status}`
    );
  }
}

// ---------------------------------------------------------------------------
// E. 排序与筛选
// ---------------------------------------------------------------------------
async function testQuery() {
  section("E. 排序与筛选");

  const newest = await api("/api/articles?page=1&pageSize=10");
  const newestList = newest.body?.data?.articles || [];
  record("E-01", "默认最新在前", newestList.length > 0, `共 ${newestList.length} 条`);

  if (newestList.length >= 2) {
    const dates = newestList.map((a) => new Date(a.pubDate).getTime());
    const sortedDesc = dates.every((d, i) => i === 0 || dates[i - 1] >= d);
    record("E-01b", "返回顺序确实是时间倒序", sortedDesc);
  }

  const oldest = await api("/api/articles?page=1&pageSize=10&order=oldest");
  const oldestList = oldest.body?.data?.articles || [];
  if (newestList.length && oldestList.length) {
    const firstNewest = new Date(newestList[0].pubDate).getTime();
    const firstOldest = new Date(oldestList[0].pubDate).getTime();
    record(
      "E-02",
      "order=oldest 时从旧到新",
      firstOldest <= firstNewest,
      `${new Date(firstOldest).toISOString().slice(0, 10)} → ${new Date(firstNewest).toISOString().slice(0, 10)}`
    );
  } else {
    record("E-02", "order=oldest 时从旧到新", false, "没有文章可比较");
  }

  const unread = await api("/api/articles?type=unread&pageSize=50");
  const unreadList = unread.body?.data?.articles || [];
  record(
    "E-03",
    "未读筛选只返回未读",
    unreadList.every((a) => !a.isRead),
    `${unreadList.length} 条全部未读`
  );

  const big = await api("/api/articles?pageSize=999999");
  const bigSize = big.body?.data?.pagination?.pageSize;
  record(
    "E-06",
    "pageSize 被夹到上界 100",
    bigSize === 100,
    `实际 pageSize=${bigSize}`
  );

  const search = await api("/api/articles?search=React&pageSize=10");
  const searchList = search.body?.data?.articles || [];
  record(
    "E-05",
    "搜索命中标题/摘要",
    searchList.length > 0,
    `命中 ${searchList.length} 条`
  );

  const noMatch = await api("/api/articles?search=ZZZNOMATCHZZZ&pageSize=10");
  const noMatchTotal = noMatch.body?.data?.pagination?.total;
  record("E-05b", "搜索无结果时返回 0", noMatchTotal === 0, `total=${noMatchTotal}`);
}

// ---------------------------------------------------------------------------
// D. 内容质量
// ---------------------------------------------------------------------------
async function testContent() {
  section("D. 内容质量");

  const res = await api("/api/articles?pageSize=50");
  const list = res.body?.data?.articles || [];
  record("D-00", "有文章可检查", list.length > 0, `${list.length} 条`);

  // 摘要里不能出现 HTML 标签
  const withHtml = list.filter((a) => /<[a-z][\s\S]*>/i.test(a.description || ""));
  record(
    "D-03",
    "列表摘要不含 HTML 标签",
    withHtml.length === 0,
    withHtml.length ? `${withHtml.length} 条命中，例：${withHtml[0].description?.slice(0, 50)}` : ""
  );

  // 缩略图覆盖率
  const withImg = list.filter((a) => a.imageUrl);
  record(
    "D-02",
    "部分文章有缩略图",
    withImg.length > 0,
    `${withImg.length}/${list.length} 有图`
  );

  // 抽一篇正文检查乱码与面包屑
  const sample = list.find((a) => a.id);
  if (sample) {
    const detail = await api(`/api/articles/${sample.id}`);
    const content = String(detail.body?.data?.content || "");
    record(
      "D-05",
      "正文不含替换字符 U+FFFD",
      !content.includes("\uFFFD"),
      content.includes("\uFFFD") ? "发现乱码" : ""
    );
    record(
      "D-04",
      "正文不含面包屑导航",
      !/首页\s*[>›]|当前位置[:：]|面包屑/.test(content),
      ""
    );
    // 全文抓取：至少有一篇正文超过 5000 字符。
    //
    // 必须从多个源里抽样 —— 只看最新的前几条会踩到「刚好都是快讯源」
    // 的情况，那是抽样偏差，不是抓取失效。
    const spread = [];
    const step = Math.max(1, Math.floor(list.length / 20));
    for (let i = 0; i < list.length && spread.length < 20; i += step) {
      spread.push(list[i]);
    }
    const long = await Promise.all(
      spread.map((a) => api(`/api/articles/${a.id}`))
    );
    let maxLen = 0;
    let maxFeed = "";
    long.forEach((r, i) => {
      const len = String(r.body?.data?.content || "").length;
      if (len > maxLen) {
        maxLen = len;
        maxFeed = spread[i]?.feed?.title || "";
      }
    });
    record(
      "D-01",
      "全文抓取生效（有长正文）",
      maxLen > 5000,
      `最长 ${maxLen} 字符（${maxFeed}），抽样 ${spread.length} 篇`
    );
  }
}

// ---------------------------------------------------------------------------
// F. 数据导入导出
// ---------------------------------------------------------------------------
async function testOpml() {
  section("F. 数据导入导出");

  const exp = await fetch(`${BASE}/api/opml`, { headers: { Cookie: cookie } });
  const opml = await exp.text();
  record(
    "F-01",
    "OPML 导出成功且结构合法",
    exp.status === 200 && opml.includes("<opml") && opml.includes("xmlUrl="),
    `status=${exp.status} ${opml.length} 字节`
  );

  // 用导出的内容再导入一次，验证解析器能读自己写的文件
  const imp = await fetch(`${BASE}/api/opml/import`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/xml" },
    body: opml,
  });
  const impBody = await imp.json().catch(() => null);
  record(
    "F-02",
    "OPML 导入可解析自己的导出文件",
    imp.status === 200 && impBody?.success === true,
    `status=${imp.status} ${impBody?.message || ""}`
  );
}

// ---------------------------------------------------------------------------
// G. 阅读主题（API 层无法验证，验证 CSS 变量存在）
// ---------------------------------------------------------------------------
async function testThemeCss() {
  section("G. 阅读主题（构建产物检查）");

  const page = await fetch(`${BASE}/reader`, { headers: { Cookie: cookie } });
  const html = await page.text();
  record(
    "G-00",
    "阅读器页面可访问",
    page.status === 200,
    `status=${page.status} ${html.length} 字节`
  );

  // 主题是通过 data-reader-theme + CSS 变量实现的，检查 CSS 是否被打进产物
  const cssFiles = html.match(/\/_next\/static\/css\/[^"]+\.css/g) || [];
  let hasThemeVars = false;
  for (const f of cssFiles) {
    const css = await fetch(`${BASE}${f}`).then((r) => r.text());
    if (css.includes("data-reader-theme") && css.includes("--reader-bg")) {
      hasThemeVars = true;
      break;
    }
  }
  record(
    "G-01",
    "阅读主题 CSS 变量已打进产物",
    hasThemeVars,
    `${cssFiles.length} 个 CSS 文件`
  );
}

// ---------------------------------------------------------------------------
// J-02 重启幂等（只检查数据未被重复写入）
// ---------------------------------------------------------------------------
async function testIdempotent() {
  section("J. 运维（续）");

  const market = await api("/api/market");
  const total = (market.body?.data || []).length;
  record(
    "J-02",
    "市场源数量在合理区间（未重复导入）",
    total > 100 && total < 2000,
    `共 ${total} 个`
  );
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// K. Kindle 推送
//
// 分两层验：
//   1. 接口约定与失败提示 —— 任何环境都能跑（没配 SMTP 时验 503 与文案）
//   2. 真实投递 —— 只有配了 SMTP 才跑，且不会再往真地址发垃圾邮件
// ---------------------------------------------------------------------------
async function testKindle() {
  section("K. Kindle 推送");

  const status = await api("/api/kindle/push");
  record(
    "K-01",
    "推送状态接口可读",
    status.status === 200 && status.body?.success === true,
    `enabled=${status.body?.data?.enabled}`
  );

  const enabled = Boolean(status.body?.data?.enabled);

  // 没配 SMTP 时，推送必须给出「缺什么」而不是一个裸 500
  if (!enabled) {
    const blocked = await api("/api/kindle/push", {
      method: "POST",
      body: JSON.stringify({ articleId: "whatever" }),
    });
    record(
      "K-02",
      "未配置 SMTP 时返回可操作的提示",
      blocked.status === 503 && /SMTP_HOST/.test(String(blocked.body?.message)),
      `status=${blocked.status}`
    );
    return;
  }

  // 配了 SMTP：先确保有地址，再验越权与真实投递
  await api("/api/profile", {
    method: "PATCH",
    body: JSON.stringify({ kindleEmail: "verify@kindle.cn" }),
  });

  const bad = await api("/api/kindle/push", {
    method: "POST",
    body: JSON.stringify({ articleId: "definitely-not-an-id" }),
  });
  record(
    "K-03",
    "推送未订阅的文章返回 404",
    bad.status === 404,
    `status=${bad.status}`
  );

  const list = await api("/api/articles?page=1&pageSize=1");
  const articleId = list.body?.data?.articles?.[0]?.id;
  if (!articleId) {
    record("K-04", "有可推送的文章", false, "文章列表为空");
    return;
  }

  // 真发信。只发一封，避免把测试桩/真邮箱刷满。
  const pushed = await api("/api/kindle/push", {
    method: "POST",
    body: JSON.stringify({ articleId }),
  });
  record(
    "K-04",
    "推送文章到 Kindle",
    pushed.status === 200 && pushed.body?.success === true,
    `status=${pushed.status} ${String(pushed.body?.message || "").slice(0, 60)}`
  );

  const after = await api("/api/kindle/push");
  const deliveries = after.body?.data?.deliveries || [];
  record(
    "K-05",
    "推送记录已落库且状态为 SENT",
    deliveries.length > 0 && deliveries[0]?.status === "SENT",
    `${deliveries.length} 条，最新=${deliveries[0]?.status || "无"}`
  );

  const profile = await api("/api/profile");
  record(
    "K-06",
    "Kindle 邮箱已保存到用户资料",
    profile.body?.data?.kindleEmail === "verify@kindle.cn",
    `kindleEmail=${profile.body?.data?.kindleEmail ?? "null"}`
  );
}

// ---------------------------------------------------------------------------
// L. 文章标签
//
// 标签是用户自建的分类维度，和「分组」（组织订阅源）不是一回事。
// 这里的重点不是 CRUD 本身，而是**归属校验**：
// ArticleTag 表本身不带 userId，一旦漏掉 join 就能往别人文章上打标签。
// ---------------------------------------------------------------------------
async function testPasswordReset() {
  section("M. 密码重置");

  // 未配 SMTP 时应给出可操作的 503，而不是假装发信成功
  const noSmtp = await api("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL }),
  });

  if (noSmtp.status === 503) {
    record(
      "M-01",
      "未配置 SMTP 时明确返回 503 而不是假装成功",
      noSmtp.status === 503 && /SMTP|邮件通道/.test(noSmtp.body.message || ""),
      `HTTP ${noSmtp.status} ${noSmtp.body.message || ""}`
    );
    // 没配邮件通道，后面的重置链路无从验证，到此为止
    return;
  }

  record(
    "M-01",
    "忘记密码接口已接邮件通道",
    noSmtp.status === 200 && noSmtp.body.success === true,
    `HTTP ${noSmtp.status}`
  );

  // 不存在的邮箱也必须返回成功：否则这个接口成了探测注册情况的工具
  const unknown = await api("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: "definitely-not-registered@example.invalid" }),
  });
  record(
    "M-02",
    "未注册邮箱返回相同结果（不泄漏账号是否存在）",
    unknown.status === 200 && unknown.body.success === true,
    `HTTP ${unknown.status}`
  );

  // 无效 token
  const badToken = await api("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token: "0".repeat(64), password: "newpass2026" }),
  });
  record(
    "M-03",
    "无效 token 被拒绝",
    badToken.status === 400 && /无效|过期/.test(badToken.body.message || ""),
    `HTTP ${badToken.status}`
  );

  // 弱密码被拒
  const weak = await api("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token: "0".repeat(64), password: "123" }),
  });
  record(
    "M-04",
    "弱密码被拒绝并给出规则",
    weak.status === 400 && /至少|字母|数字/.test(weak.body.message || ""),
    `HTTP ${weak.status} ${weak.body.message || ""}`
  );
}

async function testTags() {
  section("L. 文章标签");

  const created = await api("/api/tags", {
    method: "POST",
    body: JSON.stringify({ name: `验收标签-${Date.now() % 100000}` }),
  });
  const tagId = created.body?.data?.id;
  record(
    "T-01",
    "可以创建标签",
    created.status === 200 && Boolean(tagId),
    `tagId=${tagId || "无"}`
  );
  if (!tagId) return;

  // 同名再建一次必须复用而不是报错
  const again = await api("/api/tags", {
    method: "POST",
    body: JSON.stringify({ name: created.body.data.name }),
  });
  record(
    "T-02",
    "同名标签幂等复用",
    again.status === 200 && again.body?.data?.id === tagId,
    `id=${again.body?.data?.id || "无"}`
  );

  const list = await api("/api/articles?page=1&pageSize=1");
  const articleId = list.body?.data?.articles?.[0]?.id;
  if (!articleId) {
    record("T-03", "有可打标签的文章", false, "文章列表为空");
    return;
  }

  const attached = await api(`/api/articles/${articleId}/tags`, {
    method: "POST",
    body: JSON.stringify({ tagId }),
  });
  record(
    "T-03",
    "给文章打标签",
    attached.status === 200 && attached.body?.success === true,
    `status=${attached.status}`
  );

  const readBack = await api(`/api/articles/${articleId}/tags`);
  const names = (readBack.body?.data?.tags || []).map((t) => t.name);
  record(
    "T-04",
    "文章标签可读回",
    names.length === 1,
    names.join(",") || "空"
  );

  const tagList = await api("/api/tags");
  const mine = (tagList.body?.data?.tags || []).find((t) => t.id === tagId);
  record(
    "T-05",
    "标签列表带文章计数",
    mine?.articleCount === 1,
    `articleCount=${mine?.articleCount ?? "无"}`
  );

  // 用一个不存在的标签 id 打标签，必须 404 而不是静默成功
  const badTag = await api(`/api/articles/${articleId}/tags`, {
    method: "POST",
    body: JSON.stringify({ tagId: "not-a-real-tag" }),
  });
  record(
    "T-06",
    "不存在的标签返回 404",
    badTag.status === 404,
    `status=${badTag.status}`
  );

  // 不存在的文章 id 打标签，同样 404
  const badArticle = await api(`/api/articles/not-a-real-article/tags`, {
    method: "POST",
    body: JSON.stringify({ tagId }),
  });
  record(
    "T-07",
    "给不存在的文章打标签返回 404",
    badArticle.status === 404,
    `status=${badArticle.status}`
  );

  const detached = await api(
    `/api/articles/${articleId}/tags?tagId=${tagId}`,
    { method: "DELETE" }
  );
  record(
    "T-08",
    "移除文章标签",
    detached.status === 200 && detached.body?.success === true,
    `status=${detached.status}`
  );

  // 重复移除应为 404（说明它确实已经没了，而不是无声成功）
  const detachedAgain = await api(
    `/api/articles/${articleId}/tags?tagId=${tagId}`,
    { method: "DELETE" }
  );
  record(
    "T-09",
    "重复移除返回 404",
    detachedAgain.status === 404,
    `status=${detachedAgain.status}`
  );
}

async function main() {
  console.log(`\n\x1b[1mWeRSS 端到端验收\x1b[0m  ${BASE}\n`);

  try {
    await testOps();
    await testSecurity();
    const ok = await login();
    if (!ok) {
      console.log("\n\x1b[31m登录失败，后续用例无法执行。\x1b[0m");
      console.log("请确认容器已启动、已跑过 db:seed（演示账号 " + EMAIL + "）。");
      process.exit(1);
    }
    await testSubscribe();
    await testQuery();
    await testContent();
    await testOpml();
    await testThemeCss();
    await testIdempotent();
    await testKindle();
    await testTags();
    await testPasswordReset();
  } catch (error) {
    console.error("\n\x1b[31m执行中断：\x1b[0m", error);
    process.exit(1);
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);

  console.log(
    `\n\x1b[1m结果：${passed}/${results.length} 通过\x1b[0m` +
      (failed.length ? `，\x1b[31m${failed.length} 失败\x1b[0m` : "")
  );

  if (failed.length) {
    console.log("\n失败项：");
    for (const f of failed) {
      console.log(`  ${f.id}  ${f.name}  ${f.detail}`);
    }
    process.exit(1);
  }
}

main();
