import { compare } from "bcryptjs";
import { prisma } from "./prisma";
import { z } from "zod";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// JWT 配置
const JWT_EXPIRATION = "7d";

/**
 * 已知的示例 / 占位密钥：一旦用于签发 token，等同于没有鉴权。
 * 任何人拿到源码都能伪造登录，因此必须显式拒绝。
 */
const FORBIDDEN_SECRETS = new Set([
  "your-secret-key",
  "your-jwt-secret",
  "your-jwt-secret-key",
  "your-jwt-secret-key-change-in-production",
  "local-dev-secret-key-change-in-production",
  "change-me",
  "changeme",
  "secret",
  "test-secret",
]);

const MIN_SECRET_LENGTH = 32;

/**
 * 配置类错误的专用类型。
 *
 * 普通异常（token 无效、过期、用户不存在）应该被安全地降级为「未登录」；
 * 但配置错误必须冒泡出去，否则线上只会表现为「谁都无法登录」，
 * 而运维看不到真正的根因。
 */
export class AuthConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthConfigError";
  }
}

let cachedSecret: Uint8Array | null = null;

/**
 * 获取 JWT Secret。
 *
 * 设计要点（安全）：
 * 1. 绝不提供硬编码兜底值——缺失配置时直接抛错，而不是静默降级为公开密钥。
 * 2. 拒绝示例/占位值，避免用户「照抄 .env.example」后带着公开密钥上线。
 * 3. 延迟到首次使用时才校验（而非模块加载时），是为了不阻断 `next build`
 *    期间对模块的静态分析。
 */
function getJwtSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;

  const secret = process.env.JWT_SECRET?.trim();

  if (!secret) {
    throw new AuthConfigError(
      "[auth] 缺少环境变量 JWT_SECRET。\n" +
        "请在项目根目录的 .env 文件中设置一个随机密钥，例如：\n" +
        "  openssl rand -base64 32\n" +
        "然后写入：JWT_SECRET=\"<生成的随机值>\""
    );
  }

  if (FORBIDDEN_SECRETS.has(secret)) {
    throw new AuthConfigError(
      `[auth] JWT_SECRET 当前使用的是示例/占位值（${secret}），任何人都能用它伪造登录令牌。\n` +
        "请替换为随机密钥：openssl rand -base64 32"
    );
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new AuthConfigError(
      `[auth] JWT_SECRET 长度不足（当前 ${secret.length} 字符，至少需要 ${MIN_SECRET_LENGTH}）。\n` +
        "请生成随机密钥：openssl rand -base64 32"
    );
  }

  cachedSecret = new TextEncoder().encode(secret);
  return cachedSecret;
}

export interface JWTPayload {
  sub: string;
  email: string;
  nickname?: string | null;
  avatar?: string | null;
  iat: number;
  exp: number;
}

/**
 * 签发 JWT Token
 */
export async function createToken(user: {
  id: string;
  email: string;
  nickname?: string | null;
  avatar?: string | null;
}): Promise<string> {
  const secret = getJwtSecret();
  
  const token = await new SignJWT({
    email: user.email,
    nickname: user.nickname,
    avatar: user.avatar,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION)
    .sign(secret);

  return token;
}

/**
 * 验证 JWT Token
 *
 * 注意：配置错误（缺 JWT_SECRET / 使用了占位密钥）会向上抛出，
 * 不会被吞成 null。否则运维只会看到「所有用户都登录失败」，
 * 却不知道根因是环境变量没配。
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
  const secret = getJwtSecret(); // 配置错误在这里抛出，不吞
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      sub: payload.sub as string,
      email: payload.email as string,
      nickname: payload.nickname as string | null | undefined,
      avatar: payload.avatar as string | null | undefined,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch {
    // 这里只捕获「token 本身无效 / 过期」这类正常情况
    return null;
  }
}

/**
 * 验证用户登录凭证
 */
export async function authenticateUser(email: string, password: string) {
  try {
    const { email: validEmail, password: validPassword } = credentialsSchema.parse({
      email,
      password,
    });

    const user = await prisma.user.findUnique({
      where: { email: validEmail },
    });

    if (!user || !user.passwordHash) {
      return null;
    }

    const isValid = await compare(validPassword, user.passwordHash);

    if (!isValid) {
      return null;
    }

    if (user.status === "SUSPENDED") {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.nickname,
      image: user.avatar,
    };
  } catch (error) {
    if (error instanceof AuthConfigError) throw error;
    return null;
  }
}

/**
 * 获取当前登录用户（Server Component 中使用）
 */
export async function getCurrentUser() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get("token")?.value;

    if (!token) {
      return null;
    }

    // 验证 JWT token
    const payload = await verifyToken(token);

    if (!payload?.sub) {
      return null;
    }

    // 获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string },
      select: {
        id: true,
        email: true,
        nickname: true,
        avatar: true,
        status: true,
        // Kindle 推送需要知道往哪个地址发。放在这里是因为
        // requireAuth 的调用方（推送接口、设置页）都要用它。
        kindleEmail: true,
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatar: user.avatar,
      kindleEmail: user.kindleEmail,
    };
  } catch (error) {
    // 配置错误必须上抛，不能伪装成「未登录」
    if (error instanceof AuthConfigError) throw error;
    return null;
  }
}

