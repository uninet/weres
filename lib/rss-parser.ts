import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import type { Feed } from '@prisma/client';
import { prisma } from './prisma';
import { sanitizeArticleHtml, stripLeadingDuplicateTitle } from './sanitize';
import { assertSafeOutboundUrl, fetchTextWithSafety, fetchWithSafety } from './url-safety';
import { notifyFeedUpdates } from './notify';

/**
 * 抓 RSS 时用的请求头。
 *
 * 抽成常量是为了让 `fetchWithSafety` 和 rss-parser 内部用同一套 ——
 * 现在真正的网络请求由我们自己发（要逐跳校验重定向），
 * rss-parser 只负责解析字符串。
 */
const RSS_BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    // 绝对不要在这里声明 Accept-Encoding。
    //
    // rss-parser 3.x 内部用 node 的 http.get 拿响应，然后用
    // `res.setEncoding()` 把字节流当字符串拼起来直接喂给 XML 解析器，
    // **从不解压**。一旦声明了 "gzip, deflate, br"，服务器就会返回
    // 压缩后的字节，解析器读到的是二进制垃圾，报错：
    //   Non-whitespace before first tag. Line: 0 Column: 1
    //
    // 后果是几乎所有真实源（阮一峰、少数派、大量基于 CDN 的博客）
    // 都订阅失败，只有恰好没开压缩的源能成功 —— 表现为「有时能加、
    // 有时加不上」，很难定位。省略该头，node 默认不带 Accept-Encoding，
    // 服务器返回明文，解析正常。
  'Cache-Control': 'no-cache',
};

const parser = new Parser({
  // rss-parser 只做字符串解析，真正的网络请求由 fetchWithSafety 发起
  // （它逐跳校验重定向目标）。这里保留 headers 仅为 plainParser 复用。
  headers: RSS_BROWSER_HEADERS,
  timeout: 20000,
  customFields: {
    item: [
      'content:encoded',
      'description',
      'summary',
      'dc:creator',
      'author',
      'creator',
      'id',
      // 缩略图来源：不同站用的字段完全不一样，全都收进来，
      // 由 extractImageUrl() 按优先级挑一个。
      //   enclosure / media:content / media:thumbnail —— RSS 与 Media RSS 标准
      //   image / og:image —— 部分站自造的
      'enclosure',
      'media:content',
      'media:thumbnail',
      'image',
    ],
  },
});

/**
 * 单个源的同步结果。
 *
 * 之前这里是 `any[]`，导致 `/api/feeds/sync` 只能盲取值 ——
 * 字段名写错（比如把 newArticles 写成 count）编译器不会说话，
 * 接口就静默返回 undefined，前端显示「同步成功，新增 undefined 篇」。
 */
export interface FeedSyncResult {
  success: boolean;
  message: string;
  count: number;
}

/** 批量同步结果，比 FeedSyncResult 多了两个用于展示的字段。 */
export interface BatchSyncResult extends FeedSyncResult {
  feedId: string;
  feedTitle: string;
}

export interface RSSItem {
  title?: string;
  link?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  author?: string;
  guid?: string;
  isoDate?: string;
  'content:encoded'?: string;
  description?: string;
  'dc:creator'?: string;
  imageUrl?: string;
  enclosure?: { $?: { url?: string; type?: string } } | { url?: string; type?: string };
  'media:content'?: { $?: { url?: string } } | Array<{ $?: { url?: string } }>;
  'media:thumbnail'?: { $?: { url?: string } } | Array<{ $?: { url?: string } }>;
  image?: string | { $?: { href?: string } };
}

/**
 * 从一条 RSS 条目里尽量找出一张缩略图。
 *
 * 不同站点放的字段完全不一样，按可靠性排序挨个试：
 *   1. enclosure —— 标准字段，附图/音频，有 type 时确认是图片
 *   2. media:content / media:thumbnail —— Media RSS，播客站和大站常用
 *   3. image / og:image 一类自造字段
 *   4. 正文里第一张 <img> —— 兜底，绝大多数图文博客命中这条
 *
 * 只接受 http(s)，过滤掉 data: URI（可能是超长内联图）和相对路径
 * （没有 base 就无法解析成可用地址）。
 */
