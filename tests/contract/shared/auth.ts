import type { APIResponse } from '@playwright/test';
import { requireTokenFromSetCookie } from '../../shared/auth-token';

/**
 * 从登录响应里取出访问令牌。
 *
 * 登录接口把令牌写在 HttpOnly Cookie 里（`Set-Cookie: token=...`），
 * 响应体只有 `{ data: { user: {...} } }`。契约测试原来写的是
 * `loginBody.data.token` —— 那里永远是 undefined，于是每个用例都带着
 * `Authorization: Bearer undefined` 去打接口，全部 401。
 * 44 条契约测试长期全红，正是因为这一处假设错了。
 *
 * 不要把令牌改成从响应体返回：HttpOnly 的意义就是让 JS 读不到，
 * 为了测试方便削弱产品安全是本末倒置。测试应该迁就产品。
 *
 * 服务端同时接受 Cookie 和 `Authorization: Bearer`（见 lib/auth.ts）。
 */
export function extractTokenFromResponse(response: APIResponse): string {
  return requireTokenFromSetCookie(response.headers()['set-cookie']);
}

export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