/**
 * 从请求头获取当前用户（API Route 中使用）
 */
export async function getCurrentUserFromRequest(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const cookieHeader = req.headers.get("cookie");
    
    let token: string | null = null;

    // 优先从 Authorization Header 获取
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
    
    // 否则从 Cookie 获取
    if (!token && cookieHeader) {
      const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split("=");
        acc[key] = value;
        return acc;
      }, {} as Record<string, string>);
      token = cookies["token"] || null;
    }

    if (!token) {
      return null;
    }

    // 验证 JWT token
    const payload = await verifyToken(token);

    if (!payload?.sub) {
      return null;
    }

    // 获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: payload.sub as string },
      select: {
        id: true,
        email: true,
        nickname: true,
        avatar: true,
        status: true,
        // Kindle 推送需要知道往哪个地址发。放在这里是因为
        // requireAuth 的调用方（推送接口、设置页）都要用它。
        kindleEmail: true,
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatar: user.avatar,
      kindleEmail: user.kindleEmail,
    };
  } catch (error) {
    // 配置错误必须上抛，不能伪装成「未登录」
    if (error instanceof AuthConfigError) throw error;
    return null;
  }
}

/**
 * 访客账号（演示模式）的固定 ID。
 *
 * 注意：访客模式是「所有人共用同一个演示账号」，因此它绝不能拿到
 * 真实用户的数据。这个账号在干净环境里并不存在，早期版本假设某个
 * seed 脚本会预先写进去，结果没跑过脚本的部署里访客模式静默失效；
 * 现在改为按需惰性创建，并在生产环境默认关闭。
 */
export const GUEST_USER_ID = "guest-user-id";
export const GUEST_USER_EMAIL = "guest@werss.com";

/**
 * 访客模式开关。
 *
 * - 开发环境默认开启，方便本地体验。
 * - 生产环境默认关闭：一旦开启，所有匿名访客共享同一账号下的订阅与
 *   阅读记录，且任何人都能写入这个共享账号。需要显式设置
 *   ALLOW_GUEST_MODE=true 才会启用。
 */
function isGuestModeEnabled(): boolean {
  const flag = process.env.ALLOW_GUEST_MODE?.trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return process.env.NODE_ENV !== "production";
}

/**
 * 获取（必要时创建）访客账号。
 * 用 upsert 保证并发下不会创建出两条同 ID 记录。
 */
async function ensureGuestUser() {
  const existing = await prisma.user.findUnique({
    where: { id: GUEST_USER_ID },
    select: {
      id: true,
      email: true,
      nickname: true,
      avatar: true,
      status: true,
    },
  });

  if (existing) {
    return existing.status === "ACTIVE" ? existing : null;
  }

  try {
    return await prisma.user.create({
      data: {
        id: GUEST_USER_ID,
        email: GUEST_USER_EMAIL,
        nickname: "访客",
        bio: "演示模式访客账号",
        status: "ACTIVE",
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        avatar: true,
        status: true,
      },
    });
  } catch (error) {
    // 并发创建时可能撞唯一约束，重查一次即可
    console.error("[auth] 创建访客账号失败:", error);
    const retried = await prisma.user.findUnique({
      where: { id: GUEST_USER_ID },
      select: {
        id: true,
        email: true,
        nickname: true,
        avatar: true,
        status: true,
      },
    });
    return retried?.status === "ACTIVE" ? retried : null;
  }
}

/**
 * 认证中间件 - 保护 API 路由
 * @param req - 请求对象
 * @param options - 选项配置
 * @param options.allowGuest - 是否允许访客访问（默认 false）
 */
export async function requireAuth(
  req: Request,
  options: { allowGuest?: boolean } = {}
) {
  const { allowGuest = false } = options;
  const user = await getCurrentUserFromRequest(req);

  if (!user) {
    if (allowGuest && isGuestModeEnabled()) {
      const guestUser = await ensureGuestUser();

      if (guestUser) {
        return {
          user: {
            id: guestUser.id,
            email: guestUser.email,
            nickname: guestUser.nickname,
            avatar: guestUser.avatar,
            // 访客没有 Kindle 地址。显式给 null 是为了让两种返回分支
            // 的字段形状一致，调用方不用做存在性判断。
            kindleEmail: null,
            isGuest: true,
          },
          isGuest: true,
        };
      }
    }

    return {
      error: {
        code: "UNAUTHORIZED",
        message: "请先登录",
      },
      status: 401,
    };
  }

  const isGuest = user.id === GUEST_USER_ID;

  return {
    user: {
      ...user,
      isGuest,
    },
    isGuest,
  };
}
