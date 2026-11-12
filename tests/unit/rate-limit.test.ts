import { describe, it, expect, beforeEach } from "vitest";
import {
  getClientIdentifier,
  checkRateLimit,
  checkGlobalRateLimit,
  resetRateLimit,
  __resetAllRateLimits,
} from "@/lib/rate-limit";

/**
 * 这组测试针对一个真实漏洞：
 *
 * `getClientIdentifier` 读的是 `X-Forwarded-For`，而这个头完全由客户端
 * 填写。实测确认 Next.js 会原样透传（客户端发 `1.1.1.1` 服务端就读到
 * `1.1.1.1`），所以「换一个伪造 IP 就能重置限流计数」。
 *
 * 防御办法不是在 getClientIdentifier 里做手脚（它拿不到真实地址），
 * 而是给关键接口再叠一层不依赖任何客户端输入的全局上限。
 */

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/test", { headers });
}

describe("getClientIdentifier", () => {
  beforeEach(() => {
    __resetAllRateLimits();
    delete process.env.TRUST_PROXY;
  });

  it("没有转发头时返回 anonymous", () => {
    expect(getClientIdentifier(makeRequest())).toBe("anonymous");
  });

  it("非反代模式下取 X-Forwarded-For 的第一段", () => {
    const req = makeRequest({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(getClientIdentifier(req)).toBe("203.0.113.7");
  });

  it("反代模式（TRUST_PROXY=true）取最后一跳，客户端伪造的首段失效", () => {
    process.env.TRUST_PROXY = "true";
    const req = makeRequest({
      "x-forwarded-for": "1.1.1.1, 203.0.113.7",
    });
    // 首段 1.1.1.1 是客户端自己写的，最后一跳才是反代追加的真实地址
    expect(getClientIdentifier(req)).toBe("203.0.113.7");
  });

  it("X-Forwarded-For 里有空段时不会拿空串当 key", () => {
    const req = makeRequest({ "x-forwarded-for": " , 203.0.113.9" });
    expect(getClientIdentifier(req)).toBe("203.0.113.9");
  });

  it("只有 x-real-ip 时用它兜底", () => {
    const req = makeRequest({ "x-real-ip": "203.0.113.11" });
    expect(getClientIdentifier(req)).toBe("203.0.113.11");
  });
});

describe("按 IP 限流可被伪造头绕过（复现漏洞）", () => {
  beforeEach(() => {
    __resetAllRateLimits();
    delete process.env.TRUST_PROXY;
  });

  it("每次换一个伪造 IP，单 IP 额度永远打不满", () => {
    const config = { windowMs: 60_000, max: 2 };
    const results: boolean[] = [];

    for (let i = 0; i < 20; i++) {
      // 攻击者每次换一个 XFF
      const req = makeRequest({ "x-forwarded-for": `10.7.7.${i}` });
      const id = `validate:${getClientIdentifier(req)}`;
      results.push(checkRateLimit(id, config).success);
    }

    // 20 次全部放行 —— 这就是漏洞本身
    expect(results.every(Boolean)).toBe(true);
  });
});

describe("全局上限挡住伪造 IP", () => {
  beforeEach(() => {
    __resetAllRateLimits();
    delete process.env.TRUST_PROXY;
  });

  it("伪造 IP 换 20 次，全局桶在第 4 次之后就拒绝", () => {
    const ipConfig = { windowMs: 60_000, max: 2 };
    const globalConfig = { windowMs: 60_000, max: 3 };
    const results: boolean[] = [];

    for (let i = 0; i < 20; i++) {
      const req = makeRequest({ "x-forwarded-for": `10.7.7.${i}` });
      const ipOk = checkRateLimit(
        `validate:${getClientIdentifier(req)}`,
        ipConfig
      ).success;
      const globalOk = checkGlobalRateLimit("validate", globalConfig).success;
      results.push(ipOk && globalOk);
    }

    const passed = results.filter(Boolean).length;
    // 只有前 3 次通过（全局额度），后面全被拦
    expect(passed).toBe(3);
  });

  it("全局桶与单 IP 桶互不影响", () => {
    // 先把全局桶消耗到只剩 1
    checkGlobalRateLimit("validate", { windowMs: 60_000, max: 2 });
    expect(
      checkGlobalRateLimit("validate", { windowMs: 60_000, max: 2 }).success
    ).toBe(true);
    // 全局已满
    expect(
      checkGlobalRateLimit("validate", { windowMs: 60_000, max: 2 }).success
    ).toBe(false);
    // 但单 IP 桶是干净的
    expect(
      checkRateLimit("validate:203.0.113.7", { windowMs: 60_000, max: 2 })
        .success
    ).toBe(true);
  });

  it("不同名字的全局桶彼此隔离", () => {
    const config = { windowMs: 60_000, max: 1 };
    expect(checkGlobalRateLimit("validate", config).success).toBe(true);
    expect(checkGlobalRateLimit("validate", config).success).toBe(false);
    // 另一个名字还有额度
    expect(checkGlobalRateLimit("register", config).success).toBe(true);
  });
});

describe("resetRateLimit", () => {
  beforeEach(() => {
    __resetAllRateLimits();
  });

  it("清除后重新获得完整额度", () => {
    const config = { windowMs: 60_000, max: 2 };
    expect(checkRateLimit("login:a@b.com", config).success).toBe(true);
    expect(checkRateLimit("login:a@b.com", config).success).toBe(true);
    expect(checkRateLimit("login:a@b.com", config).success).toBe(false);

    resetRateLimit("login:a@b.com");

    expect(checkRateLimit("login:a@b.com", config).success).toBe(true);
  });
});
