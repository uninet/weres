import { describe, it, expect, afterEach, vi } from "vitest";
import { fetchWithSafety, UnsafeUrlError } from "@/lib/url-safety";

/**
 * 重定向逐跳校验的回归测试。
 *
 * 这条用例守的是一个**已经真实存在过**的漏洞：
 * `assertSafeOutboundUrl(url)` 只在发请求前校验一次，管不了服务器返回 302
 * 之后去哪。攻击者只需要一个公网 URL 返回
 *   `302 Location: http://169.254.169.254/latest/meta-data/`
 * 就能让服务端带着内网权限去读云元数据。
 *
 * 用 mock fetch 而不是起真实服务：真实的「公网跳内网」链路在测试环境里
 * 造不出来（本地服务本身就是内网地址，首跳就会被拦），而这里要验证的
 * 恰恰是「第二跳有没有被校验」，只有 mock 能精确控制。
 */
describe("fetchWithSafety 重定向逐跳校验", () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
    delete process.env.ALLOW_PRIVATE_FEED_URLS;
  });

  it("跳到内网地址时必须抛 UnsafeUrlError，且不真的发出第二次请求", async () => {
    const calls: string[] = [];

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      calls.push(url);

      // 第一跳：看起来是公网域名（这里用真实公网域名，DNS 会正常解析）
      if (calls.length === 1) {
        return new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/latest/meta-data/" },
        });
      }
      // 如果代码真的跟了第二跳，这里会返回内网内容 —— 那就是漏洞
      return new Response("INTERNAL-SECRET", { status: 200 });
    }) as unknown as typeof fetch;

    await expect(
      fetchWithSafety("https://example.com/feed.xml")
    ).rejects.toBeInstanceOf(UnsafeUrlError);

    // 关键断言：内网地址从未被请求
    expect(calls.some((u) => u.includes("169.254.169.254"))).toBe(false);
  });

  it("跳到环回地址时同样拒绝", async () => {
    const calls: string[] = [];
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      calls.push(input.toString());
      return new Response(null, {
        status: 301,
        headers: { location: "http://127.0.0.1:3000/api/health" },
      });
    }) as unknown as typeof fetch;

    await expect(
      fetchWithSafety("https://example.com/feed.xml")
    ).rejects.toBeInstanceOf(UnsafeUrlError);

    expect(calls.some((u) => u.includes("127.0.0.1"))).toBe(false);
  });

  it("合法跳转（公网 → 公网）应跟随成功", async () => {
    const calls: string[] = [];
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      calls.push(input.toString());
      if (calls.length === 1) {
        return new Response(null, {
          status: 302,
          headers: { location: "https://sspai.com/feed" },
        });
      }
      return new Response("<rss></rss>", { status: 200 });
    }) as unknown as typeof fetch;

    const res = await fetchWithSafety("https://example.com/feed.xml");
    expect(res.status).toBe(200);
    expect(calls.length).toBe(2);
  });

  it("相对 Location 按当前跳解析", async () => {
    const calls: string[] = [];
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();
      calls.push(url);
      if (calls.length === 1) {
        return new Response(null, { status: 302, headers: { location: "/rss/feed.xml" } });
      }
      return new Response("<rss></rss>", { status: 200 });
    }) as unknown as typeof fetch;

    const res = await fetchWithSafety("https://sspai.com/news/index.html");
    expect(res.status).toBe(200);
    expect(calls[1]).toBe("https://sspai.com/rss/feed.xml");
  });

  it("重定向超过 5 跳时抛错，不会无限循环", async () => {
    let n = 0;
    global.fetch = vi.fn(async () => {
      n += 1;
      return new Response(null, {
        status: 302,
        headers: { location: `https://example.com/hop${n}` },
      });
    }) as unknown as typeof fetch;

    await expect(fetchWithSafety("https://example.com/start")).rejects.toThrow(
      /重定向次数过多/
    );
  });

  it("request init 里的 redirect 被强制覆盖为 manual", async () => {
    let seen: RequestInit | undefined;
    global.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      seen = init;
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;

    await fetchWithSafety("https://example.com/a", { redirect: "follow" });
    expect(seen?.redirect).toBe("manual");
  });
});
