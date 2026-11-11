import nodemailer, { type Transporter } from "nodemailer";

/**
 * Kindle 推送的邮件通道。
 *
 * 背景：Kindle 的「Send to Kindle」是一个纯邮件流程 ——
 * 用户把文件作为附件发到自己的 `xxx@kindle.com`，Amazon 收到后
 * 推送到设备。所以这个功能不需要 Amazon 的 API、不需要 OAuth，
 * 只需要一个能发 SMTP 的账号。
 *
 * 为什么不用第三方服务（Mailgun/SES 等）：项目定位是「拉下来就能跑」，
 * 引一个需要注册和 API Key 的服务就违背了这个定位。SMTP 是用户
 * 自己已有的东西（Gmail 应用专用密码、QQ 邮箱授权码都行）。
 *
 * 没配 SMTP 时不报错、不崩，只是把功能标记为不可用 —— 前端据此
 * 隐藏入口并提示怎么配。让一个可选功能把整个应用搞挂是没道理的。
 */

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
}

let cachedTransporter: Transporter | null = null;
let cachedSignature = "";

/**
 * 读取 SMTP 配置。缺任何一项都返回 null（= 功能未启用）。
 */
export function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM?.trim() || user;

  if (!host || !user || !password || !from) {
    return null;
  }

  const port = Number.parseInt(process.env.SMTP_PORT || "587", 10);
  if (!Number.isFinite(port) || port <= 0) {
    return null;
  }

  // 465 是隐式 TLS（连上就是加密的），587/25 是 STARTTLS（先明文握手再升级）。
  // 这两个的区别搞反的话表现是「连接超时」或「握手失败」，很难一眼看出。
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  return { host, port, secure, user, password, from };
}

export function isKindlePushEnabled(): boolean {
  return getSmtpConfig() !== null;
}

function getTransporter(config: SmtpConfig): Transporter {
  // 配置没变就复用连接池，避免每封邮件都重新握手。
  const signature = `${config.host}:${config.port}:${config.secure}:${config.user}`;
  if (cachedTransporter && cachedSignature === signature) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    // 家庭网络连 Gmail/QQ 的 SMTP 偶尔会慢，10 秒内没建连基本就是配置错了
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  cachedSignature = signature;

  return cachedTransporter;
}

/**
 * 把文章 HTML 包成一份 Kindle 能读的独立文件。
 *
 * 为什么不直接把 HTML 塞进邮件正文：Kindle 对邮件正文的排版支持很差，
 * 而附件的 HTML 会用设备自带的阅读引擎渲染，字号、断行、翻页都正常，
 * 还能保留原文的标题层级和图片链接。
 *
 * 内联样式是刻意的 —— Kindle 的浏览器不加载外部 CSS。
 */
export function buildKindleHtml(input: {
  title: string;
  author?: string | null;
  feedTitle?: string | null;
  url: string;
  content: string;
  pubDate?: Date | null;
}): string {
  const escape = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const meta = [
    input.feedTitle,
    input.author?.trim() || null,
    input.pubDate ? input.pubDate.toISOString().slice(0, 10) : null,
  ]
    .filter(Boolean)
    .map((part) => escape(String(part)))
    .join(" · ");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>${escape(input.title)}</title>
<style>
  body { font-family: serif; line-height: 1.7; margin: 0 4%; color: #111; }
  h1 { font-size: 1.6em; line-height: 1.35; margin: 0 0 .4em; }
  .meta { color: #666; font-size: .85em; margin-bottom: 1.6em; }
  .source { border-top: 1px solid #ddd; margin-top: 2em; padding-top: .8em;
            color: #666; font-size: .85em; }
  img { max-width: 100%; height: auto; }
  pre { white-space: pre-wrap; word-wrap: break-word; background: #f5f5f5; padding: .8em; }
  blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 1em; color: #444; }
</style>
</head>
<body>
<h1>${escape(input.title)}</h1>
${meta ? `<div class="meta">${meta}</div>` : ""}
${input.content}
<div class="source">原文：${escape(input.url)}</div>
</body>
</html>`;
}

export interface SendResult {
  ok: boolean;
  error?: string;
}

/**
 * 把一篇文章作为 HTML 附件发到 Kindle 邮箱。
 *
 * 附件而不是正文：Kindle 会把 .html 附件当成一本书打开，
 * 而邮件正文会被压成一段无格式文本。
 */
export async function sendArticleToKindle(input: {
  to: string;
  title: string;
  author?: string | null;
  feedTitle?: string | null;
  url: string;
  content: string;
  pubDate?: Date | null;
}): Promise<SendResult> {
  const config = getSmtpConfig();
  if (!config) {
    return { ok: false, error: "服务端未配置 SMTP，Kindle 推送不可用" };
  }

  const html = buildKindleHtml(input);

  // 文件名会成为 Kindle 书库里的书名，所以用文章标题而不是 article.html。
  // 去掉文件系统不允许的字符，并限制长度（Kindle 对超长文件名会截断得很难看）。
  const safeName =
    input.title
      .replace(/[\\/:*?"<>|\r\n]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 80) || "article";

  try {
    await getTransporter(config).sendMail({
      from: config.from,
      to: input.to,
      subject: input.title,
      // 正文只放一句说明。真正的阅读内容在附件里。
      text: `${input.title}\n\n${input.url}\n\n（正文见附件）`,
      html: buildKindleHtml(input),
      attachments: [
        {
          filename: `${safeName}.html`,
          content: html,
          contentType: "text/html; charset=utf-8",
        },
      ],
    });

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[kindle] 推送失败:", message);

    // Amazon 的报错对普通用户完全没有可操作性，翻成人话再返回。
    if (/not configured to receive|not authorized|whitelist|approved/i.test(message)) {
      return {
        ok: false,
        error:
          "Kindle 拒收了这封邮件：请先把发件邮箱加入 Amazon 的「已批准的个人文档电子邮件列表」",
      };
    }
    if (/attachment|size|too large/i.test(message)) {
      return { ok: false, error: "邮件过大，这篇文章的图片可能太多，请尝试其他文章" };
    }
    if (/auth|credential|password/i.test(message)) {
      return { ok: false, error: "SMTP 认证失败，请检查 SMTP_USER / SMTP_PASSWORD" };
    }
    if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|timeout/i.test(message)) {
      return { ok: false, error: "连不上 SMTP 服务器，请检查 SMTP_HOST / SMTP_PORT" };
    }

    return { ok: false, error: `推送失败：${message}` };
  }
}
