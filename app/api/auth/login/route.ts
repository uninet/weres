import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createToken } from "@/lib/auth";
import {
  getClientIdentifier,
  checkRateLimit,
  resetRateLimit,
  rateLimitConfigs,
} from "@/lib/rate-limit";

// 登录的口令下限刻意保持 6 位，不跟注册/重置的 8 位对齐。
//
// 这里校验的是「用户已有的密码」，不是「用户要设的新密码」。
// 收紧它不会提升任何安全性（错误密码照样被 bcrypt 拒绝），只会把
// 在策略变更前注册的老账号锁在门外——包括 seed 里的演示账号。
// 真正的强度约束加在 register 与 reset-password 两处。
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(req: Request) {
  try {
    // 速率限制 - 防止暴力破解（使用邮箱作为标识）
    const body = await req.json();
    const identifier = body.email ? `login:${body.email.toLowerCase()}` : getClientIdentifier(req);
    const rateLimit = checkRateLimit(identifier, rateLimitConfigs.strict);

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          message: "尝试次数过多，请稍后再试",
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "5",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimit.resetTime.toString(),
          },
        }
      );
    }

    const { email, password } = loginSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { success: false, message: "邮箱或密码错误" },
        { status: 401 }
      );
    }

    const isValid = await compare(password, user.passwordHash);

    if (!isValid) {
      return NextResponse.json(
        { success: false, message: "邮箱或密码错误" },
        { status: 401 }
      );
    }

    // 登录成功 → 清零失败计数。
    //
    // 不加这一步的话，用户正常登录登出几轮就会被自己的成功登录锁住，
    // 15 分钟内再也登不进来。限流要挡的是猜密码，不是合法用户。
    resetRateLimit(identifier);

    if (user.status === "SUSPENDED") {
      return NextResponse.json(
        { success: false, message: "账号已被禁用" },
        { status: 403 }
      );
    }

    // 验证用户必须有邮箱
    if (!user.email) {
      return NextResponse.json(
        { success: false, message: "用户邮箱无效" },
        { status: 400 }
      );
    }

    // 记录登录日志。
    //
    // LoginLog 表建了很久但一直没有写入方 —— 表在那、索引在那、
    // 关系也在那，就是没人填。安全上有两个用处：用户能看出「这个账号
    // 在哪些地方登录过」，异常登录时也有据可查。
    //
    // 这一步失败不影响登录：拿不到 IP/UA 不该把用户挡在门外。
    try {
      await prisma.loginLog.create({
        data: {
          userId: user.id,
          ipAddress: getClientIdentifier(req),
          userAgent: req.headers.get("user-agent")?.slice(0, 500) || "unknown",
          // deviceInfo 留空：解析 UA 需要额外依赖，而这里的信息
          // 已经足够回答「什么时候、从哪台机器登录过」。
          deviceInfo: null,
        },
      });
    } catch (logError) {
      console.error("记录登录日志失败:", logError);
    }

    // 生成 JWT token
    const token = await createToken({
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      avatar: user.avatar,
    });

    // 创建响应并设置 HttpOnly Cookie
    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          avatar: user.avatar,
        },
      },
      message: "登录成功",
    });

    // 设置 HttpOnly Cookie，防止 XSS 攻击
    response.cookies.set({
      name: "token",
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 天
      path: "/",
    });

    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: "输入数据无效" },
        { status: 400 }
      );
    }

    console.error("Login error:", error);
    return NextResponse.json(
      { success: false, message: "服务器错误" },
      { status: 500 }
    );
  }
}