function extractImageUrl(item: RSSItem, contentHtml: string): string | undefined {
  const asUrl = (v: unknown): string | undefined => {
    if (typeof v === 'string') return v;
    if (v && typeof v === 'object') {
      const obj = v as { $?: { url?: string; href?: string }; url?: string };
      return obj.$?.url || obj.$?.href || obj.url;
    }
    return undefined;
  };

  const candidates: Array<string | undefined> = [];

  // 1. enclosure（数组或单值都可能是）
  if (Array.isArray(item.enclosure)) {
    for (const e of item.enclosure) candidates.push(asUrl(e));
  } else {
    const enc = item.enclosure as { url?: string; type?: string; $?: { url?: string; type?: string } } | undefined;
    const encUrl = enc?.$?.url || enc?.url;
    const encType = enc?.$?.type || enc?.type;
    // 有 type 且明确不是图片就跳过（音频/视频播客）
    if (encUrl && (!encType || encType.startsWith('image/'))) candidates.push(encUrl);
  }

  // 2. Media RSS
  for (const key of ['media:content', 'media:thumbnail'] as const) {
    const val = item[key];
    if (Array.isArray(val)) val.forEach((v) => candidates.push(asUrl(v)));
    else candidates.push(asUrl(val));
  }

  // 3. 自造字段
  candidates.push(asUrl(item.image));

  for (const c of candidates) {
    if (c && /^https?:\/\//i.test(c)) return c;
  }

  // 4. 正文第一张图
  if (contentHtml) {
    const $ = cheerio.load(contentHtml);
    const first = $('img').first();
    const src = first.attr('src') || first.attr('data-src') || first.attr('data-original');
    if (src && /^https?:\/\//i.test(src)) return src;
  }

  return undefined;
}

export interface RSSFeed {
  title?: string;
  description?: string;
  link?: string;
  language?: string;
  lastBuildDate?: string;
  icon?: string;
  items: RSSItem[];
}

/**
 * 解析 RSS 源
 */
/**
 * 用「不带浏览器 UA」的解析器再试一次。
 *
 * 为什么需要它：一部分站点会按 User-Agent 做内容协商 ——
 * 看到完整 Chrome UA 就返回渲染好的 HTML 页面，看到普通 UA 才返回 RSS。
 * 机核（gcores.com）就是这种：
 *   完整 Chrome UA → 200, text/html, 16KB  ← 拿去当 XML 解析必然失败
 *   简单 UA        → 200, application/xml, 94KB
 * 表现为「订阅这个源必报 Invalid character in tag name」，
 * 而 curl 手动抓同一地址却是好的（curl 的 UA 不是浏览器 UA）。
 */
/**
 * 朴素请求头：不发浏览器特征，让站点走「给程序看的」那条分支。
 * 部分站点（机核）按 UA 做内容协商，浏览器 UA 拿到的是 HTML。
 */
const PLAIN_HEADERS: Record<string, string> = {
  // 刻意用最朴素的 UA：不发 Accept、不发 Accept-Language，
  // 让站点走「给程序看的」那条分支。
  'User-Agent': 'WeRSS/1.0 (+https://github.com/uninet)',
  'Accept': 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.9, */*;q=0.8',
};

const plainParser = new Parser({
  headers: PLAIN_HEADERS,
  timeout: 20000,
  customFields: {
    item: [
      'content:encoded',
      'description',
      'summary',
      'dc:creator',
      'author',
      'creator',
      'id',
      'enclosure',
      'media:content',
      'media:thumbnail',
      'image',
    ],
  },
});

/**
 * 判断一段内容像不像 RSS/Atom（而不是 HTML 页面）。
 * 只看开头几百个字符，避免大文件全量正则。
 */
function looksLikeFeed(text: string): boolean {
  const head = text.slice(0, 800).trimStart().toLowerCase();
  if (head.startsWith('<?xml')) return true;
  return head.startsWith('<rss') || head.startsWith('<feed') || head.startsWith('<rdf');
}

/**
 * 解析 RSS 源。
 *
 * 先用浏览器 UA 试（多数站点给这种 UA 的是标准 feed），
 * 失败时再用朴素 UA 重试一次 —— 覆盖「按 UA 返回 HTML」的站点。
 */
export async function parseRSS(url: string): Promise<RSSFeed> {
  // 这里是所有 RSS 抓取的总入口（验证订阅源、新增订阅、OPML 导入、
  // 定时同步都走它），所以 SSRF 防护放在这一层最彻底。
  //
  // 不用 parser.parseURL()：它内部自己跟重定向，只校验首跳等于没校验 ——
  // 一个公网 URL 返回 302 到 169.254.169.254，就能让服务端去读云元数据
  // （实测可拿到内网内容）。改为「自己取正文 + parseString」，
  // 这样每一次出站都经过 fetchWithSafety 的逐跳校验。
  const { text, response } = await fetchTextWithSafety(url, {
    headers: RSS_BROWSER_HEADERS,
    // @ts-ignore rss-parser 的 timeout 选项对 fetch 无效，用 AbortSignal 更可靠
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  let feed;
  try {
    feed = await parser.parseString(text);
  } catch (firstError) {
    // 第一次失败不一定代表地址有问题：可能是站点对浏览器 UA 返回了 HTML。
    // 换朴素 UA 再试；仍然失败才把原始错误抛出去（保留第一次的错误更贴近直觉）。
    try {
      const retry = await fetchTextWithSafety(url, {
        headers: PLAIN_HEADERS,
        // @ts-ignore 同上
        signal: AbortSignal.timeout(20_000),
      });
      feed = await plainParser.parseString(retry.text);
    } catch {
      console.error(`Failed to parse RSS: ${url}`, firstError);
      throw firstError;
    }
  }

  try {
    return {
      title: feed.title,
      description: feed.description,
      link: feed.link,
      language: feed.language,
      lastBuildDate: feed.lastBuildDate,
      items: feed.items.map(item => {
        const content = item['content:encoded'] || item.content || '';
        return {
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          content: item['content:encoded'] || item.content,
          contentSnippet: item.contentSnippet,
          author: item.author || item.creator || item['dc:creator'],
          guid: item.guid || item.id,
          isoDate: item.isoDate,
          'content:encoded': item['content:encoded'],
          description: item.description,
          'dc:creator': item['dc:creator'],
          // 列表和正文都需要一张封面图；以前这个字段从来没被赋值，
          // 数据库里 image_url 全是 null，界面上就只能靠纯文字。
          imageUrl: extractImageUrl(item as RSSItem, String(content || '')),
        };
      }),
    };
  } catch (error) {
    console.error(`映射 RSS 条目失败: ${url}`, error);
    throw error;
  }
}

// 别名导出，用于兼容旧代码
export const parseRSSFeed = parseRSS;

/**
 * 验证 RSS URL
 */
export async function validateRSSUrl(url: string): Promise<{ valid: boolean; feed?: RSSFeed; error?: string }> {
  try {
    const feed = await parseRSS(url);
    return { valid: true, feed };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : 'Invalid RSS feed' };
  }
}

/**
 * 提取网站 favicon
 */
export function extractFavicon(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.protocol}//${urlObj.hostname}/favicon.ico`;
  } catch {
    return '';
  }
}

/**
 * 获取文章完整内容
 */
async function fetchFullContent(url: string, feedUrl: string): Promise<string | null> {
  try {
    // 文章链接来自 RSS 内容，同样是外部可控输入：一个恶意源可以把
    // <link> 写成 http://169.254.169.254/latest/meta-data/，服务端就会
    // 带着内网权限去抓。与 parseRSS 一样必须过安全校验。
    //
    // 单个失败只影响这一篇文章拿不到全文，不该让整次同步失败。
    await assertSafeOutboundUrl(url);
  } catch {
    return null;
  }

  try {
    // 针对特定网站的处理
    if (url.includes('36kr.com') || url.includes('36kr.cn')) {
      return await fetch36KrContent(url);
    }
    if (url.includes('huxiu.com')) {
      return await fetchHuxiuContent(url);
    }
    if (url.includes('sspai.com')) {
      return await fetchSspaiContent(url);
    }
    if (url.includes('geekpark.net')) {
      return await fetchGeekparkContent(url);
    }
    if (url.includes('ifanr.com')) {
      return await fetchIfanrContent(url);
    }
    if (url.includes('pingwest.com')) {
      return await fetchPingwestContent(url);
    }
    if (url.includes('solidot.org')) {
      return await fetchSolidotContent(url);
    }

    // 通用抓取
    return await fetchGenericContent(url);
  } catch (error) {
    console.error(`Failed to fetch content from ${url}:`, error);
    return null;
  }
}

/**
 * 通用 fetch 配置
 */
function getFetchConfig(): RequestInit {
  return {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate',
      'Cache-Control': 'no-cache',
      'Referer': 'https://www.google.com/',
    },
    // @ts-ignore
    timeout: 15000,
  };
}

/**
 * 清理 HTML 内容
 */
function cleanHtmlContent($: cheerio.CheerioAPI, content: string): string {
  const $content = cheerio.load(content);

  // 移除不需要的元素
  $content('script, style, iframe, nav, header, footer, aside, .ads, .ad, .advertisement').remove();
  $content('.related-posts, .related-articles, .recommend, .comments, #comments').remove();
  $content('.share, .social-share, .share-buttons, .action-bar').remove();
  $content('.author-info, .author-bio, .post-meta, .entry-meta').remove();
  $content('noscript').remove();

  // 面包屑导航：IT之家这类站会把「首页 > IT资讯 > 业界」放在正文容器里，
  // 不摘掉的话每篇文章开头都挂一串站点导航。
  $content([
    '.breadcrumb', '.breadcrumbs', '.crumb', '.crumbs',
    '[class*="breadcrumb"]', '[class*="crumb"]',
    '.position', '.path', '.site-path', '.location',
    '[class*="position"]', '[class*="site-nav"]',
  ].join(',')).remove();

  // 处理图片
  $content('img').each((_, img) => {
    const $img = $content(img);
    // 使用 data-src 或 src
    const src = $img.attr('data-src') || $img.attr('src') || '';
    if (src) {
      $img.attr('src', src);
    }
    // 移除懒加载属性
    $img.removeAttr('data-src');
    $img.removeAttr('data-original');
    $img.removeAttr('loading');
    // 添加样式
    $img.css('max-width', '100%');
    $img.css('height', 'auto');
  });

  // 处理链接
  $content('a').each((_, a) => {
    const $a = $content(a);
    $a.attr('target', '_blank');
    $a.attr('rel', 'noopener noreferrer');
  });

  return $content.html() || '';
}

/**
 * 抓取 36 氪文章内容
 * 36 氪网站有特殊的反爬机制，需要特殊处理
 */
async function fetch36KrContent(url: string): Promise<string | null> {
  try {
    // 36 氪需要特殊的请求头
    const response = await fetchWithSafety(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://36kr.com/',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Cache-Control': 'max-age=0',
      },
      // @ts-ignore
      timeout: 20000,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    let content = '';

    // 方法 1: 尝试从 Next.js 的 __NEXT_DATA__ 中提取
    const nextDataScript = $('#__NEXT_DATA__').html();
    if (nextDataScript) {
      try {
        const nextData = JSON.parse(nextDataScript);
        // 36 氪的文章数据通常在 props.pageProps.articleDetail.content 中
        const articleDetail = nextData.props?.pageProps?.articleDetail;
        if (articleDetail?.content) {
          content = articleDetail.content;
          console.log('36Kr: Found content in __NEXT_DATA__');
        }
        // 也可能是 articleDetail.articleDetail.content
        if (!content && articleDetail?.articleDetail?.content) {
          content = articleDetail.articleDetail.content;
          console.log('36Kr: Found content in articleDetail.articleDetail');
        }
      } catch (e) {
        console.log('36Kr: Failed to parse __NEXT_DATA__');
      }
    }

    // 方法 2: 从 window.initialState 或类似的全局变量中提取
    if (!content) {
      $('script').each((_, script) => {
        const text = $(script).html() || '';

        // 尝试匹配 initialState
        if (text.includes('initialState') || text.includes('articleDetail')) {
          // 尝试提取 JSON 数据
          const jsonMatch = text.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]+?\});/) ||
                           text.match(/window\.__DATA__\s*=\s*(\{[\s\S]+?\});/);
          if (jsonMatch) {
            try {
              const data = JSON.parse(jsonMatch[1]);
              const articleContent = data.articleDetail?.content ||
                                    data.detail?.content ||
                                    data.article?.content;
              if (articleContent) {
                content = articleContent;
                console.log('36Kr: Found content in window initial state');
                return false; // break
              }
            } catch (e) {
              // continue
            }
          }
        }

        // 尝试直接匹配 content 字段
        if (!content && (text.includes('"content"') || text.includes("'content'"))) {
          // 尝试找到包含 HTML 标签的 content
          const contentMatch = text.match(/["']content["']\s*:\s*["'](<[\s\S]+?)["']/) ||
                              text.match(/["']content["']\s*:\s*["']([^"']{500,})["']/);
          if (contentMatch) {
            const potentialContent = contentMatch[1];
            // 验证是否包含 HTML 标签
            if (potentialContent.includes('<') && potentialContent.includes('>')) {
              content = potentialContent.replace(/\\"/g, '"').replace(/\\n/g, '\n');
              console.log('36Kr: Found content in script tag');
              return false; // break
            }
          }
        }
      });
    }

    // 方法 3: 从 DOM 中选择器提取
    if (!content) {
      const selectors = [
        '.article-content',
        '.article-detail-content',
        '.article-detail-content.markdown-body',
        '.article-detail-content .common-width.content',
        '.common-width.content',
        '.article-content-wrapper',
        '.article-detail-wrapper .content',
        '.article-detail .content',
        '[class*="article-detail"] [class*="content"]',
        'article .content',
        '.post-content',
        '.rich-text-content',
        '.article-body',
        '[data-testid="article-content"]',
      ];

      for (const selector of selectors) {
        const element = $(selector).first();
        if (element.length && element.text().trim().length > 200) {
          content = element.html() || '';
          console.log(`36Kr: Found content with selector ${selector}`);
          break;
        }
      }
    }

    // 方法 4: 从 meta 标签中提取
    if (!content) {
      const description = $('meta[name="description"]').attr('content');
      if (description && description.length > 100) {
        content = `<p>${description}</p>`;
        console.log('36Kr: Using description as fallback');
      }
    }

    if (content) {
      // 36 氪的内容可能需要解码 HTML 实体
      content = content
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'");

      return cleanHtmlContent($, content);
    }

    console.log('36Kr: Could not find content');
    return null;
  } catch (error) {
    console.error('Failed to fetch 36kr content:', error);
    return null;
  }
}

/**
 * 抓取虎嗅文章内容
 */
async function fetchHuxiuContent(url: string): Promise<string | null> {
  try {
    const response = await fetchWithSafety(url, getFetchConfig());
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const selectors = [
      '.article-content-wrap',
      '.article-content',
      '.article__content',
      '.article-content-wrapper',
      '.content-wrapper',
      'article .content',
      '.post-content',
    ];

    let content = '';
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim().length > 200) {
        content = element.html() || '';
        break;
      }
    }

    if (content) {
      return cleanHtmlContent($, content);
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch huxiu content:', error);
    return null;
  }
}

/**
 * 抓取少数派文章内容
 */
async function fetchSspaiContent(url: string): Promise<string | null> {
  try {
    const response = await fetchWithSafety(url, getFetchConfig());
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 少数派的正文在 `.article__main__content` 里，这是精确容器。
    //
    // 之前第一个选择器是宽泛的 'article'，它命中的是整个文章外壳，
    // 于是把「12 分钟阅读」、作者小头像、作者签名也都抓进来了 ——
    // 正文里出现一堆页头杂物。这里按「越精确越靠前」重排，并去掉
    // 宽泛的 article 兜底（宁可抓不到也不抓一坨错的）。
    const selectors = [
      '.article__main__content',
      '.article__content',
      '.wangEditor-txt',
      '.content',
      '.article-content',
      '.post-content',
      '.markdown-body',
    ];

    let content = '';
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim().length > 200) {
        // 顺手清掉正文容器内部的页头/作者卡/目录等杂物
        element.find([
          '.article__header',
          '.article__authors',
          '.article__directory',
          '.article__charge__card',
          '.article__footer',
          '.article__bar',
          '.article__subsection__wrapper',
          '[class*="read-time"]',
          '[class*="reading-time"]',
        ].join(',')).remove();

        content = element.html() || '';
        break;
      }
    }

    if (content) {
      return cleanHtmlContent($, content);
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch sspai content:', error);
    return null;
  }
}

/**
 * 抓取极客公园文章内容
 */
async function fetchGeekparkContent(url: string): Promise<string | null> {
  try {
    const response = await fetchWithSafety(url, getFetchConfig());
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const selectors = [
      '.article-content',
      '.article-content-wrapper',
      '.content',
      '.post-content',
      'article',
    ];

    let content = '';
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim().length > 200) {
        content = element.html() || '';
        break;
      }
    }

    if (content) {
      return cleanHtmlContent($, content);
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch geekpark content:', error);
    return null;
  }
}

