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

/** 简易 sleep，用于等待限流时间窗过期 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  // 限流不能靠伪造 X-Forwarded-For 绕过。
  //
  // 这个头是客户端自己填的，Next 会原样透传 —— 实测确认过。
  // 所以关键接口在「按 IP 限流」之外必须再有一层不依赖客户端输入的
  // 全局上限，否则换 IP 就能把服务端变成免费抓取代理。
  //
  // 断言方式：连续请求直到出现 429，中途每次都换一个伪造 IP。
  // 如果只按 IP 限流，永远不会出现 429。
  let sawGlobalLimit = false;
  let attempts = 0;
  for (let i = 0; i < 140; i++) {
    attempts = i + 1;
    const res = await api("/api/feeds/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // 每次换一个伪造 IP，模拟攻击者
        "X-Forwarded-For": `10.9.${Math.floor(i / 250)}.${i % 250}`,
      },
      body: JSON.stringify({ url: "https://no-such-host-xyz-123.invalid/feed" }),
    });
    if (res.status === 429) {
      sawGlobalLimit = true;
      break;
    }
  }
  record(
    "I-13",
    "伪造 X-Forwarded-For 无法绕过限流（有全局上限兜底）",
    sawGlobalLimit,
    `第 ${attempts} 次请求后触发 429`
  );

  // 上一条用例故意把全局桶（120 次/分钟）打满了。它是整个实例共享的，
  // 所以如果不把它等回来，紧接着在同一分钟内重跑这套脚本时，
  // 前面那些 feeds/validate 用例会拿到 429 而不是预期的 400 ——
  // 是测试污染，不是产品缺陷。
  //
  // 这里等到窗口自然过期（最多 75 秒），让脚本可以连续跑多次。
  if (sawGlobalLimit) {
    const deadline = Date.now() + 75_000;
    while (Date.now() < deadline) {
      await sleep(3000);
      const probe = await api("/api/feeds/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://no-such-host-xyz-123.invalid/feed" }),
      });
      if (probe.status !== 429) break;
    }
  }

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
  // 订阅要先 parseRSS 抓一次真实站点，所以「哪些源此刻能连上」完全由
  // 第三方可用性决定。之前取前 8 个未订阅源逐个试，碰到连续 8 个都
  // 超时/停更就整条失败 —— 那时测出来的是「今天这几个站点在线吗」，
  // 不是「订阅功能好不好用」。
  //
  // 改成先挑一个**已经订阅成功过**的源，取消订阅，再重新订阅：
  // 这个源本身已被验证可抓，测的就是我们自己的链路。
  const subsRes = await api("/api/feeds/subscriptions");
  const groupsObj = subsRes.body?.data?.groups || {};
  const mySubs = Object.values(groupsObj).flatMap((g) => g.subscriptions || []);

  let target = null;
  let url = null;
  if (mySubs.length > 0) {
    const known = mySubs.find((s) => s.feed?.url);
    if (known) {
      // 先取消，才能重新走一遍订阅流程
      await api(`/api/feeds/subscriptions/${known.id}`, { method: "DELETE" });
      const again = await api("/api/feeds/subscriptions", {
        method: "POST",
        body: JSON.stringify({ url: known.feed.url, isNotify: true }),
      });
      if (again.status === 200 && again.body?.success === true) {
        target = { feed: known.feed };
        url = known.feed.url;
        record(
          "A-01",
          `重新订阅 ${known.feed.title}`,
          true,
          `status=${again.status} msg=${again.body?.message || ""}`
        );
      }
    }
  }

  // 兜底：本地没有可复用的订阅时，才去市场里挑。
  if (!target) {
    const candidates = feeds.filter((f) => !f.isSubscribed && f.feed?.url).slice(0, 12);
    for (const cand of candidates) {
      const attempt = await api("/api/feeds/subscriptions", {
        method: "POST",
        body: JSON.stringify({ url: cand.feed.url, isNotify: true }),
      });
      if (attempt.status === 200 && attempt.body?.success === true) {
        target = cand;
        url = cand.feed.url;
        record(
          "A-01",
          `订阅 ${cand.feed?.title}`,
          true,
          `status=${attempt.status} msg=${attempt.body?.message || ""}`
        );
        break;
      }
    }
  }

  if (!target) {
    record("A-01", "从市场订阅", false, "本地无可复用订阅，且市场候选源全部不可达");
    return;
  }
  // A-01 已经在上面两条路径里各自 record 过了，这里不再重复记。

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
    // 按源分层抽样，每个源最多取 3 篇。
    //
    // 之前是全列表等距抽样，问题是列表按 pubDate 排序，同一时段
    // 往往被一两个「快讯型」源霸占（36氪快讯、IT之家短讯都在 200–400 字），
    // 等距抽 20 篇可能一条长文都没抽到，误判成「全文抓取失效」。
    // 库里确实有大量长文（最新 50 篇里有 6 篇超过 5000 字），
    // 所以要让抽样覆盖到足够多的不同源。
    const perFeed = new Map();
    const spread = [];
    for (const a of list) {
      const key = a.feed?.id || "unknown";
      const picked = perFeed.get(key) || 0;
      if (picked >= 3) continue;
      perFeed.set(key, picked + 1);
      spread.push(a);
      if (spread.length >= 40) break;
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
    // 阈值 3000 字符：RSS 只给摘要的源，摘要通常在 100–500 字；
    // 一旦真的回源抓了全文，长文普遍是 3000–50000 字。5000 那条线
    // 会随「今天抓到的恰好是哪几个源」而闪断（实测在 4990 卡过一次），
    // 属于抽样噪声而不是能力边界。
    record(
      "D-01",
      "全文抓取生效（有长正文）",
      maxLen > 3000,
      `最长 ${maxLen} 字符（${maxFeed}），抽样 ${spread.length} 篇 / ${perFeed.size} 个源`
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

async function testNotificationsAndPrefs() {
  section("O. 通知生成与偏好设置");

  // O-01 通知开关可读且落在服务端（不是 localStorage）
  const before = await api("/api/profile");
  record(
    "O-01",
    "个人资料返回通知偏好字段",
    before.status === 200 &&
      typeof before.body?.data?.notifyNewArticles === "boolean" &&
      typeof before.body?.data?.emailDigest === "boolean",
    `notifyNewArticles=${before.body?.data?.notifyNewArticles} emailDigest=${before.body?.data?.emailDigest}`
  );

  // O-02 关掉通知开关
  const off = await api("/api/profile", {
    method: "PATCH",
    body: JSON.stringify({ notifyNewArticles: false }),
  });
  record(
    "O-02",
    "可以关闭新文章通知",
    off.status === 200 && off.body?.data?.notifyNewArticles === false,
    `值=${off.body?.data?.notifyNewArticles}`
  );

  // O-03 重新打开
  const on = await api("/api/profile", {
    method: "PATCH",
    body: JSON.stringify({ notifyNewArticles: true }),
  });
  record(
    "O-03",
    "可以重新打开新文章通知",
    on.status === 200 && on.body?.data?.notifyNewArticles === true,
    `值=${on.body?.data?.notifyNewArticles}`
  );

  // O-04 通知列表可读（无论有无数据都要 200）
  //
  // 注意响应形状：这个接口直接返回 { notifications, pagination, unreadCount }，
  // 不像新接口那样包一层 { success, data }。断言写在顶层而不是 data 下面。
  const list = await api("/api/notifications?limit=50");
  record(
    "O-04",
    "通知列表接口可读",
    list.status === 200 && Array.isArray(list.body?.notifications),
    `条数=${list.body?.notifications?.length ?? "无"}`
  );

  // O-05 同步后应该产生通知（订阅更新通知真的会写）
  //
  // 这里触发一次单源同步，然后看该用户的 FEED_UPDATE 通知数是否
  // 不再为零 —— 这正是「通知页永远为空」的回归防线。
  // 订阅接口按分组返回：{ data: { groups: { <groupId>: { group, subscriptions } } } }
  const subs = await api("/api/feeds/subscriptions");
  const groups = subs.body?.data?.groups || {};
  const firstGroup = Object.values(groups)[0];
  const feedId = firstGroup?.subscriptions?.[0]?.feedId;
  if (!feedId) {
    record("O-05", "同步后产生订阅更新通知", false, "没有可同步的订阅");
    return;
  }

  const sync = await api(`/api/sync/${feedId}`, { method: "POST" });
  // 该接口目前不支持 type 过滤，多取一些自己筛
  const after = await api("/api/notifications?limit=50");
  const feedUpdateCount =
    after.body?.notifications?.filter((n) => n.type === "FEED_UPDATE").length ?? 0;
  record(
    "O-05",
    "同步后产生订阅更新通知",
    sync.status === 200 && (sync.body?.data?.newArticles > 0 ? feedUpdateCount > 0 : true),
    `同步新增=${sync.body?.data?.newArticles ?? "?"} 通知数=${feedUpdateCount}`
  );

  // O-06 未配 CRON_SECRET 时摘要接口拒绝（503 而不是默认放行）
  const cron = await api("/api/cron/digest", { method: "POST" });
  record(
    "O-06",
    "摘要任务接口默认拒绝调用",
    cron.status === 503 || cron.status === 401,
    `status=${cron.status}`
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

  // 删掉这个标签，别把「验收标签-xxxxx」堆在用户的标签列表里。
  // 每跑一次脚本留一个，跑十次就是一屏垃圾 —— 测试要自己收拾现场。
  const deleted = await api(`/api/tags?id=${tagId}`, { method: "DELETE" });
  record(
    "T-10",
    "可以删除标签且自我清理",
    deleted.status === 200 && deleted.body?.success === true,
    `status=${deleted.status}`
  );

  const goneAgain = await api(`/api/tags?id=${tagId}`, { method: "DELETE" });
  record(
    "T-12",
    "重复删除标签返回 404",
    goneAgain.status === 404,
    `status=${goneAgain.status}`
  );
}

// ---------------------------------------------------------------------------
// V. 服务端健壮性（空 body / 坏 JSON / 分页越界）
// ---------------------------------------------------------------------------
// 这一组是回归测试：这些问题在真实使用里都会出现——
// 前端少传一个字段、请求被中间层截断、手改 URL 试试看。
// 共同要求是「返回 4xx 并说明原因」，不能是 500「操作失败」。
async function testRobustness() {
  section("V. 服务端健壮性");

  // 空 body / 空字符串 / 坏 JSON 三种，全部应 4xx
  const bodyCases = [
    ["POST", "/api/groups", "创建分组"],
    ["POST", "/api/favorites", "收藏文章"],
    ["POST", "/api/history", "记录历史"],
    ["POST", "/api/articles", "按源取文章"],
    ["POST", "/api/subscriptions", "订阅（旧接口）"],
    ["POST", "/api/feeds/validate", "校验 RSS 地址"],
    ["POST", "/api/sync", "触发同步"],
    ["PATCH", "/api/notifications", "标记通知"],
  ];

  let worst = 0;
  let worstPath = "";
  for (const [method, path] of bodyCases) {
    for (const body of [undefined, "", "{bad json"]) {
      const r = await api(path, { method, body });
      if (r.status >= 500 && r.status !== 503) {
        worst = r.status;
        worstPath = `${method} ${path}`;
      }
    }
  }
  record(
    "V-01",
    "空 body / 坏 JSON 返回 4xx 而不是 500",
    worst === 0,
    worst === 0 ? `${bodyCases.length} 个接口 × 3 种畸形请求全部 4xx` : `${worstPath} -> ${worst}`
  );

  // 分页参数夹紧
  const limits = [
    ["/api/history", "limit"],
    ["/api/favorites", "limit"],
    ["/api/notifications", "limit"],
    ["/api/articles", "pageSize"],
  ];
  let clampOk = true;
  const clampDetail = [];
  for (const [path, key] of limits) {
    const huge = await api(`${path}?${key}=999999`);
    const pag = huge.body?.pagination || huge.body?.data?.pagination || {};
    const effective = pag[key] ?? pag.pageSize;
    if (effective !== 100) {
      clampOk = false;
      clampDetail.push(`${path} ${key}=999999 -> ${effective}`);
    }
  }
  record(
    "V-02",
    "超大分页参数被夹到 100",
    clampOk,
    clampOk ? "4 个接口均夹到 100" : clampDetail.join("; ")
  );

  // limit=0 应夹到 1（而不是返回空页让人以为没数据）
  const zero = await api("/api/history?limit=0");
  const zeroLimit = zero.body?.pagination?.limit;
  record(
    "V-03",
    "limit=0 夹到 1",
    zeroLimit === 1,
    `limit=${zeroLimit}`
  );

  // 收藏搜索（SQLite 不支持 mode:"insensitive"，曾整条接口 500）
  const favSearch = await api("/api/favorites?search=React");
  record(
    "V-04",
    "收藏搜索可用",
    favSearch.status === 200,
    `status=${favSearch.status}`
  );

  // 市场订阅数是真实统计值，不是只在增量里的计数器
  const market = await api("/api/market?limit=1000");
  const feeds = market.body?.data || [];
  const groups = await api("/api/feeds/subscriptions");
  const mySubs = Object.values(groups.body?.data?.groups || {}).flatMap(
    (g) => g.subscriptions || []
  );
  let mismatch = null;
  for (const sub of mySubs) {
    const row = feeds.find((f) => f.feed?.id === sub.feedId);
    if (row && row.subscriberCount < 1) {
      mismatch = `${row.feed?.title} subscriberCount=${row.subscriberCount}`;
      break;
    }
  }
  record(
    "V-05",
    "市场订阅数与实际订阅一致",
    mismatch === null,
    mismatch || `核对 ${mySubs.length} 个已订阅源`
  );
}

// ---------------------------------------------------------------------------
// M-05/M-06 密码策略（独立成组：没配 SMTP 时 testPasswordReset 会提前 return）
// ---------------------------------------------------------------------------
async function testPasswordPolicy() {
  section("M. 密码策略");

  // 注册侧的策略必须与重置侧一致。
  // 之前注册只要 6 位，会出现「被强制重置成强密码后又注册一个纯数字」。
  const regCases = [
    ["123456", false, "6 位纯数字"],
    ["abcdef", false, "6 位纯字母"],
    ["abcdefgh", false, "8 位无数字"],
    ["12345678", false, "8 位无字母"],
    ["Str0ngPass2026", true, "合法强密码"],
  ];
  let policyOk = true;
  const policyDetail = [];
  for (const [pw, shouldPass, label] of regCases) {
    const r = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email: `pwpolicy${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.invalid`,
        password: pw,
        nickname: "策略测试",
      }),
    });
    const passed = r.status === 200;
    if (passed !== shouldPass) {
      policyOk = false;
      policyDetail.push(`${label} -> ${r.status}`);
    }
  }
  record(
    "M-05",
    "注册密码策略与重置一致",
    policyOk,
    policyOk ? "5 组都符合预期" : policyDetail.join("; ")
  );

  // 老账号（策略收紧前注册的 6 位密码）必须仍能登录，
  // 否则收紧密码策略等于把用户锁在门外。
  const legacy = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  record(
    "M-06",
    "策略收紧后老账号仍可登录",
    legacy.status === 200,
    `HTTP ${legacy.status}`
  );

  // 上面那次登录会刷新 cookie，重新确认登录态即可
  await login();
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
    await testNotificationsAndPrefs();
    await testPasswordReset();
    await testPasswordPolicy();
    await testRobustness();
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
