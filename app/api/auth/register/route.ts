import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createToken } from "@/lib/auth";
import {
  getClientIdentifier,
  checkRateLimit,
  checkGlobalRateLimit,
  rateLimitConfigs,
} from "@/lib/rate-limit";

// 密码策略与 /api/auth/reset-password 保持一致：8–72 位，且必须同时
// 含字母和数字。
//
// 原来是 6–20 位、没有任何复杂度要求，所以 "123456" 和 "abcdef" 都能
// 注册成功。这跟重置密码那条链路（要求 8 位 + 字母数字）自相矛盾：
// 用户被强制重置成一个强密码，却能再注册一个纯数字弱密码。
// 上限 72 是 bcrypt 的输入截断点，超过的部分会被静默丢弃。
const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, "密码至少 8 位")
    .max(72, "密码最多 72 位")
    .regex(/[A-Za-z]/, "密码需要包含字母")
    .regex(/[0-9]/, "密码需要包含数字"),
  nickname: z.string().min(2, "昵称至少 2 个字").max(20, "昵称最多 20 个字").optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 速率限制 - 防止恶意注册
    //
    // 单邮箱一层挡住「对同一个邮箱反复试」，
    // 全局一层挡住「换邮箱批量建号」—— 后者才是真正的滥用形态，
    // 而邮箱是攻击者自己填的，只按邮箱计数的限流对它没有约束力。
    const globalRate = checkGlobalRateLimit(
      "register",
      rateLimitConfigs.globalRegister
    );
    const identifier = body.email 
      ? `register:${body.email.toLowerCase()}` 
      : getClientIdentifier(req);
    const rateLimit = checkRateLimit(identifier, rateLimitConfigs.strict);

    if (!rateLimit.success || !globalRate.success) {
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

    const { email, password, nickname } = registerSchema.parse(body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { success: false, message: "该邮箱已被注册" },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        nickname: nickname || email.split("@")[0],
        status: "ACTIVE",
      },
    });

    // 生成 JWT token 并自动登录 (email 在创建时已验证非空)
    const token = await createToken({
      id: user.id,
      email: user.email!,
      nickname: user.nickname,
      avatar: user.avatar,
    });

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
      message: "注册成功",
    });

    // 设置 HttpOnly Cookie
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
        { success: false, message: "输入数据无效", errors: error.issues },
        { status: 400 }
      );
    }

    console.error("Register error:", error);
    return NextResponse.json(
      { success: false, message: "服务器错误" },
      { status: 500 }
    );
  }
}