/**
 * 抓取爱范儿文章内容
 */
async function fetchIfanrContent(url: string): Promise<string | null> {
  try {
    const response = await fetchWithSafety(url, getFetchConfig());
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const selectors = [
      '.entry-content',
      '.article-content',
      '.content',
      '.post-content',
      'article',
    ];

    let content = '';
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim().length > 200) {
        content = element.html() || '';
        break;
      }
    }

    if (content) {
      return cleanHtmlContent($, content);
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch ifanr content:', error);
    return null;
  }
}

/**
 * 抓取品玩文章内容
 */
async function fetchPingwestContent(url: string): Promise<string | null> {
  try {
    const response = await fetchWithSafety(url, getFetchConfig());
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const selectors = [
      '.article-content',
      '.content',
      '.post-content',
      'article',
    ];

    let content = '';
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim().length > 200) {
        content = element.html() || '';
        break;
      }
    }

    if (content) {
      return cleanHtmlContent($, content);
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch pingwest content:', error);
    return null;
  }
}

/**
 * 抓取 Solidot 文章内容
 */
async function fetchSolidotContent(url: string): Promise<string | null> {
  try {
    const response = await fetchWithSafety(url, getFetchConfig());
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const selectors = [
      '.p_mainnew',
      '.main-content',
      '.content',
      'article',
      '.post-content',
    ];

    let content = '';
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim().length > 100) {
        content = element.html() || '';
        break;
      }
    }

    if (content) {
      return cleanHtmlContent($, content);
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch solidot content:', error);
    return null;
  }
}

