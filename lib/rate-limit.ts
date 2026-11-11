/**
 * 简单的内存速率限制器
 * 生产环境建议使用 Redis 或 Upstash Ratelimit
 */

interface RateLimitConfig {
  windowMs: number; // 时间窗口（毫秒）
  max: number;      // 最大请求次数
}

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

const store = new Map<string, RateLimitInfo>();

/**
 * 清理过期的记录
 */
function cleanupExpiredStore() {
  const now = Date.now();
  store.forEach((info, key) => {
    if (now > info.resetTime) {
      store.delete(key);
    }
  });
}

// 每 5 分钟清理一次过期记录
setInterval(cleanupExpiredStore, 5 * 60 * 1000);

/**
 * 检查请求是否超过限制
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { success: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const info = store.get(identifier);

  if (!info || now > info.resetTime) {
    // 新的时间窗口
    store.set(identifier, {
      count: 1,
      resetTime: now + config.windowMs,
    });
    return {
      success: true,
      remaining: config.max - 1,
      resetTime: now + config.windowMs,
    };
  }

  if (info.count >= config.max) {
    // 超过限制
    return {
      success: false,
      remaining: 0,
      resetTime: info.resetTime,
    };
  }

  // 增加计数
  info.count++;
  store.set(identifier, info);

  return {
    success: true,
    remaining: config.max - info.count,
    resetTime: info.resetTime,
  };
}

/**
 * 获取客户端标识符（IP 地址）
 */
export function getClientIdentifier(req: Request): string {
  // 从 X-Forwarded-For 头获取 IP
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  // 从 X-Real-IP 头获取 IP
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // 返回匿名标识
  return "anonymous";
}

/**
 * 清除某个标识的计数。
 *
 * 用于「只惩罚失败尝试」的场景：登录成功说明是合法用户，
 * 不该继续消耗配额。不提供这个函数时，用户 15 分钟内正常
 * 登录登出 5 次就会被锁在门外 —— 那是把防盗门装反了。
 */
export function resetRateLimit(identifier: string): void {
  store.delete(identifier);
}

/**
 * 速率限制中间件
 */
export function withRateLimit<T extends (...args: any[]) => any>(
  handler: T,
  config: RateLimitConfig = { windowMs: 60 * 1000, max: 10 }
) {
  return async function wrappedHandler(req: Request, ...args: any[]) {
    const identifier = getClientIdentifier(req);
    const result = checkRateLimit(identifier, config);

    if (!result.success) {
      return new Response(
        JSON.stringify({
          error: "请求过于频繁",
          message: `请稍后再试，剩余时间：${Math.ceil((result.resetTime - Date.now()) / 1000)}秒`,
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": config.max.toString(),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": result.resetTime.toString(),
          },
        }
      );
    }

    return handler(req, ...args);
  };
}

/**
 * 预定义的速率限制配置
 */
export const rateLimitConfigs = {
  // 严格限制：用于登录等敏感操作。
  // 5 次/15 分钟只统计「失败」的尝试（成功登录会重置计数）——
  // 这个额度是给暴力破解留的，不是给正常用户的。
  strict: { windowMs: 15 * 60 * 1000, max: 5 },

  // 标准限制：用于一般 API
  standard: { windowMs: 60 * 1000, max: 10 }, // 1 分钟内 10 次

  // 宽松限制：用于 RSS 同步等耗时操作
  generous: { windowMs: 60 * 1000, max: 5 }, // 1 分钟内 5 次

  // API 读取操作
  read: { windowMs: 1000, max: 30 }, // 1 秒内 30 次
};
