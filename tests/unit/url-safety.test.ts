import { describe, it, expect, afterEach } from "vitest";
import { isSafeOutboundUrl, assertSafeOutboundUrl, UnsafeUrlError } from "@/lib/url-safety";

/**
 * 出站 URL 安全校验的回归测试。
 *
 * 这些用例的价值不在于「通过」，而在于锁住边界：每一条都是真实存在过的
 * SSRF 绕过手法（或明确允许的合法场景）。改动 url-safety.ts 时如果误放
 * 了某类地址，这里会立刻红。
 */
describe("isSafeOutboundUrl", () => {
  afterEach(() => {
    delete process.env.ALLOW_PRIVATE_FEED_URLS;
  });

  it("允许正常的公网 RSS 源", async () => {
    expect(await isSafeOutboundUrl("https://sspai.com/feed")).toBe(true);
    expect(await isSafeOutboundUrl("http://ruanyifeng.com/blog/atom.xml")).toBe(true);
  });

  it("拒绝 IPv4 环回、私有、链路本地、保留网段", async () => {
    const blocked = [
      "http://127.0.0.1:3000/api/health",
      "http://127.1.2.3/",
      "http://10.1.2.3/",
      "http://172.16.0.1/",
      "http://172.31.255.255/",
      "http://192.168.1.1/",
      "http://169.254.169.254/latest/meta-data/", // 云厂商元数据
      "http://100.64.0.1/", // 运营商级 NAT
      "http://0.0.0.0/",
    ];
    for (const url of blocked) {
      expect(await isSafeOutboundUrl(url), url).toBe(false);
    }
  });

  it("拒绝 IPv6 环回与映射地址", async () => {
    expect(await isSafeOutboundUrl("http://[::1]:3000/")).toBe(false);
    expect(await isSafeOutboundUrl("http://[::ffff:127.0.0.1]/")).toBe(false);
    expect(await isSafeOutboundUrl("http://[fe80::1]/")).toBe(false);
  });

  it("拒绝解析到内网的域名（不只拦 IP 字面量）", async () => {
    // 只看主机名字符串挡不住这类地址：域名本身是公网可解析的
    expect(await isSafeOutboundUrl("http://127.0.0.1.nip.io:3000/")).toBe(false);
  });

  it("拒绝非 http/https 协议", async () => {
    expect(await isSafeOutboundUrl("file:///etc/passwd")).toBe(false);
    expect(await isSafeOutboundUrl("ftp://example.com/")).toBe(false);
    expect(await isSafeOutboundUrl("gopher://example.com/")).toBe(false);
  });

  it("拒绝无法解析的输入", async () => {
    expect(await isSafeOutboundUrl("not-a-url")).toBe(false);
    expect(await isSafeOutboundUrl("")).toBe(false);
  });

  it("十进制 / 八进制 IP 变体经 URL 规范化后仍被拦住", async () => {
    // http://2130706433 会被 new URL() 规范化成 127.0.0.1
    expect(await isSafeOutboundUrl("http://2130706433:3000/")).toBe(false);
    expect(await isSafeOutboundUrl("http://0177.0.0.1/")).toBe(false);
  });

  it("显式开启 ALLOW_PRIVATE_FEED_URLS 后放行内网（自建 RSSHub 场景）", async () => {
    process.env.ALLOW_PRIVATE_FEED_URLS = "true";
    expect(await isSafeOutboundUrl("http://192.168.1.10:1200/rsshub")).toBe(true);
    // 但协议检查不受这个开关影响
    expect(await isSafeOutboundUrl("file:///etc/passwd")).toBe(false);
  });
});

describe("assertSafeOutboundUrl", () => {
  it("不安全时抛 UnsafeUrlError，且错误信息可直接展示给用户", async () => {
    await expect(assertSafeOutboundUrl("http://127.0.0.1/")).rejects.toBeInstanceOf(
      UnsafeUrlError
    );
    await expect(assertSafeOutboundUrl("http://127.0.0.1/")).rejects.toMatchObject({
      message: "不允许访问内网地址",
    });
  });

  it("安全时返回解析后的 URL 对象", async () => {
    const parsed = await assertSafeOutboundUrl("https://sspai.com/feed");
    expect(parsed.hostname).toBe("sspai.com");
  });
});
