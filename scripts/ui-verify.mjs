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

  const themeBtn = page.locator('button[title="阅读主题"]').first();
  if (await themeBtn.count()) {
    await themeBtn.click();
    await page.waitForTimeout(700);
    const items = await page.locator('[role="menuitem"]').allInnerTexts();
    record("G-01", "主题下拉含四档", items.length >= 4, items.join(" / "));

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

      // 恢复成浅色，别影响后续用例与人工查看
      await page.locator('button[title="阅读主题"]').first().click();
      await page.waitForTimeout(600);
      await page.locator('[role="menuitem"]').filter({ hasText: "浅色" }).first().click();
      await page.waitForTimeout(600);
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
  const readBadge = () =>
    page.evaluate(() => {
      const el = [...document.querySelectorAll("span")].find((s) =>
        String(s.className).includes("bg-[#c9a962]")
      );
      return el ? el.textContent : null;
    });

  await page.evaluate(
    (key) => localStorage.setItem(key, JSON.stringify({ showUnreadBadge: true })),
    prefKey
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  const badgeOn = await readBadge();

  await page.evaluate(
    (key) => localStorage.setItem(key, JSON.stringify({ showUnreadBadge: false })),
    prefKey
  );
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
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
