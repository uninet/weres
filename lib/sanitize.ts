import * as cheerio from "cheerio";

/**
 * RSS 正文 HTML 净化（白名单制）
 *
 * 背景：RSS 正文来自第三方网站，属于完全不可信输入。原实现只是用 cheerio
 * 删掉 script/style/iframe 标签，但攻击面远不止这些：
 *   - `<img src=x onerror="...">`   事件处理器属性
 *   - `<a href="javascript:...">`    伪协议链接
 *   - `<svg><script>`                SVG 内嵌脚本
 *   - `<form>` / `<input>`           钓鱼表单
 *   - `<object>` / `<embed>`         外部内容嵌入
 *
 * 这里采用「白名单」而非「黑名单」：只保留已知安全的标签与属性，
 * 其余一律丢弃。因为黑名单永远会漏，白名单漏不出去。
 */

/** 允许保留的标签（正文排版所需的最小集合） */
const ALLOWED_TAGS = new Set([
  "p", "br", "hr", "div", "span",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s", "del", "ins", "mark", "small", "sub", "sup",
  "blockquote", "q", "cite", "pre", "code", "kbd", "samp", "var",
  "ul", "ol", "li", "dl", "dt", "dd",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  "figure", "figcaption", "img", "picture", "source",
  "a", "abbr", "time", "address",
]);

/** 需要连同内容一起删除的标签（内容本身即危险或无意义） */
const DROP_WITH_CONTENT = new Set([
  "script", "style", "iframe", "frame", "frameset", "object", "embed", "applet",
  "form", "input", "button", "select", "option", "textarea", "label", "fieldset",
  "link", "meta", "base", "title", "head", "svg", "math", "template", "noscript",
  "audio", "video", "track", "canvas", "map", "area",
]);

/** 各标签允许的属性（未列出的标签只允许通用属性） */
const GLOBAL_ATTRS = new Set(["class", "id", "dir", "lang", "title"]);
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height", "srcset", "sizes"]),
  source: new Set(["src", "srcset", "sizes", "type", "media"]),
  td: new Set(["colspan", "rowspan", "align", "valign"]),
  th: new Set(["colspan", "rowspan", "align", "valign", "scope"]),
  col: new Set(["span", "width"]),
  colgroup: new Set(["span"]),
  ol: new Set(["start", "type", "reversed"]),
  time: new Set(["datetime"]),
  blockquote: new Set(["cite"]),
  q: new Set(["cite"]),
};

/** 只允许这些协议的 URL */
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

