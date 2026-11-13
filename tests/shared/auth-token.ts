/**
 * 从 `Set-Cookie` 头部解析登录令牌。
 *
 * 纯函数、不带任何测试框架的依赖，Playwright 契约测试与
 * Vitest 集成测试共用同一份实现 —— 上一轮就是因为两套测试各自
 * 假设「令牌在响应体 data.token 里」，结果 44 条契约测试全红、
 * 集成测试 401，而没人意识到是同一个原因。
 */
export function parseTokenFromSetCookie(setCookie: string | undefined | null): string | null {
  if (!setCookie) return null;
  const match = /(?:^|[;,])\s*token=([^;,\s]+)/.exec(setCookie);
  return match ? match[1] : null;
}

/**
 * 断言式版本：解析失败时抛出带原始头的错误，便于定位。
 */
export function requireTokenFromSetCookie(setCookie: string | undefined | null): string {
  const token = parseTokenFromSetCookie(setCookie);
  if (!token) {
    throw new Error(
      `响应里没有 token Cookie。原始 Set-Cookie: ${setCookie || "(空)"}`
    );
  }
  return token;
}
