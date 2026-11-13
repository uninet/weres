import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/request";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { createToken, shouldUseSecureCookie } from "@/lib/auth";
import {
  getClientIdentifier,
  checkGlobalRateLimit,
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
    //
    // 先用 readJsonBody：这是登录接口，是暴露在公网上被扫的第一个点。
    // 原来直接 `await req.json()`，畸形 JSON 会抛 SyntaxError 落进 catch
    // 变成 500「服务器错误」—— 攻击者能靠这个把错误日志刷满，
    // 而正常的客户端配置错了（少个引号）看到的也是 500 而不是「你的请求有问题」。
    const parsed = await readJsonBody<{ email?: string; password?: string }>(
      req,
      "请提供邮箱和密码"
    );
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;

    // 三层限流，缺一层就有可被利用的形态：
    //
    //   1. 按「IP + 邮箱」计数（strict，5 次/15 分钟）
    //      —— 挡同一个人对同一账号反复试。
    //   2. 按邮箱计数（loginAccount，30 次/15 分钟）
    //      —— 挡分布式撞库（换 IP 继续试同一个账号）。
    //   3. 全实例（globalLogin，120 次/分钟）
    //      —— 挡「换 IP 换邮箱」的无差别灌，每次尝试都要跑 bcrypt，
    //         不封顶的话 CPU 会被打满。
    //
    // 为什么第 1 层必须带 IP：之前只有 `login:<email>` 一层，
    // 那意味着攻击者用错误密码点 5 次就能把某个邮箱锁死 —— 他不知道
    // 密码也能让主人登不进去。实测错误密码第 6 次 429，随后正确密码
    // 也是 429。这是拿防爆破换了「锁定他人账号」的 DOS。
    // 带上 IP 后，攻击者只能锁住自己那台机器对某账号的尝试。
    const emailKey = body.email ? body.email.trim().toLowerCase() : "";

    const perClient = checkRateLimit(
      emailKey ? `login:${getClientIdentifier(req)}:${emailKey}` : `login:${getClientIdentifier(req)}`,
      rateLimitConfigs.strict
    );
    const globalRate = checkGlobalRateLimit("login", rateLimitConfigs.globalLogin);

    if (!perClient.success || !globalRate.success) {
      const blocked = !perClient.success ? perClient : globalRate;
      return NextResponse.json(
        {
          success: false,
          message: "尝试次数过多，请稍后再试",
          retryAfter: Math.ceil((blocked.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(rateLimitConfigs.strict.max),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": blocked.resetTime.toString(),
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
      // 账号级的配额只在「密码错了」时才计数。
      //
      // 它防的是分布式撞库：很多 IP 同时试同一个邮箱。这类攻击的特征
      // 是大量失败，不是大量成功 —— 成功登录说明密码已经对了，再记一笔
      // 只会惩罚合法用户。实测把它算进来的后果是：一套 UI 测试每条用例
      // 登录一次，跑两轮就把演示账号锁在 30 次/15 分钟之外，
      // 报错还是「尝试次数过多」，看起来像限流坏了。
      if (emailKey) {
        const perAccount = checkRateLimit(`login-account:${emailKey}`, rateLimitConfigs.loginAccount);
        if (!perAccount.success) {
          return NextResponse.json(
            {
              success: false,
              message: "尝试次数过多，请稍后再试",
              retryAfter: Math.ceil((perAccount.resetTime - Date.now()) / 1000),
            },
            {
              status: 429,
              headers: {
                "X-RateLimit-Limit": String(rateLimitConfigs.loginAccount.max),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": perAccount.resetTime.toString(),
              },
            }
          );
        }
      }
      return NextResponse.json(
        { success: false, message: "邮箱或密码错误" },
        { status: 401 }
      );
    }

    // 登录成功 → 清零失败计数。
    //
    // 不加这一步的话，用户正常登录登出几轮就会被自己的成功登录锁住，
    // 15 分钟内再也登不进来。限流要挡的是猜密码，不是合法用户。
    //
    // 只清 IP+邮箱这一层：账号级的配额是给分布式撞库留的，
    // 成功登录一次就清零等于告诉攻击者「找到了正确入口可以重新开始计数」。
    // 它被 30 次/15 分钟封顶，正常用户（一天登几次）永远碰不到。
    resetRateLimit(
      emailKey
        ? `login:${getClientIdentifier(req)}:${emailKey}`
        : `login:${getClientIdentifier(req)}`
    );

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
      secure: shouldUseSecureCookie(req),
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
