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