/**
 * 通用内容抓取
 */
/**
 * 判断抓到的是不是「站点拒绝服务」的提示页，而不是正文。
 *
 * 反爬页面往往比正文还长（微信公众号返回的「环境异常」页面 18KB），
 * 只按长度判断会把它当全文存进库，用户点开看到一堆「请在微信客户端打开
 * 链接」。这类页面有几个非常固定的特征词，命中就不认。
 */
function looksLikeBlockPage(html: string): boolean {
  // 只看开头一小段：真正的正文很少以「环境异常」这类话起头，
  // 但一篇文章讨论反爬时可能在正文中间提到它 —— 那不该被当成拦截页。
  //
  // 注意不能按「整体长度」做前置判断：实测微信公众号的拦截页有
  // 一万四千多字（内联脚本和样式都被算进文本），加长度上限反而让
  // 检测失效。
  const text = html.replace(/<[^>]+>/g, "").replace(/\s+/g, "").slice(0, 300);
  return [
    "环境异常",
    "完成验证后即可继续访问",
    "请在微信客户端打开链接",
    "访问过于频繁",
    "请输入验证码",
    "Enable JavaScript and cookies to continue",
    "Just a moment...",
    "Attention Required",
    "403 Forbidden",
    "Access Denied",
  ].some((marker) => text.includes(marker));
}

