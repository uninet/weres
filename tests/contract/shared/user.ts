import { APIRequestContext, expect } from '@playwright/test';
import { extractTokenFromResponse } from './auth';

/**
 * 建一个干净的契约测试账号并登录取令牌。
 *
 * 为什么需要这个 helper：每个 contract 文件的 beforeAll 都自己写一遍
 * 「注册 → 登录 → 取 token」，而注册接口有全局限流（60 次/分钟）。
 * 原先这些 beforeAll **不检查注册的状态码**，于是：
 *   · 连跑第二轮时第 27 次注册撞上 429；
 *   · 后续 login 因为没有这个用户而 401；
 *   · 从 Set-Cookie 里取不到令牌，抛出的错误是
 *     「响应里没有 token Cookie。原始 Set-Cookie: (空)」——
 *     看起来像鉴权坏了，实际只是限流窗口没过去。
 *
 * 现在的做法：拿到 429 就按 retryAfter 等一等再重试（最多 3 轮），
 * 仍然失败才抛错，并且把「注册被限流」这件事明写进错误里。
 * 这样测试的结论不再取决于「上一次运行离这次多久」。
 */
export interface ContractUser {
  email: string;
  password: string;
  token: string;
}

export async function registerAndLogin(
  request: APIRequestContext,
  options: { prefix: string; nickname?: string; password?: string }
): Promise<ContractUser> {
  // 端口写死过一段时间，导致这套契约测试只能在 3000 端口跑：
// 换 BASE_URL 起一个全新克隆（验证「别人 clone 就能跑」）时，
// 测试还在打 3000 —— 那里要么没人监听，要么是另一个实例，
// 报出来的失败和代码无关。与 verify 脚本统一读同一个环境变量。
const BASE_URL = (process.env.BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '') + '/api';
  const email = `${options.prefix}-${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}@werss.test`;
  const password = options.password ?? 'Test@123456';
  // 昵称上限 20 字（app/api/auth/register/route.ts 的 nickname schema）
  const nickname = options.nickname ?? 'ContractTest';

  let lastRegister: Awaited<ReturnType<APIRequestContext['post']>> | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    lastRegister = await request.post(`${BASE_URL}/auth/register`, {
      data: { email, password, nickname },
      headers: { 'Content-Type': 'application/json' },
    });

    const status = lastRegister.status();
    if (status === 200 || status === 201 || status === 409) break;

    if (status === 429) {
      // 注册的全局桶是 60 次/分钟。等到它说的那一刻再重试。
      const body = await lastRegister.json().catch(() => ({}));
      const retryAfter = Number(body?.retryAfter) || 5;
      console.warn(
        `[contract] 注册被限流，等待 ${retryAfter}s 后重试（第 ${attempt + 1} 次）`
      );
      await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter, 30) * 1000));
      continue;
    }

    break;
  }

  const status = lastRegister?.status() ?? 0;
  expect(
    [200, 201, 409].includes(status),
    `契约测试账号注册失败（status=${status}）。若是 429，说明注册限流窗口还没过去，` +
      `等一分钟再跑；其它状态请看服务端日志。`
  ).toBe(true);

  const loginResponse = await request.post(`${BASE_URL}/auth/login`, {
    data: { email, password },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(
    loginResponse.status(),
    `契约测试账号登录失败（status=${loginResponse.status()}）`
  ).toBe(200);

  return { email, password, token: extractTokenFromResponse(loginResponse) };
}
