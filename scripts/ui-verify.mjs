#!/usr/bin/env node
/**
 * WeRSS 浏览器层验收（Playwright + 系统 Chrome）。
 *
 * 与 scripts/e2e-verify.mjs 的分工：
 *   - e2e-verify.mjs  验证 API 层（订阅、排序、搜索、OPML、鉴权……）
 *   - 本脚本         验证「只有真浏览器才能验」的部分：
 *                    快捷键、主题切换与持久化、toast 可见性、三栏渲染
 *
 * 为什么不用仓库里的 tests/e2e：那批用例是历史遗留，依赖多个硬编码
 * 账号与页面文案，且断言的是「页面上有某个汉字」。这个脚本只断言
 * 可观察的行为变化（标题变了没、data 属性变了没、toast 出现了没），
 * 页面文案调整不会让它误报。
 *
 * 用法：
 *   node scripts/ui-verify.mjs
 *   BASE_URL=http://127.0.0.1:3001 node scripts/ui-verify.mjs
 *
 * 前置：容器已启动（docker compose up -d），已跑过 db:seed。
 */

import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL || "http://127.0.0.1:3000";
const EMAIL = process.env.TEST_EMAIL || "test@example.com";
const PASSWORD = process.env.TEST_PASSWORD || "123456";

const results = [];
const record = (id, name, ok, detail = "") => {
  results.push({ id, name, ok, detail });
  const mark = ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
  console.log(`${mark} ${id.padEnd(8)} ${name}${detail ? `  \x1b[90m${detail}\x1b[0m` : ""}`);
};

async function main() {
  console.log(`\n\x1b[1mWeRSS 浏览器层验收\x1b[0m  ${BASE}\n`);

  const browser = await chromium
    .launch({ channel: "chrome" })
    .catch(() => chromium.launch());
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // ---------------- 登录 ----------------
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await Promise.all([
    page.waitForURL(/reader/, { timeout: 25000 }).catch(() => {}),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForTimeout(4500);

  record("B-01", "登录后进入阅读器", page.url().includes("/reader"), page.url());
  record(
    "B-01b",
    "左栏订阅列表可见",
    await page.locator("text=FEEDS").first().isVisible().catch(() => false)
  );

  // ---------------- 快捷键 ----------------
  const h1 = page.locator("h1").first();
  if (await h1.count()) {
    const t0 = await h1.innerText();

    await page.keyboard.press("n");
    await page.waitForTimeout(1200);
    record("C-01", "n 切到下一篇", t0 !== (await h1.innerText()));

    await page.keyboard.press("m");
    await page.waitForTimeout(1200);
    record("C-02", "m 切回上一篇", (await h1.innerText()) === t0);

    await page.keyboard.press("j");
    await page.waitForTimeout(1100);
    record("C-03", "j 等效于 n", (await h1.innerText()) !== t0);

    await page.keyboard.press("k");
    await page.waitForTimeout(1100);
    record("C-03b", "k 等效于 m", (await h1.innerText()) === t0);

    // 输入框内不该触发快捷键
    const searchInput = page.locator('input[placeholder*="搜索"]').first();
    if (await searchInput.count()) {
      const before = await h1.innerText();
      await searchInput.click();
      await searchInput.fill("m");
      await page.waitForTimeout(800);
      record("C-13", "搜索框内按 m 不切换文章", before === (await h1.innerText()));
      await searchInput.fill("");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
    }
  } else {
    record("C-01", "文章标题存在", false, "阅读器里没有文章，先订阅并同步一个源");
  }

  // 快捷键帮助
  await page.keyboard.press("?");
  await page.waitForTimeout(800);
  record(
    "C-11",
    "? 弹出快捷键帮助",
    await page.locator('[role="dialog"]').first().isVisible().catch(() => false)
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  record(
    "C-12",
    "Esc 关闭帮助面板",
    !(await page.locator('[role="dialog"]').first().isVisible().catch(() => false))
  );

  // ---------------- 阅读主题 ----------------
  await page.goto(`${BASE}/reader`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);

  // 主题从顶栏收进了左下角入口的「外观」子菜单——顶栏整条已经取消。
  const themeBtn = page.locator('button[title="导航与设置"]').first();
  if (await themeBtn.count()) {
    await themeBtn.click();
    await page.waitForTimeout(600);
    const appearance = page.locator('[role="menuitem"]').filter({ hasText: "外观" }).first();
    if (await appearance.count()) {
      await appearance.hover();
      await page.waitForTimeout(700);
    }
    const items = await page.locator('[role="menuitem"]').allInnerTexts();
    record("G-01", "主题下拉含四档", items.filter((t) => /浅色|米黄|电子墨水|深色/.test(t)).length >= 4, items.join(" / "));

    const eink = page.locator('[role="menuitem"]').filter({ hasText: "电子墨水" }).first();
    if (await eink.count()) {
      await eink.click();
      await page.waitForTimeout(900);
      record(
        "G-03",
        "电子墨水主题已应用",
        (await page.evaluate(() => document.documentElement.dataset.readerTheme)) === "eink"
      );

      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(2500);
      record(
        "G-02",
        "主题刷新后保持",
        (await page.evaluate(() => document.documentElement.dataset.readerTheme)) === "eink"
      );

      // 恢复成浅色，别影响后续用例与人工查看。
      // 刷新之后菜单是关着的，得重新从左下角入口进「外观」。
      await page.locator('button[title="导航与设置"]').first().click();
      await page.waitForTimeout(500);
      const appearance2 = page.locator('[role="menuitem"]').filter({ hasText: "外观" }).first();
      if (await appearance2.count()) {
        await appearance2.hover();
        await page.waitForTimeout(600);
      }
      const light = page.locator('[role="menuitem"]').filter({ hasText: "浅色" }).first();
      if (await light.count()) {
        await light.click();
        await page.waitForTimeout(600);
      }
      await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    }
  } else {
    record("G-01", "主题下拉存在", false);
  }

  // ---------------- 收藏按钮（原先登录用户点了没反应） ----------------
  // 侧边栏「稍后阅读」也用 bookmark 图标，所以取最靠右的那个才是工具栏按钮。
  const bookmarkBtns = page.locator("button:has(svg.lucide-bookmark)");
  const bookmarkCount = await bookmarkBtns.count();
  if (bookmarkCount > 1) {
    const toolbarIdx = await page.evaluate(() => {
      const btns = Array.from(
        document.querySelectorAll("button")
      ).filter((b) => b.querySelector("svg.lucide-bookmark"));
      let best = 0;
      let maxX = -1;
      btns.forEach((b, i) => {
        const x = b.getBoundingClientRect().x;
        if (x > maxX) {
          maxX = x;
          best = i;
        }
      });
      return best;
    });

    const toolbarFav = bookmarkBtns.nth(toolbarIdx);

    const favNet = [];
    page.on("response", (r) => {
      if (r.url().includes("/favorite")) {
        favNet.push(`${r.request().method()} ${r.status()}`);
      }
    });

    await toolbarFav.click();
    await page.waitForTimeout(2600);
    const favToast = await page
      .locator("[data-sonner-toast]")
      .allInnerTexts()
      .catch(() => []);

    record(
      "B-06",
      "点收藏发出请求并给出提示",
      favNet.length > 0 && favToast.length > 0,
      `${favNet.join(", ") || "无请求"} / ${favToast.join(" | ") || "无提示"}`
    );

    // 还原状态，避免影响用户自己打开时的样子
    await toolbarFav.click();
    await page.waitForTimeout(2200);
  } else {
    record("B-06", "收藏按钮存在", false, "阅读器里没找到工具栏收藏按钮");
  }

  // ---------------- 文本转语音按钮 ----------------
  // 朗读按钮已经收进「更多」菜单（工具栏只留收藏/沉浸/更多三个）。
  // 所以这里改成：打开「更多」→ 面板里要有「朗读全文」。
  const moreTrigger = page.locator('button[title="更多设置"]').first();
  let ttsVisible = false;
  if ((await moreTrigger.count()) > 0) {
    await moreTrigger.click();
    await page.waitForTimeout(600);
    ttsVisible =
      (await page.locator('[role="menuitem"]').filter({ hasText: "朗读全文" }).count()) > 0;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  }
  record("H-01", "朗读入口在「更多」菜单里", ttsVisible);

  // ---------------- 市场订阅 toast ----------------
  await page.goto(`${BASE}/market`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);

  // 逐个点「订阅」，直到有一个成功。
  //
  // 不能只点第一个：市场里 890+ 个源，前几个很可能刚好是
  // 停更、TLS 握手失败或站点已下线的。这里要验的是
  // 「点订阅会不会给出反馈」，不是「某个第三方源此刻是否在线」。
  const subButtons = page.locator("button").filter({ hasText: /^订阅$/ });
  const total = await subButtons.count();

  if (total === 0) {
    record("A-01", "存在未订阅按钮", false, "市场里所有源都已订阅");
  } else {
    let okToast = "";
    let lastToast = "";
    let tried = 0;

    for (let i = 0; i < Math.min(total, 5); i += 1) {
      const btn = subButtons.nth(i);
      if (!(await btn.count())) continue;
      tried += 1;

      await btn.click();
      await page.waitForTimeout(2600);

      const toast = await page
        .locator("[data-sonner-toast]")
        .allInnerTexts()
        .catch(() => []);
      const text = toast.join(" | ");
      lastToast = text;

      // 只要出现任何 toast（成功或失败）就说明反馈链路是通的；
      // 但成功更能证明整条路走完，所以优先要成功的。
      if (text && !text.includes("请先登录")) {
        okToast = text;
        if (text.includes("订阅成功") || text.includes("已经订阅")) break;
      }
    }

    record(
      "A-01",
      "点订阅给出可见反馈",
      Boolean(okToast),
      okToast || `试了 ${tried} 个源，最后一次反馈：${lastToast || "无"}`
    );
  }

  // ---------------- 设置页：Kindle 推送入口 ----------------
  //
  // 注意这里不断言「按钮存在」——服务端没配 SMTP 时按钮本来就不该出现。
  // 断言的是「界面说法与后端状态一致」，这才是真正会出错的地方。
  await page.goto(`${BASE}/settings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  const kindleCard = page.locator("text=Kindle 推送").first();
  const hasKindleCard = (await kindleCard.count()) > 0;

  if (hasKindleCard) {
    const statusResp = await page.evaluate(async () => {
      const r = await fetch("/api/kindle/push");
      return r.ok ? await r.json() : null;
    });
    const serverEnabled = Boolean(statusResp?.data?.enabled);

    // 未配置 SMTP 时页面必须明说「暂不可用」，而不是画一个点了没反应的输入框
    const hint = await page
      .locator("text=服务端尚未配置 SMTP")
      .count()
      .catch(() => 0);

    record(
      "K-11",
      "设置页 Kindle 区块状态与后端一致",
      serverEnabled ? hint === 0 : hint > 0,
      `serverEnabled=${serverEnabled} 缺配置提示=${hint > 0 ? "有" : "无"}`
    );
  } else {
    record("K-11", "设置页有 Kindle 推送区块", false, "没找到该卡片");
  }

  // ---------------- 阅读器：分享按钮真的复制链接 ----------------
  await page.goto(`${BASE}/reader`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const shareBtn = page.locator("button:has(svg.lucide-share2)").first();
  if ((await shareBtn.count()) > 0) {
    await shareBtn.click();
    await page.waitForTimeout(1500);
    const shareToast = await page
      .locator("[data-sonner-toast]")
      .allInnerTexts()
      .catch(() => []);
    record(
      "B-07",
      "分享按钮给出可见反馈",
      shareToast.length > 0,
      shareToast.join(" | ") || "无提示"
    );
  } else {
    record("B-07", "分享按钮存在", false, "没找到分享按钮");
  }

  // ---------------- 阅读器：文章标签下拉 ----------------
  await page.goto(`${BASE}/reader`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);

  // 标签入口同样收进了「更多」菜单，先开菜单再进「标签」子菜单
  const moreForTag = page.locator('button[title="更多设置"]').first();
  let tagOpened = false;
  if ((await moreForTag.count()) > 0) {
    await moreForTag.click();
    await page.waitForTimeout(700);
    const tagSub = page.locator('[role="menuitem"]').filter({ hasText: "标签" }).first();
    if ((await tagSub.count()) > 0) {
      await tagSub.hover();
      await page.waitForTimeout(800);
      tagOpened = true;
    }
  }
  if (tagOpened) {

    const menuTexts = await page
      .locator('[role="menuitem"]')
      .allInnerTexts()
      .catch(() => []);

    // 菜单里必须能看到「新建标签」入口，否则用户没法创建第一个标签
    const hasCreate = menuTexts.some((t) => t.includes("新建标签"));
    record(
      "T-11",
      "标签下拉可打开且有新建入口",
      menuTexts.length > 0 && hasCreate,
      menuTexts.join(" / ") || "菜单为空"
    );

    // 关掉菜单，避免影响后续用例
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
  } else {
    record("T-11", "「更多」菜单里有标签入口", false, "没找到标签入口");
  }


  // ---- 用户偏好设置真正生效（P 组）----
  // 这些开关之前在设置页能拨，但没有任何代码读取。
  // 断言方式：改 localStorage → 刷新 → 看 DOM 是否真的变了。

  const prefKey = "werss:preferences";

  // P-01 紧凑视图：开启后列表里的摘要段落应消失
  await page.evaluate(
    (key) => localStorage.setItem(key, JSON.stringify({ compactView: false })),
    prefKey
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  const descBefore = await page.locator("p.line-clamp-2").count();

  await page.evaluate(
    (key) => localStorage.setItem(key, JSON.stringify({ compactView: true })),
    prefKey
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  const descAfter = await page.locator("p.line-clamp-2").count();

  record(
    "P-01",
    "紧凑视图开关真实生效（摘要被隐藏）",
    descBefore > 0 && descAfter === 0,
    `开前摘要 ${descBefore} 条 → 开后 ${descAfter} 条`
  );

  // P-02 未读角标：关掉后角标不应再渲染
  // 未读角标的渲染位置：左下角入口按钮里的那个小胶囊
  // （顶栏取消后它跟着搬到了这里）
  const readBadge = () =>
    page.evaluate(() => {
      const dock = document.querySelector('button[title="导航与设置"]');
      if (!dock) return null;
      const el = [...dock.querySelectorAll("span")].find((s) =>
        String(s.className).includes("bg-[#c9a962]")
      );
      return el ? el.textContent : null;
    });

  // 角标只在「未读」这一项上显示（它表达的是未读数），
  // 所以先把当前筛选切到未读，否则读到的是「全部」那一项，本来就没有角标。
  const switchToUnread = async () => {
    const dockBtn = page.locator('button[title="导航与设置"]').first();
    if (!(await dockBtn.count())) return;
    await dockBtn.click();
    await page.waitForTimeout(500);
    const unread = page.locator('[role="menuitem"]').filter({ hasText: "未读" }).first();
    if (await unread.count()) {
      await unread.click();
      await page.waitForTimeout(900);
    }
  };

  await page.evaluate(
    (key) => localStorage.setItem(key, JSON.stringify({ showUnreadBadge: true })),
    prefKey
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  await switchToUnread();
  const badgeOn = await readBadge();

  await page.evaluate(
    (key) => localStorage.setItem(key, JSON.stringify({ showUnreadBadge: false })),
    prefKey
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  await switchToUnread();
  const badgeOff = await readBadge();

  record(
    "P-02",
    "未读角标开关真实生效",
    badgeOn !== null && badgeOff === null,
    `开=${badgeOn} 关=${badgeOff}`
  );

  // P-03 自动标记已读：关掉后点开文章，未读圆点数量不应减少
  await page.evaluate(
    (key) =>
      localStorage.setItem(
        key,
        JSON.stringify({ autoMarkRead: false, showUnreadBadge: true, compactView: false })
      ),
    prefKey
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3500);

  const unreadDots = () =>
    page.evaluate(
      () => document.querySelectorAll('span.w-2.h-2.rounded-full.bg-\\[\\#007AFF\\]').length
    );
  const dotsBefore = await unreadDots();
  const titles = page.locator("h3");
  if ((await titles.count()) > 1) {
    await titles.nth(1).click();
    await page.waitForTimeout(2500);
  }
  const dotsAfter = await unreadDots();

  record(
    "P-03",
    "关闭自动已读后点开文章不改变未读状态",
    dotsBefore > 0 && dotsAfter === dotsBefore,
    `点击前 ${dotsBefore} → 点击后 ${dotsAfter}`
  );

  // ---------------- 正文排版（S 组） ----------------
  // 收录的源大多自带「居中窄栏」排版（max-width: 680px、重复标题），
  // 不处理的话正文会被挤成一条窄柱，标题还会重复两遍。
  //
  // 先等正文真的渲染出来。列表接口瘦身之后正文要单独请求详情，
  // 中间有一段时间是骨架屏——上一版没等就量宽度，量到的是骨架节点。
  const waitForBody = async (timeoutMs = 15000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const ready = await page.evaluate(() => {
        const ac = document.querySelector(".article-content");
        if (!ac) return false;
        return Array.from(ac.querySelectorAll("p")).some(
          (e) => e.textContent.trim().length > 30
        );
      });
      if (ready) return true;
      await page.waitForTimeout(400);
    }
    return false;
  };
  // 找一篇「有段落结构」的文章再量。
  //
  // P-03 点的是列表第 2 条，它可能是一条只有一句话的链接型条目
  // （Hacker News 那种，正文就 70 个字、零个 <p>）。拿它量行宽会得到 0，
  // 拿它判「是否返回全文」也会失败——这是选错了样本，不是排版坏了。
  // 所以这里主动往后翻几条，直到遇到真正有段落的那篇。
  let bodyReady = await waitForBody();
  for (let i = 0; !bodyReady && i < 6; i += 1) {
    const titles = page.locator("h3");
    if ((await titles.count()) <= i + 2) break;
    await titles.nth(i + 2).click();
    await page.waitForTimeout(2200);
    bodyReady = await waitForBody(6000);
  }
  if (!bodyReady) {
    const titles = page.locator("h3");
    for (let i = 0; i < Math.min(await titles.count(), 12); i += 1) {
      await titles.nth(i).click();
      await page.waitForTimeout(1800);
      bodyReady = await waitForBody(5000);
      if (bodyReady) break;
    }
  }

  const parsePx = (v) => Number(String(v || "0").replace("px", "")) || 0;

  const layout = await page.evaluate(() => {
    const ac = document.querySelector(".article-content");
    const h1 = document.querySelector("article h1");
    if (!ac) return null;
    const ps = Array.from(ac.querySelectorAll("p")).filter(
      (e) => e.textContent.trim().length > 30
    );
    return {
      paraWidth: ps[0] ? Math.round(ps[0].getBoundingClientRect().width) : 0,
      contentBoxWidth: Math.round(ac.getBoundingClientRect().width),
      title: h1 ? h1.textContent.trim() : "",
      contentStart: ac.textContent.trim().slice(0, 60),
      contentLen: ac.textContent.length,
      paraCount: ac.querySelectorAll("p").length,
    };
  });

  if (layout) {
    // 用「占内容区比例」而不是绝对像素：不同源自己的卡片内边距不一样
    // （有的 16px、有的 24px + 24px），绝对宽度会在 660–720px 之间浮动。
    // 真正要防的是原文那层 `max-width: 680px` 把 832px 的内容区压到 600px 以下。
    const ratio = layout.contentBoxWidth > 0 ? layout.paraWidth / layout.contentBoxWidth : 0;
    record(
      "S-01",
      "正文行宽不被原文窄栏压缩",
      ratio > 0.78,
      `段落 ${layout.paraWidth}px / 内容区 ${layout.contentBoxWidth}px = ${(ratio * 100).toFixed(0)}%`
    );
    const normalized = (t) => t.replace(/\s+/g, "").toLowerCase();
    const titleNorm = normalized(layout.title);
    const startNorm = normalized(layout.contentStart);
    record(
      "S-02",
      "正文开头不重复顶部标题",
      titleNorm.length > 0 && !startNorm.startsWith(titleNorm.slice(0, 12)),
      `标题「${layout.title.slice(0, 14)}」 正文开头「${layout.contentStart.slice(0, 20)}」`
    );
    // 这条要防的是「列表接口瘦身之后，点开文章正文变空」这个回归。
    // 用绝对字数当阈值不稳：选中的若是 IT之家/36氪 那种快讯，正文本来就短。
    // 改成「有段落结构 + 字数明显超过一眼能看完的量」，这才是全文的特征。
    // 阈值放低到 200：全新克隆的库里只有 seed 的 4 篇示例文章，
    // 篇幅本来就短（实测 206 字 / 4 段）。这条断言要防的是
    // 「列表接口瘦身后详情返回空正文」这个回归，不是「文章够不够长」。
    record(
      "S-05",
      "详情接口返回净化后的全文",
      layout.paraCount >= 1 && layout.contentLen > 200,
      `正文 ${layout.contentLen} 字 / ${layout.paraCount} 段`
    );
  } else {
    record("S-01", "正文行宽不被原文窄栏压缩", false, "没找到 .article-content");
  }

  // ---------------- 响应式布局（R 组） ----------------
  // 桌面三栏，小屏三级页面（侧栏 → 列表 → 正文）。
  // 小屏最怕「点了没反应」，所以既查不溢出，也查点完源之后正文别抢走屏幕。
  const visibleCount = (p, sel) =>
    p.evaluate(
      (q) =>
        Array.from(document.querySelectorAll(q)).filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 4 && r.height > 4;
        }).length,
      sel
    );

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await mobile.fill('input[type="email"]', EMAIL);
  await mobile.fill('input[type="password"]', PASSWORD);
  await mobile.click('button[type="submit"]');
  await mobile.waitForTimeout(3200);
  await mobile.goto(`${BASE}/reader`, { waitUntil: "networkidle" });
  await mobile.waitForTimeout(2600);

  record(
    "R-05",
    "移动端无横向溢出",
    !(await mobile.evaluate(() => document.body.scrollWidth > window.innerWidth + 2)),
    `scrollWidth=${await mobile.evaluate(() => document.body.scrollWidth)}`
  );
  record("R-06", "移动端首屏只显示侧栏", (await visibleCount(mobile, "button.w-full.text-left")) === 0);
  record(
    "R-07",
    "移动端不显示桌面折叠按钮",
    (await visibleCount(mobile, 'button[aria-label="折叠列表"], button[aria-label="展开列表"]')) === 0
  );

  // 底部导航是 fixed 定位、不占文档流，任何「贴着屏幕底部」的控件都必须
  // 自己让出这块高度。阅读器左下角的「导航与设置」入口就踩过这个坑：
  // 它钉在侧栏列底部，正好落在导航条底下 —— 视觉上看得见、点上去被
  // 导航接走（playwright 报 "subtree intercepts pointer events"）。
  // 必须在这一步量（此时侧栏可见），点进正文后侧栏被隐藏，rect 会变成 0，
  // 断言就退化成一个空验证。
  const dockGeo = await mobile.evaluate(() => {
    const dock = document.querySelector('button[title="导航与设置"]');
    const nav = [...document.querySelectorAll("nav")].find(
      (n) => getComputedStyle(n).position === "fixed"
    );
    if (!dock || !nav) return null;
    const d = dock.getBoundingClientRect();
    const n = nav.getBoundingClientRect();
    if (d.width === 0 || d.height === 0) return null;
    return {
      gap: Math.round(n.top - d.bottom),
      overlap: Math.max(0, Math.min(d.bottom, n.bottom) - Math.max(d.top, n.top)),
    };
  });
  record(
    "R-11",
    "移动端左下角入口不被底部导航遮挡",
    Boolean(dockGeo) && dockGeo.overlap === 0 && dockGeo.gap >= 0,
    dockGeo ? `间距 ${dockGeo.gap}px，重叠 ${dockGeo.overlap}px` : "dock 不可见或找不到导航条"
  );

  // 不能写死某个源名：全新克隆的库里只有 seed 的 3 个源，
  // 老库里可能有几十个。取第一个订阅源条目即可。
  //
  // 用 `button:has(div.rounded-md)` 而不是按文字或 svg 图标定位：
  // 源条目里那个圆角方块是「有 icon 就用 img、没有就用首字母」的容器，
  // 只出现在源行上；顶部导航项用的是 lucide 图标，不会命中。
  const feedEntry = mobile.locator("button:has(div.rounded-md)").first();
  if ((await feedEntry.count()) > 0) {
    await feedEntry.click();
    await mobile.waitForTimeout(2400);

    const listVisible = await visibleCount(mobile, "button.w-full.text-left");
    const hasArticle = await mobile.evaluate(() => document.querySelector("article") !== null);
    record("R-08", "移动端点源后停在列表（不自动进正文）", listVisible > 0 && !hasArticle, `${listVisible} 条`);

    if (listVisible > 0) {
      await mobile.locator("button.w-full.text-left").first().click();
      await mobile.waitForTimeout(2000);
      record(
        "R-09",
        "移动端点文章进入正文",
        await mobile.evaluate(() => document.querySelector("article") !== null)
      );

      const backBtn = mobile.locator('button[aria-label="返回列表"]').first();
      if ((await backBtn.count()) > 0) {
        await backBtn.click();
        await mobile.waitForTimeout(1600);
        record(
          "R-10",
          "移动端返回列表后正文让位",
          await mobile.evaluate(() => document.querySelector("article") === null)
        );
      } else {
        record("R-10", "移动端有返回列表按钮", false, "没找到");
      }
    }
  } else {
    record("R-08", "移动端左栏有订阅源可点", false, "左栏没有可点的订阅源");
  }
  await mobile.close();

  // 桌面宽度单独再验一次（移动端 page 改了视口，桌面判断要用新 page）
  const desktop = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await desktop.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await desktop.fill('input[type="email"]', EMAIL);
  await desktop.fill('input[type="password"]', PASSWORD);
  await desktop.click('button[type="submit"]');
  await desktop.waitForTimeout(3000);
  await desktop.goto(`${BASE}/reader`, { waitUntil: "networkidle" });
  await desktop.waitForTimeout(2500);
  const artW = await desktop.evaluate(
    () => Math.round(document.querySelector("article")?.getBoundingClientRect().width ?? 0)
  );
  record("R-01", "桌面正文宽度 > 800px", artW > 800, `article=${artW}px`);
  record(
    "R-02",
    "桌面无横向溢出",
    !(await desktop.evaluate(() => document.body.scrollWidth > window.innerWidth + 2))
  );
  record("R-03", "桌面三栏齐全", (await visibleCount(desktop, "button.w-full.text-left")) > 0);
  await desktop.close();

  // -------------------------------------------------------------------------
  // L. 登录页（一键填入演示账号）
  // -------------------------------------------------------------------------
  // 演示账号以前是把邮箱和密码平铺成两行文字，让人照着抄。现在有个
  // 「一键填入」按钮 —— 这条守住它真的把两个字段都填上了，否则新手
  // 会看到按钮、点了没反应，比没有按钮更糟。
  const loginPage = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await loginPage.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  const fillBtn = loginPage.locator('button:has-text("一键填入")');
  if ((await fillBtn.count()) > 0) {
    await fillBtn.click();
    await loginPage.waitForTimeout(400);
    const filled = await loginPage.evaluate(() => ({
      email: (document.querySelector('input[type="email"]')).value || "",
      pw: (document.querySelector('input[type="password"]')).value || "",
    }));
    record(
      "L-02",
      "演示账号可一键填入",
      filled.email.length > 0 && filled.pw.length > 0,
      `${filled.email} / ${filled.pw ? "已填" : "空"}`
    );
    // 断言必须落在「真的登进去了」：只检查表单存在等于永远通过。
    await loginPage.click('button[type="submit"]');
    let loggedIn = true;
    try {
      await loginPage.waitForURL(/\/reader/, { timeout: 15000 });
    } catch {
      loggedIn = false;
    }
    record(
      "L-03",
      "一键填入后可直接登录",
      loggedIn,
      loggedIn ? loginPage.url().replace(BASE, "") : "15 秒内没跳到 /reader"
    );
  } else {
    record("L-02", "登录页有演示账号入口", false, "没找到一键填入按钮");
  }
  await loginPage.close();

  // -------------------------------------------------------------------------
  // Z. 页面导航与外壳一致性
  // -------------------------------------------------------------------------
  // 改造前 7 个次级页面各画各的顶栏（三种高度、两套导航语言）。
  // 这一组守住「统一」这件事本身 —— 它很容易在下一次改版里悄悄退回原状，
  // 而且退回去以后页面仍然"能看"，只是又变成三种高度。
  {
    const inner = { width: 1440, height: 900 };
    const zp = await browser.newPage({ viewport: inner });
    // 登录一次
    await zp.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await zp.fill('input[type="email"]', EMAIL);
    await zp.fill('input[type="password"]', PASSWORD);
    await Promise.all([
      zp.waitForURL(/reader/, { timeout: 25000 }).catch(() => {}),
      zp.click('button[type="submit"]'),
    ]);
    await zp.waitForTimeout(2500);

    // Z-01 / Z-02：逐页量顶栏高度、查返回入口。
    // 「我的」是主入口，本来就不该有返回箭头 —— 断言要按这个区别对待，
    // 而不是一刀切要求都有返回。
    const pages = [
      { path: "/favorites", back: true },
      { path: "/history", back: true },
      { path: "/notifications", back: true },
      { path: "/settings", back: true },
      { path: "/subscriptions", back: true },
      { path: "/market", back: true },
      { path: "/help", back: true },
      { path: "/profile", back: false },
    ];
    const heights = [];
    const backMiss = [];
    for (const p of pages) {
      await zp.goto(`${BASE}${p.path}`, { waitUntil: "networkidle" });
      await zp.waitForTimeout(700);
      const m = await zp.evaluate(() => {
        const h = document.querySelector("header");
        const r = h?.getBoundingClientRect();
        const hasBack = Boolean(document.querySelector('header a[aria-label="返回"]'));
        return { height: r ? Math.round(r.height) : 0, hasBack };
      });
      heights.push({ path: p.path, height: m.height });
      if (p.back && !m.hasBack) backMiss.push(p.path);
      if (!p.back && m.hasBack) backMiss.push(`${p.path}(不该有返回)`);
    }
    const distinct = [...new Set(heights.map((h) => h.height))];
    record(
      "Z-01",
      "次级页面顶栏高度一致",
      distinct.length === 1 && distinct[0] === 57,
      `高度集合 ${distinct.join("/")}px（${heights.length} 个页面）`
    );
    record(
      "Z-02",
      "次级页面返回入口符合预期",
      backMiss.length === 0,
      backMiss.length ? `不符合：${backMiss.join(", ")}` : "「我的」无返回，其余均有"
    );

    // Z-03：移动端底部导航在任意次级页面都常驻。
    // 改造前它只在 4 个 href 上渲染，进订阅管理/历史/通知/设置就完全没导航。
    // 注意：必须用 isMobile context 复用登录态。browser.newPage() 会开一个
    // 全新的 context（没有任何 cookie），进去只会被 AuthGuard 弹到登录页，
    // 那样断言 "底部导航 0 项" 测的是登录页而不是次级页面。
    const mctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      storageState: await zp.context().storageState(),
    });
    const zm = await mctx.newPage();
    await zm.goto(`${BASE}/reader`, { waitUntil: "networkidle" });
    await zm.waitForTimeout(1500);
    const navMiss = [];
    for (const path of ["/subscriptions", "/history", "/notifications", "/settings", "/help"]) {
      await zm.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      await zm.waitForTimeout(600);
      const n = await zm.evaluate(() => {
        const nav = [...document.querySelectorAll("nav")].find(
          (x) => getComputedStyle(x).position === "fixed"
        );
        return nav ? nav.querySelectorAll("a").length : 0;
      });
      if (n !== 5) navMiss.push(`${path}(${n}项)`);
    }
    record(
      "Z-03",
      "移动端底部导航在所有页面常驻",
      navMiss.length === 0,
      navMiss.length ? navMiss.join(", ") : "5 个次级页面均为 5 项"
    );
    await zm.close();
    await mctx.close();

    // Z-04：收藏/历史点标题进站内阅读器（改造前是 window.open 跳原站，
    // 用户一点就离开了产品）。
    // 收藏为空时这条用例会永远"跳过" —— 跳过等于没测。先确保至少有一篇收藏：
    // 取阅读器列表第一篇，调收藏接口（幂等，已收藏再收藏不会出错）。
    await zp.goto(`${BASE}/favorites`, { waitUntil: "networkidle" });
    await zp.waitForTimeout(1000);
    // 两个坑都踩过：
    //  1. 标题是 <h3 onClick>，不包在 button 里 —— button:has(h3) 永远数到 0
    //  2. 空状态提示也是 <h3 className="text-lg font-medium">，
    //     用 h3.font-medium 会把它选中，点了当然没反应（全新库上就是这么挂的）。
    //     只有列表里的文章标题带 line-clamp-2 + cursor-pointer。
    const TITLE_SEL = "h3.line-clamp-2";
    const favCount = await zp.evaluate(
      (sel) => document.querySelectorAll(sel).length,
      TITLE_SEL
    );
    if (favCount === 0) {
      const seeded = await zp.evaluate(async () => {
        const r = await fetch("/api/articles?page=1&pageSize=1");
        const j = await r.json();
        // 返回的是 data.articles，不是 data.items
        const id = j?.data?.articles?.[0]?.id;
        if (!id) return null;
        const f = await fetch(`/api/articles/${id}/favorite`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        return f.ok ? id : null;
      });
      if (seeded) {
        await zp.goto(`${BASE}/favorites`, { waitUntil: "networkidle" });
        await zp.waitForTimeout(1200);
      }
    }
    const favTitle = zp.locator(TITLE_SEL).first();
    if ((await favTitle.count()) > 0) {
      // 不能断言 URL 里一直保留 ?articleId= —— 深链处理后阅读器会把地址栏
      // 换回 /reader（否则换下一篇时地址栏还是旧 id，刷新会跳回去）。
      // 真正要守的是「点收藏标题，进来的是同一篇文章」，所以比标题。
      const wantTitle = (await favTitle.innerText()).trim();
      await favTitle.click();
      await zp.waitForTimeout(2500);
      const landed = await zp.evaluate(() => ({
        path: location.pathname,
        h1: document.querySelector("h1")?.innerText?.trim() || "",
      }));
      const same = landed.h1 && wantTitle && (landed.h1.includes(wantTitle.slice(0, 12)) || wantTitle.includes(landed.h1.slice(0, 12)));
      record(
        "Z-04",
        "收藏点标题进站内阅读器",
        landed.path === "/reader" && Boolean(same),
        `${landed.path} · ${landed.h1.slice(0, 24)}`
      );
    } else {
      record("Z-04", "收藏页有可点文章", false, "收藏夹为空，跳过");
    }

    // Z-07 / NEW：页面加载不请求第三方图标服务。
    // 之前订阅源缺图时回落到 api.dicebear.com —— 内网部署会被墙，
    // 断网裂图，还把「谁订阅了什么」的标题泄给第三方。
    const thirdParty = new Set();
    const zp2 = await browser.newPage({ viewport: inner });
    zp2.on("request", (r) => {
      try {
        const u = new URL(r.url());
        if (!["127.0.0.1", "localhost"].includes(u.hostname) && !u.hostname.endsWith("ithome.com")) {
          thirdParty.add(u.hostname);
        }
      } catch {}
    });
    await zp2.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await zp2.fill('input[type="email"]', EMAIL);
    await zp2.fill('input[type="password"]', PASSWORD);
    await Promise.all([
      zp2.waitForURL(/reader/, { timeout: 25000 }).catch(() => {}),
      zp2.click('button[type="submit"]'),
    ]);
    await zp2.waitForTimeout(2000);
    await zp2.goto(`${BASE}/market`, { waitUntil: "networkidle" });
    await zp2.waitForTimeout(2000);
    await zp2.goto(`${BASE}/subscriptions`, { waitUntil: "networkidle" });
    await zp2.waitForTimeout(1500);
    record(
      "Z-07",
      "不请求第三方图标服务",
      !thirdParty.has("api.dicebear.com"),
      thirdParty.size ? `外部域名：${[...thirdParty].join(", ")}` : "无外部图标请求"
    );
    await zp2.close();
    await zp.close();
  }

  // -------------------------------------------------------------------------
  // A-AUTH. 认证页面外壳与条款
  // -------------------------------------------------------------------------
  // 四个认证页原本各写一套：登录/注册是纯色图标 + 灰底，忘记/重置密码是
  // 渐变 Logo + 蓝紫渐变底 + Card。统一走 AuthShell 之后，
  // 这里守住「四个页面是同一个产品」这件事。
  {
    const ap = await browser.newPage({ viewport: { width: 1440, height: 950 } });
    const authPages = ["/login", "/register", "/forgot-password", "/reset-password"];
    const widths = [];
    const titles = [];
    for (const p of authPages) {
      await ap.goto(`${BASE}${p}`, { waitUntil: "networkidle" });
      await ap.waitForTimeout(500);
      const m = await ap.evaluate(() => {
        // AuthShell 的卡片是 rounded-2xl 的白框
        const card = document.querySelector(".rounded-2xl");
        const r = card?.getBoundingClientRect();
        return {
          w: r ? Math.round(r.width) : 0,
          h1: document.querySelector("h1")?.innerText?.trim() || "",
          // 渐变蓝紫底已废弃：现在统一暖灰
          gradient: Boolean(document.querySelector('[class*="from-blue-50"]')),
        };
      });
      widths.push(m.w);
      titles.push(m.h1);
      if (m.gradient) widths.push(-1); // 用负数标记回归
    }
    const uniqW = [...new Set(widths)];
    record(
      "Z-08",
      "四个认证页卡片宽度一致",
      uniqW.length === 1 && uniqW[0] > 0,
      `宽度集合 ${uniqW.join("/")}px`
    );
    record(
      "Z-09",
      "四个认证页都有页面标题",
      titles.every((t) => t.length > 0 && t.length < 12),
      titles.join(" / ")
    );

    // NEW2：注册页的协议链接必须指向真实页面。
    // 之前是 href="#" —— 用户被迫勾选「我已阅读并同意」，而协议根本不存在。
    await ap.goto(`${BASE}/register`, { waitUntil: "networkidle" });
    await ap.waitForTimeout(500);
    const hrefs = await ap.evaluate(() =>
      [...document.querySelectorAll("a")].map((a) => a.getAttribute("href")).filter(Boolean)
    );
    const dead = hrefs.filter((h) => h === "#" || h === "");
    record(
      "Z-10",
      "注册页无死链（协议链接指向真实页面）",
      dead.length === 0 && hrefs.some((h) => h.startsWith("/terms")),
      dead.length ? `仍有 ${dead.length} 个 href="#"` : "协议链接指向 /terms"
    );

    // NEW3：条款页可访问且两节都在
    await ap.goto(`${BASE}/terms`, { waitUntil: "networkidle" });
    await ap.waitForTimeout(500);
    const terms = await ap.evaluate(() => ({
      h1: document.querySelector("h1")?.innerText || "",
      sections: document.querySelectorAll("section").length,
    }));
    record(
      "Z-11",
      "条款与隐私页可访问",
      terms.h1.includes("条款") && terms.sections >= 2,
      `${terms.h1} · ${terms.sections} 节`
    );

    // NEW-PW：注册页的密码要求必须与服务端一致。
    // 原先列了「包含大写字母」「包含特殊字符」，但 registerSchema 并不要求，
    // 用户看到打叉的条目会以为密码不合法，把本来能用的密码改复杂。
    await ap.goto(`${BASE}/register`, { waitUntil: "networkidle" });
    await ap.waitForTimeout(500);
    await ap.fill("#password", "abc12345");
    await ap.waitForTimeout(700);
    const pwUI = await ap.evaluate(() => {
      const box = document.querySelector("#password-requirements");
      if (!box) return { rows: [], text: "" };
      const rows = [...box.querySelectorAll("div")].filter((d) =>
        d.className.includes("flex items-center gap-2 text-xs")
      );
      return {
        rows: rows.map((r) => ({ t: r.innerText.trim(), ok: !!r.querySelector("svg.text-green-500") })),
        text: box.innerText,
      };
    });
    const allGreen = pwUI.rows.length > 0 && pwUI.rows.every((r) => r.ok);
    const noPhantom = !/大写|特殊字符/.test(pwUI.text);
    record(
      "Z-13",
      "注册页密码要求与服务端一致",
      allGreen && noPhantom,
      allGreen
        ? noPhantom
          ? `${pwUI.rows.length} 项全通过，无多余要求`
          : "仍要求后端不要求的项"
        : `未全部通过：${pwUI.rows.filter((r) => !r.ok).map((r) => r.t).join("/") || "无清单"}`
    );

    // NEW4：首页对已登录用户直接进阅读器。
    // 之前已登录访问 / 仍然看到「开始使用/注册」，点了被 AuthGuard 弹回来。
    await ap.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await ap.fill('input[type="email"]', EMAIL);
    await ap.fill('input[type="password"]', PASSWORD);
    await Promise.all([
      ap.waitForURL(/reader/, { timeout: 25000 }).catch(() => {}),
      ap.click('button[type="submit"]'),
    ]);
    await ap.waitForTimeout(2000);
    await ap.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await ap.waitForTimeout(1500);
    record(
      "Z-12",
      "已登录访问首页直接进阅读器",
      /\/reader/.test(ap.url()),
      ap.url().replace(BASE, "")
    );
    await ap.close();
  }

  // 恢复默认，避免影响下次运行
  await page.evaluate((key) => localStorage.removeItem(key), prefKey);

  await browser.close();

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n\x1b[1m结果：${passed}/${results.length} 通过\x1b[0m` +
      (failed.length ? `，\x1b[31m${failed.length} 失败\x1b[0m` : "")
  );
  if (failed.length) {
    for (const f of failed) console.log(`  ${f.id}  ${f.name}  ${f.detail}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n\x1b[31m执行中断：\x1b[0m", error);
  process.exit(1);
});