async function fetchGenericContent(url: string): Promise<string | null> {
  try {
    const response = await fetchWithSafety(url, getFetchConfig());
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // 常见的内容选择器，按优先级排序。
    //
    // 精确的正文容器必须排在宽泛的 `article` / `main` 之前：
    // 很多站的 <article> 里除了正文还塞着面包屑、重复标题、作者卡，
    // 先命中 article 就等于把整块外壳当正文。
    const selectors = [
      '.article-content',
      '.post-content',
      '.entry-content',
      '[class*="article-content"]',
      '[class*="post-content"]',
      '[class*="entry-content"]',
      '.article-body',
      '[class*="article-body"]',
      '.markdown-body',
      // Tailwind Typography 的约定类名。现在大量个人博客和文档站用
      // ProseMirror/MDX 生成静态页，正文就挂在 `.prose` 上，别的选择器
      // 一个都命中不了 —— 实测新趣集整页 280KB HTML，正文字数 310，
      // 而它正是 `<div class="prose prose-slate ...">`。
      '.prose',
      '[class*="prose"]',
      'article [class*="content"]',
      '[class*="content"] article',
      'article',
      'main',
      '.content',
    ];

    let bestContent = '';
    let bestLength = 0;

    for (const selector of selectors) {
      $(selector).each((_, element) => {
        const html = $(element).html() || '';
        const text = $(element).text().trim();
        // 选择内容最长的有效内容
        if (text.length > bestLength && text.length > 300) {
          bestLength = text.length;
          bestContent = html;
        }
      });

      if (bestContent) break;
    }

    if (bestContent && !looksLikeBlockPage(bestContent)) {
      return cleanHtmlContent($, bestContent);
    }

    return null;
  } catch (error) {
    console.error('Failed to fetch generic content:', error);
    return null;
  }
}