/** style 属性里出现这些片段就整体丢弃（老 IE 表达式 / 外部加载 / 行为绑定） */
const DANGEROUS_STYLE_PATTERNS = [
  /expression\s*\(/i,
  /javascript\s*:/i,
  /vbscript\s*:/i,
  /behavior\s*:/i,
  /-moz-binding/i,
  /url\s*\(\s*['"]?\s*(?:javascript|vbscript|data:text\/html)/i,
];

/** 允许在 style 中保留的属性名（其余一律剥离，避免用 CSS 破坏页面结构） */
const ALLOWED_STYLE_PROPS = new Set([
  "color", "background-color", "font-size", "font-weight", "font-style",
  "font-family", "text-align", "text-decoration", "text-indent", "line-height",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "border", "border-top", "border-right", "border-bottom", "border-left",
  "border-collapse", "border-spacing", "width", "max-width", "min-width",
  "height", "max-height", "min-height", "display", "vertical-align",
  "white-space", "word-break", "overflow-wrap", "letter-spacing",
  "list-style", "list-style-type", "list-style-position",
]);

/**
 * 判断 URL 是否安全。
 * 相对路径（/foo、./foo、#anchor）一律允许，绝对路径必须落在 SAFE_PROTOCOLS。
 */
function isSafeUrl(rawUrl: string): boolean {
  const url = rawUrl.trim();
  if (!url) return false;

  // 空协议 / 相对地址 / 锚点
  if (/^(\/|\.\/|\.\.\/|#|\?)/.test(url)) return true;
  // 没有协议头的相对地址，如 "image.png"
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) return true;

  try {
    const parsed = new URL(url);
    return SAFE_PROTOCOLS.has(parsed.protocol);
  } catch {
    return false;
  }
}

/** 过滤 style 属性：逐条声明校验属性名与值 */
function sanitizeStyle(rawStyle: string): string {
  for (const pattern of DANGEROUS_STYLE_PATTERNS) {
    if (pattern.test(rawStyle)) return "";
  }

  const kept: string[] = [];
  for (const declaration of rawStyle.split(";")) {
    const trimmed = declaration.trim();
    if (!trimmed) continue;

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const prop = trimmed.slice(0, colonIndex).trim().toLowerCase();
    const value = trimmed.slice(colonIndex + 1).trim();

    if (!ALLOWED_STYLE_PROPS.has(prop)) continue;
    if (!value) continue;
    // 值里再拦一次危险片段
    if (/javascript\s*:|expression\s*\(|behavior\s*:/i.test(value)) continue;
    // 禁止外部资源加载（CSS 里也能发请求）
    if (/url\s*\(/i.test(value)) continue;

    kept.push(`${prop}: ${value}`);
  }

  return kept.join("; ");
}

/**
 * 我们真正用到的 DOM 节点形状（只读两个字段）。
 *
 * 为什么不用 cheerio 的类型：cheerio 1.x 起不再从包根导出 `Element`，
 * 那个类型属于它的传递依赖 domhandler。直接 import domhandler 会把
 * 一个我们从未依赖过的包变成项目的直接依赖，cheerio 内部换实现时
 * 就会连带编译失败。而 `as any` 又会把这一整块净化逻辑的类型保护
 * 全部关掉 —— 偏偏这是最不该失去类型保护的安全代码。
 *
 * 折中做法：入参标成 `unknown`（cheerio 回调里它确实是 unknown），
 * 在函数内部一次性收窄到下面这个最小形状。要读的字段只有 tagName
 * 和 attribs，其余一概不碰。
 */
interface DomElementNode {
  tagName?: string;
  attribs?: Record<string, string>;
}

/** 把 unknown 收窄成 cheerio 各方法接受的节点实参类型 */
type CheerioNodeArg = Parameters<cheerio.CheerioAPI>[0];

/** 清理单个元素的属性 */
function sanitizeAttributes(
  $: cheerio.CheerioAPI,
  element: unknown
): void {
  const node = element as DomElementNode;
  // 包成 jQuery 风格对象后，所有属性操作都走 cheerio 自己的实现
  const $el = $(element as CheerioNodeArg);

  const tagName = node.tagName?.toLowerCase() ?? "";
  const attribs: Record<string, string> = { ...(node.attribs ?? {}) };
  const allowedForTag = TAG_ATTRS[tagName];

  for (const attrName of Object.keys(attribs)) {
    const lower = attrName.toLowerCase();
    const value = attribs[attrName] ?? "";

    // 事件处理器（onclick / onerror / onload ...）一律删除
    if (lower.startsWith("on")) {
      $el.removeAttr(attrName);
      continue;
    }

    if (lower === "style") {
      const cleaned = sanitizeStyle(value);
      if (cleaned) {
        $el.attr("style", cleaned);
      } else {
        $el.removeAttr(attrName);
      }
      continue;
    }

    const isGlobal = GLOBAL_ATTRS.has(lower);
    const isTagAllowed = allowedForTag?.has(lower) ?? false;
    if (!isGlobal && !isTagAllowed) {
      $el.removeAttr(attrName);
      continue;
    }

    // URL 类属性做协议校验
    if (lower === "href" || lower === "src" || lower === "cite") {
      if (!isSafeUrl(value)) {
        $el.removeAttr(attrName);
      }
      continue;
    }

    if (lower === "srcset") {
      const safeEntries = value
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => {
          const url = entry.split(/\s+/)[0];
          return url ? isSafeUrl(url) : false;
        });
      if (safeEntries.length > 0) {
        $el.attr("srcset", safeEntries.join(", "));
      } else {
        $el.removeAttr(attrName);
      }
      continue;
    }

    // data-* 在正文里没有意义，且有被前端脚本读取的风险，统一清掉
    if (lower.startsWith("data-")) {
      $el.removeAttr(attrName);
      continue;
    }
  }

  // 外链统一加固：新窗口打开 + 断开 opener
  if (tagName === "a") {
    const href = $el.attr("href");
    if (href) {
      $el.attr("target", "_blank");
      $el.attr("rel", "noopener noreferrer nofollow");
    } else {
      // 没有 href 的 <a> 退化成纯文本容器
      $el.removeAttr("target");
      $el.removeAttr("rel");
    }
  }
}

/**
 * 净化 RSS 正文 HTML。
 *
 * @param html 来自 RSS 的原始 HTML（不可信）
 * @returns 只含白名单标签与属性的安全 HTML
 */
export function sanitizeArticleHtml(html: string | null | undefined): string {
  if (!html) return "";

  // cheerio.load 默认按 HTML 片段解析，不会执行任何脚本
  const $ = cheerio.load(html, null, false);

  // 1. 先删除「连内容一起丢弃」的标签
  $(Array.from(DROP_WITH_CONTENT).join(",")).remove();

  // 2. 注释节点也清掉（可能藏条件注释）
  $("*")
    .contents()
    .filter((_, node) => node.type === "comment")
    .remove();

  // 3. 逐个元素：处理不在白名单里的标签 + 清理属性
  $("*").each((_, element) => {
    const tagName = (element as { tagName?: string }).tagName?.toLowerCase();

    // 不是元素节点（文本 / 注释）跳过
    if (!tagName) return;

    if (!ALLOWED_TAGS.has(tagName)) {
      // 未知标签：拆壳保留内部文本内容，避免整段文字被吞掉
      $(element).replaceWith($(element).contents());
      return;
    }

    sanitizeAttributes($, element);
  });

  return $.html();
}

/**
 * 净化纯文本字段（标题 / 作者 / 描述等）。
 * 这些字段会进 React 的文本节点，本身不会被当 HTML 解析，
 * 但线上确实出现过列表里显示 `<p data-vmark="…">` 的情况 ——
 * 那说明某些源的 description 字段里塞的是 HTML 片段。
 * 所以这里除了去控制字符，还要把 HTML 标签整个剥掉，
 * 否则用户在列表里看到的是标签源码而不是摘要。
 */
export function sanitizePlainText(text: string | null | undefined, maxLength = 1000): string {
  if (!text) return "";

  // 去掉标签与其内部不可见内容，再解码常见实体，最后压平空白。
  const stripped = text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  return stripped.length > maxLength ? stripped.slice(0, maxLength) : stripped;
}

/**
 * 去掉正文开头重复的那份标题。
 *
 * 大量公众号/资讯站导出正文时会把标题连同「来源/作者/日期」一起写进
 * HTML 里。阅读器自己在正文上方已经渲染了一次标题，于是用户看到的是
 * 同一个大标题连着出现两遍 —— 第二遍还带着原文站点的排版（字号、颜色、
 * 分隔线），像一篇文章里嵌了另一篇文章的页头。
 *
 * 只处理「开头这几个块级元素里，textContent 与标题完全相同」的那一个：
 *   - 用规范化后的文本比对（去空白、去零宽字符），避免标题里有换行或
 *     全角空格时匹配不上；
 *   - 要求该元素的文本不包含别的有效内容（文本长度与标题接近），
 *     否则会误删「标题 + 摘要」合在一个 div 里的情况；
 *   - 只从前往后扫，最多看前 8 个顶层元素 —— 正文中间的标题是分节标题，
 *     那是内容本身，不能动。
 */
export function stripLeadingDuplicateTitle(html: string, title: string): string {
  const normalizedTitle = normalizeForCompare(title);
  if (!html || normalizedTitle.length < 4) return html;

  const $ = cheerio.load(html);
  const root = $("body");

  // 按文档顺序遍历，但一旦遇到「非标题的正文」就停手。
  // 各站的嵌套层级千差万别：有的标题是最外层 div，有的被埋在
  // 「居中容器 > 页头 > 标题行」三层里，只认顶层元素会漏。
  let consumedContent = 0;

  for (const element of root.find("*").toArray()) {
    if (consumedContent > 200) break; // 已经进入正文，后面的是分节标题

    const $el = $(element);
    // 有块级子元素说明这不是一个「只放标题」的容器
    const hasBlockChildren = $el.children("div, p, section, article, table, ul, ol").length > 0;
    if (hasBlockChildren) continue;

    const text = normalizeForCompare($el.text());
    if (!text) continue;

    const isTitleOnly =
      text === normalizedTitle ||
      (text.startsWith(normalizedTitle) && text.length <= normalizedTitle.length + 3);

    if (isTitleOnly) {
      $el.remove();
      break;
    }

    // 这段不是标题，累积它的正文量；超过阈值就判定「已经进正文了」
    consumedContent += text.length;
  }

  return root.html() ?? html;
}

/** 比对用规范化：去零宽字符、去所有空白、统一大小写。 */
function normalizeForCompare(input: string): string {
  return input
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}
