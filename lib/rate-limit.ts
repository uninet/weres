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
 *
 * ⚠️ 这个值**可以被客户端伪造**，只适合用来做「同一访客不要连点」这类
 * 公平性限流，**不能当作安全边界**。
 *
 * 原因：Next.js 的 Route Handler 拿不到 TCP 连接的真实对端地址，
 * 只能读 `X-Forwarded-For`。实测确认 Next 会把这个头**原样透传**：
 * 客户端发 `X-Forwarded-For: 1.1.1.1` 服务端就读到 `1.1.1.1`，
 * 发 `1.1.1.1, 2.2.2.2` 就读到整串，中间不会插入真实 IP。
 *
 * 因此只有两种用法是安全的：
 *  1. 反代的后面（nginx/Caddy）且反代自己覆盖了这个头 —— 设 TRUST_PROXY=true，
 *     此时取最后一跳（反代填的），而不是客户端伪造的第一跳。
 *  2. 不把它当唯一防线 —— 关键接口必须再叠一层不依赖 IP 的全局上限
 *     （见下面的 checkGlobalRateLimit）。伪造 IP 也顶不破全局桶。
 */
export function getClientIdentifier(req: Request): string {
  const trustProxy = process.env.TRUST_PROXY === "true";
  const forwardedFor = req.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const hops = forwardedFor
      .split(",")
      .map((part) => part.trim())
      // 空段和明显不是地址的段直接丢掉，避免用 "unknown" 之类的值当 key
      .filter((part) => part.length > 0);

    if (hops.length > 0) {
      // 反代模式下取最后一跳：那是你自己的反代填的，客户端改不到。
      // 非反代模式只能取第一跳 —— 虽然可伪造，但至少让正常用户之间不互相挤占。
      return trustProxy ? hops[hops.length - 1] : hops[0];
    }
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  return "anonymous";
}

/**
 * 全局速率上限：**不依赖任何客户端可控的输入**。
 *
 * 用于兜住「按 IP 限流但 IP 可伪造」的漏洞。即使攻击者每次换一个
 * 伪造的 X-Forwarded-For，所有请求仍然共享同一个计数桶，
 * 因此无法把接口放大成免费的抓取代理 / 发信机。
 *
 * 代价是同一时间窗内所有用户共享额度 —— 所以额度要按「整个实例
 * 能承受多少」来设，而不是按「单个用户能用多少」。
 */
export function checkGlobalRateLimit(
  name: string,
  config: RateLimitConfig
): { success: boolean; remaining: number; resetTime: number } {
  return checkRateLimit(`__global__:${name}`, config);
}

/**
 * 仅供测试使用：清空全部计数。
 */
export function __resetAllRateLimits(): void {
  store.clear();
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
 * 预定义的速率限制配置
 */
export const rateLimitConfigs = {
  // 严格限制：用于登录等敏感操作。
  // 5 次/15 分钟只统计「失败」的尝试（成功登录会重置计数）——
  // 这个额度是给暴力破解留的，不是给正常用户的。
  strict: { windowMs: 15 * 60 * 1000, max: 5 },

  // 标准限制：用于一般 API
  standard: { windowMs: 60 * 1000, max: 10 }, // 1 分钟内 10 次

  // 宽松限制：用于 RSS 抓取等耗时操作。
  //
  // 原来是 5 次/分钟，实测下来对手动添加订阅太紧了：用户手输一个链接，
  // 少个斜杠、协议写成 http、或者抄了个不完整的地址，都是很常见的试错，
  // 5 次就被锁一分钟，表现是「点添加没反应」。
  //
  // 这里的目的是防有人拿这个接口当免费抓取代理（每次都会让服务端真的
  // 去 fetch 一个外网地址），不是防正常人试错。20 次/分钟足够挡住滥用，
  // 又不会让人撞墙。
  generous: { windowMs: 60 * 1000, max: 20 },

  // API 读取操作
  read: { windowMs: 1000, max: 30 }, // 1 秒内 30 次

  // 账号级：只用来兜住「分布式撞库」（同一账号被很多 IP 同时试）。
  //
  // 为什么不能像 strict 那样给 5 次：账号级的计数不区分来源 IP，
  // 攻击者只要知道你的邮箱，用错误密码点 5 次就能把你锁在门外
  // （实测：错误密码第 6 次 429，之后用正确密码登录也是 429）。
  // 这是拿「防爆破」换来的「锁定别人账号」的 DOS —— 不该存在。
  // 放宽到 30 次/15 分钟：单个正常用户碰不到，分布式撞库仍然被封顶。
  loginAccount: { windowMs: 15 * 60 * 1000, max: 30 },

  // 全局兜底：整个实例共享，用来防「伪造 X-Forwarded-For 绕过按 IP 限流」。
  //
  // 这个接口每次都会真的去 fetch 一个外网地址，攻击者换 IP 就能无限刷，
  // 等于把服务端变成免费抓取代理。单 IP 额度（generous）负责让正常用户
  // 之间别互相挤占，全局额度负责让整个实例的抓取总量有上界。
  globalValidate: { windowMs: 60 * 1000, max: 120 }, // 全实例 2 次/秒

  // 忘记密码会真的发一封邮件，没有全局上限时换 IP 就能把实例当发信机用。
  globalForgotPassword: { windowMs: 60 * 1000, max: 30 },

  // 注册同理：换 IP 就能无限建号。
  globalRegister: { windowMs: 60 * 1000, max: 60 },

  // 登录的全局兜底：攻击者换 IP + 换邮箱就能绕过前两层，
  // 而每次尝试都要跑一次 bcrypt（故意很慢），大量并发会把 CPU 打满。
  globalLogin: { windowMs: 60 * 1000, max: 120 },
};