/**
 * 同步 RSS 源文章到数据库
 */
export async function syncFeed(feedId: string): Promise<FeedSyncResult> {
  try {
    const feed = await prisma.feed.findUnique({
      where: { id: feedId },
    });

    if (!feed) {
      return { success: false, message: 'Feed not found', count: 0 };
    }

    // 更新同步状态
    await prisma.feed.update({
      where: { id: feedId },
      data: {
        syncStatus: 'SYNCING',
        lastSyncAt: new Date(),
      },
    });

    // 解析 RSS
    const rssData = await parseRSS(feed.url);

    let addedCount = 0;
    const errors: string[] = [];
    // 收集本次新增的文章，同步结束后统一生成一条「有 N 篇新文章」通知。
    // 不在循环里直接写通知：一次同步十几篇会写十几条通知，把收件箱淹掉。
    const addedArticles: { id: string; title: string }[] = [];

    // 处理文章
    const syncStartedAt = Date.now();
    for (const item of rssData.items.slice(0, 15)) { // 只处理最新的 15 篇
      try {
        if (!item.title || !item.link) continue;

        // 检查文章是否已存在
        const existingArticle = await prisma.article.findFirst({
          where: {
            feedId: feedId,
            OR: [
              { guid: item.guid },
              { link: item.link },
            ],
          },
        });

        // 补抓要花的外网时间必须有上界：一个永久超时的源如果有 15 篇
        // 短文章，每篇按 15 秒超时算就是 225 秒的同步。
        // 403 很快的源（Product Hunt）实测 28 篇只花 4 秒，但超时型
        // 源会拖垮整次同步，所以用时间预算兜住。
        const repairBudgetMs = 20_000;
        if (existingArticle) {
          // 已经入库的文章也可能是「当时只拿到摘要」的。
          //
          // 之前这里直接 continue，等于「第一次同步抓到什么就永远是什么」。
          // 实测少数派有 9 篇停在一百多字的摘要状态，而同一个源的其它文章
          // 有 3 万多字 —— 差别只在于那几篇入库时落地页刚好没抓到。
          // 用户点开就是残缺的正文，看起来像「有些源不支持全文」。
          //
          // 只在「库里内容很短」时补抓一次：这条路径要打一次外网，
          // 无差别地对每篇老文章都重抓会让每次同步变慢十几倍。
          const existingLen = (existingArticle.content || "").length;
          if (existingLen < 800) {
            // 预算用完就放弃本轮，但要留日志：否则「为什么还有短文」
            // 会变成一个无从查起的问题。
            if (Date.now() - syncStartedAt >= repairBudgetMs) {
              console.log(
                `Repair budget exhausted, skipped: ${existingArticle.title}`
              );
            } else {
              const repaired = await fetchFullContent(item.link, feed.url);
              if (repaired && repaired.length > existingLen) {
                await prisma.article.update({
                  where: { id: existingArticle.id },
                  data: {
                    content: stripLeadingDuplicateTitle(
                      sanitizeArticleHtml(repaired),
                      existingArticle.title || item.title || ""
                    ),
                  },
                });
                console.log(
                  `Repaired short article: ${existingArticle.title} ${existingLen} -> ${repaired.length} chars`
                );
              }
            }
          }
          continue;
        }

        // 获取完整内容
        let content = item['content:encoded'] || item.content || item.description || '';

        // 什么情况下回源抓落地页：
        //   1. RSS 给的正文太短（< 800 字符），基本可以确定只是摘要；
        //   2. RSS 正文里一张图都没有，而条目本身也没带封面 —— IT之家就是
        //      这种：RSS 里塞了 900 多字纯文字，图全在落地页，只按长度判断
        //      就永远不会去抓，列表里 55 篇全是无图的纯文字卡片。
        // 两者都不满足时才跳过，避免对每个源都无谓地打一次落地页。
        const hasInlineImage = /<img[\s>]/i.test(content);
        const needsFullContent = content.length < 800 || !hasInlineImage;

        if (needsFullContent) {
          console.log(`Fetching full content for: ${item.title}`);
          const fullContent = await fetchFullContent(item.link, feed.url);
          if (fullContent && fullContent.length > content.length) {
            content = fullContent;
            console.log(`Got full content: ${fullContent.length} chars`);
          }
        }

        // 清理 HTML 内容
        //
        // 用白名单净化而不是删几个黑名单标签：RSS 正文是不可信输入，
        // 原型上曾有 <img onerror> / javascript: 链接被原样存库。
        // 这里在「入库前」净化一次，各 API 在「出库后」还会再净化一次，
        // 因为历史数据里已经存在未净化的脏内容。
        if (content) {
          // 先净化再剥开头那个与标题重复的块：净化会拆掉原文的包裹层，
      // 顺序反了会让「标题 + 页头」粘在同一个块里，剥不干净。
      content = stripLeadingDuplicateTitle(sanitizeArticleHtml(content), item.title || '');
        }

        // 提取描述（列表页摘要）
        //
        // 不能直接把 item.description 拿来用：很多源的 description 里
        // 塞的是完整 HTML 片段（IT之家就是典型，带 <p data-vmark> 这类
        // 厂商私有属性），直接渲染到列表里会看到一堆标签源码。
        // 这里一律剥成纯文本，并且限制长度。
        let description = item.contentSnippet || item.description || '';
        if (description) {
          const $desc = cheerio.load(description);
          $desc('script, style').remove();
          description = $desc.text().replace(/\s+/g, ' ').trim();
        }
        if (!description && content) {
          const $ = cheerio.load(content);
          description = $.text().replace(/\s+/g, ' ').trim();
        }
        if (description.length > 300) {
          description = description.substring(0, 300);
        }

        // 封面图兜底：RSS 自带的字段里没有图时，从「最终正文」里找第一张。
        //
        // 注意顺序：必须放在全量抓取之后。少数派这类源在 feed 里只给
        // 一段纯文字摘要，图片全在落地页正文里；若在 parseRSS 阶段就定
        // 死 imageUrl，抓完全文也不会再回填，列表里就只有 36氪 有图。
        const imageUrl = item.imageUrl || extractImageUrl(item as RSSItem, content);

        // 创建新文章
        const pubDate = item.isoDate ? new Date(item.isoDate) :
                       item.pubDate ? new Date(item.pubDate) : new Date();

        const created = await prisma.article.create({
          data: {
            feedId: feedId,
            title: item.title,
            link: item.link,
            description: description.substring(0, 500),
            content: content,
            author: item.author || '',
            pubDate: pubDate,
            imageUrl: imageUrl || null,
            guid: item.guid || item.link,
          },
          select: { id: true, title: true },
        });
        addedArticles.push(created);

        addedCount++;
      } catch (itemError) {
        console.error('Failed to process item:', itemError);
        errors.push(itemError instanceof Error ? itemError.message : 'Unknown error');
      }
    }

    // 更新 Feed 信息
    await prisma.feed.update({
      where: { id: feedId },
      data: {
        title: rssData.title || feed.title,
        description: rssData.description || feed.description,
        language: rssData.language || feed.language,
        syncStatus: errors.length > 0 && addedCount === 0 ? 'ERROR' : 'SUCCESS',
        errorCount: errors.length,
        lastError: errors.length > 0 ? errors.join('; ') : null,
      },
    });

    // 通知在文章入库之后生成：先把内容落库，再告诉用户「有更新」。
    // 顺序反过来的话，用户点通知跳过去可能发现文章还不存在。
    if (addedArticles.length > 0) {
      await notifyFeedUpdates(feedId, addedArticles);
    }

    return {
      success: true,
      message: `同步完成，新增 ${addedCount} 篇文章`,
      count: addedCount,
    };
  } catch (error) {
    console.error('Sync feed error:', error);

    await prisma.feed.update({
      where: { id: feedId },
      data: {
        syncStatus: 'ERROR',
        errorCount: { increment: 1 },
        lastError: error instanceof Error ? error.message : 'Sync failed',
      },
    });

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Sync failed',
      count: 0,
    };
  }
}

