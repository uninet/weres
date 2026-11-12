import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * 出站 URL 安全校验。
 *
 * 背景：这个项目里所有「用户提供 URL」的入口（验证订阅源、新增订阅、
 * OPML 导入、拉取文章全文）最终都会由服务端发起 HTTP 请求。如果不过滤，
 * 任何访客都能让服务端去请求：
 *
 *   - http://127.0.0.1:3000/api/...      ← 内网自助服务
 *   - http://169.254.169.254/latest/...  ← 云厂商元数据（能换到临时凭证）
 *   - http://10.0.0.5:6379/              ← 内网数据库 / Redis
 *
 * 这就是 SSRF。它的危险不在于「能读页面」，而在于服务端处在受信任的
 * 内网位置，请求会带着内网权限出去。
 *
 * 实现上做两件事：
 *   1. 只允许 http/https 协议
 *   2. 解析域名得到真实 IP，逐个检查是否落在私有 / 保留网段
 *
 * 第 2 步是关键：只看主机名字符串（比如拦住 "localhost"）挡不住
 * `127.0.0.1`、`0x7f000001`、`[::1]`、或者一个解析到内网 IP 的公网域名。
 *
 * 局限（诚实说明）：DNS 解析与实际连接之间仍有一个时间窗，理论上
 * 存在 DNS rebinding 攻击 —— 第一次解析返回公网地址通过校验，连接时
 * 返回内网地址。要彻底封堵需要在 socket 层固定解析结果，代价是接管
 * 整个 HTTP 客户端。当前做法能挡住绝大多数实际利用，且不引入依赖。
 */

/** IPv4 私有 / 保留网段 */
function isPrivateIPv4(address: string): boolean {
  const parts = address.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
    return true; // 解析不出来的当危险处理
  }
  const [a, b] = parts;

  if (a === 0) return true; // 0.0.0.0/8 本网络
  if (a === 10) return true; // 10.0.0.0/8 私有
  if (a === 127) return true; // 127.0.0.0/8 环回
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 链路本地（含云元数据）
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 私有
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 私有
  if (a === 192 && b === 0) return true; // 192.0.0.0/24 保留
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 运营商级 NAT
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 基准测试
  if (a >= 224) return true; // 224.0.0.0/4 组播 + 240.0.0.0/4 保留
  return false;
}

/** IPv6 私有 / 保留网段 */
function isPrivateIPv6(address: string): boolean {
  const lower = address.toLowerCase();

  // ::1 环回
  if (lower === "::1" || lower === "0:0:0:0:0:0:0:1") return true;
  // :: 未指定
  if (lower === "::" || lower === "0:0:0:0:0:0:0:0") return true;

  // IPv4 映射地址。注意 new URL() 会先把 ::ffff:127.0.0.1 规范化成
  // ::ffff:7f00:1（两个十六进制组），所以两种形态都要认。
  const dotted = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) return isPrivateIPv4(dotted[1]);

  const hexMapped = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMapped) {
    const hi = Number.parseInt(hexMapped[1], 16);
    const lo = Number.parseInt(hexMapped[2], 16);
    const v4 = [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join(".");
    return isPrivateIPv4(v4);
  }

  if (lower.startsWith("fe80")) return true; // 链路本地
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // 唯一本地地址 fc00::/7
  if (lower.startsWith("ff")) return true; // 组播
  if (lower.startsWith("64:ff9b")) return true; // NAT64，可绕过 IPv4 检查
  return false;
}

function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIPv4(address);
  if (version === 6) return isPrivateIPv6(address);
  return true;
}

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/**
 * 是否允许访问内网地址 —— 默认**不允许**。
 *
 * 为什么留这个开关：自托管场景下确实有正当需求，比如自己在 NAS 上跑
 * 一个 RSSHub（http://192.168.1.10:1200）想订阅它的输出。这不是攻击，
 * 是真实用法。
 *
 * 但它必须显式打开：默认放开等于所有自托管实例都替公网攻击者开了一扇
 * 通往内网的门，而绝大多数部署者并不知道这扇门存在。
 */
export function allowsPrivateNetwork(): boolean {
  return process.env.ALLOW_PRIVATE_FEED_URLS === "true";
}

/**
 * 校验一个出站 URL 是否允许服务端访问。
 * 不安全时抛 UnsafeUrlError，调用方应捕获后返回 400。
 */
export async function assertSafeOutboundUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError("URL 格式无效");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new UnsafeUrlError("只支持 http / https 协议");
  }

  // 部署者显式放开内网访问（自建 RSSHub 等场景）时，只做协议检查
  if (allowsPrivateNetwork()) {
    return parsed;
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");

  // 字面量 IP 直接查，不必走 DNS
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new UnsafeUrlError("不允许访问内网地址");
    }
    return parsed;
  }

  // 域名：解析出所有地址逐个检查（可能有多个 A / AAAA 记录，
  // 只查第一个会被「公网 + 内网双记录」绕过）
  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new UnsafeUrlError("无法解析该域名");
  }

  if (addresses.length === 0) {
    throw new UnsafeUrlError("无法解析该域名");
  }

  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new UnsafeUrlError("不允许访问内网地址");
    }
  }

  return parsed;
}

/** 不抛异常的版本，适合在已有 try/catch 里顺手判断 */
export async function isSafeOutboundUrl(rawUrl: string): Promise<boolean> {
  try {
    await assertSafeOutboundUrl(rawUrl);
    return true;
  } catch {
    return false;
  }
}