/**
 * 同步所有活跃的 RSS 源（并行处理优化版）
 */
/**
 * 同步若干源。
 *
 * `userId` 决定同步范围：
 *   - 传了 userId：只同步这个用户订阅的源（UI 触发同步走这条）。
 *   - 不传：同步全部启用的源（只给 scripts/seed-presets.ts 这类运维脚本用）。
 *
 * 为什么必须区分：Feed 是全局实体（多个用户订阅同一个源时文章是共享的），
 * 所以早期实现直接从 feed.findMany() 取全表。结果是任何登录用户点一次
 * 「刷新全部」，服务端就会去抓库里所有源 —— 演示实例上是 896 个源，
 * 一次调用要跑几分钟，且任何人都能反复触发。
 * 普通用户打开应用时想刷新的，本来就只是自己订阅的那几十个。
 */
/**
 * SYNCING 锁的租约时长。
 * 一次同步的正常耗时是几秒（单个源最多 20s 超时 + 15 篇文章的补抓预算），
 * 10 分钟足够覆盖慢源；超过这个时间的 SYNCING 一定是进程中断留下的。
 */
const STALE_SYNC_MS = 10 * 60 * 1000;

export async function syncAllFeeds(userId?: string): Promise<{ success: boolean; results: BatchSyncResult[] }> {
  try {
    // SYNCING 是一个「租约」而不是永久标记。
    //
    // 原来只写 `syncStatus: { not: 'SYNCING' }`，而置为 SYNCING 之后
    // 只有在同步成功/失败的分支才会改回来 —— 进程被杀、容器重建、
    // 或者 fetch 卡在一个不返回的连接上（没有超时的老代码），
    // 这个源就永远停在 SYNCING，之后每一次「刷新全部」都会被排除。
    // 实测线上有两只源卡了一百多分钟，用户看到的现象是
    // 「这个源永远不更新，但别的源都正常」。
    //
    // 现在给租约设一个超时：超过 STALE_SYNC_MS 的 SYNCING 视为陈旧，
    // 允许重新同步 —— 代价是极端情况下同一源被并发抓两次（幂等，
    // 只会多一次外呼），换来的是永远不会永久卡死。
    const staleCutoff = new Date(Date.now() - STALE_SYNC_MS);

    const feeds = await prisma.feed.findMany({
      where: {
        isActive: true,
        OR: [
          { syncStatus: { not: 'SYNCING' } },
          // 陈旧锁：仍在 SYNCING，但最后一次动手早于阈值
          { syncStatus: 'SYNCING', lastSyncAt: { lt: staleCutoff } },
          // lastSyncAt 为空的 SYNCING（理论上不该有，兜住一次）
          { syncStatus: 'SYNCING', lastSyncAt: null },
        ],
        // 传 userId 时收敛到「我订阅的」，未传则维持全量（运维脚本）
        ...(userId
          ? { subscriptions: { some: { userId } } }
          : {}),
      },
    });

    if (feeds.length === 0) {
      return { success: true, results: [] };
    }

    console.log(`开始同步 ${feeds.length} 个 RSS 源`);

    // 并行处理，限制并发数为 5，避免过多同时请求
    const concurrencyLimit = 5;
    const results: BatchSyncResult[] = [];
    
    // 分批处理
    for (let i = 0; i < feeds.length; i += concurrencyLimit) {
      const batch = feeds.slice(i, i + concurrencyLimit);
      console.log(`处理批次 ${Math.floor(i / concurrencyLimit) + 1}, 共 ${batch.length} 个 RSS 源`);
      
      const batchResults = await Promise.allSettled(
        batch.map(async (feed) => {
          try {
            const result = await syncFeed(feed.id);
            return {
              feedId: feed.id,
              feedTitle: feed.title,
              ...result,
            };
          } catch (error) {
            console.error(`Sync feed ${feed.id} error:`, error);
            return {
              feedId: feed.id,
              feedTitle: feed.title,
              success: false,
              message: error instanceof Error ? error.message : 'Sync failed',
              count: 0,
            };
          }
        })
      );

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // allSettled 的 rejected 分支拿不到 feed，只能报一条无主的错误。
          // 正常情况下走不到这里 —— 内层 try/catch 已经兜住了所有异常，
          // 只有代码本身写错（比如 TypeError）才会落到这个分支。
          results.push({
            feedId: '',
            feedTitle: '',
            success: false,
            message: result.reason instanceof Error ? result.reason.message : 'Unknown error',
            count: 0,
          });
        }
      }
      
      // 批次间延迟 500ms，避免过快请求
      if (i + concurrencyLimit < feeds.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`同步完成：${successCount}/${results.length} 成功`);

    return { success: true, results };
  } catch (error) {
    console.error('Sync all feeds error:', error);
    return {
      success: false,
      results: [],
    };
  }
}

/**
 * 添加新的 RSS 源
 */
export async function addFeed(url: string, category: string = 'OTHER'): Promise<{ success: boolean; message: string; feed?: Feed }> {
  try {
    // 检查 URL 是否已存在
    const existingFeed = await prisma.feed.findUnique({
      where: { url },
    });

    if (existingFeed) {
      return { success: false, message: '该 RSS 源已存在', feed: existingFeed };
    }

    // 解析 RSS 验证有效性
    const rssData = await parseRSS(url);

    if (!rssData.title) {
      return { success: false, message: '无法解析 RSS 源' };
    }

    // 创建 Feed
    const feed = await prisma.feed.create({
      data: {
        url,
        title: rssData.title,
        description: rssData.description || '',
        category,
        language: rssData.language || 'zh-CN',
        syncStatus: 'SUCCESS',
        lastSyncAt: new Date(),
        isActive: true,
      },
    });

    // 创建 MarketFeed
    await prisma.marketFeed.create({
      data: {
        feedId: feed.id,
        category,
        isFeatured: false,
        subscriberCount: 0,
        status: 'ACTIVE',
      },
    });

    // 同步文章
    await syncFeed(feed.id);

    return {
      success: true,
      message: 'RSS 源添加成功',
      feed,
    };
  } catch (error) {
    console.error('Add feed error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : '添加 RSS 源失败',
    };
  }
}
