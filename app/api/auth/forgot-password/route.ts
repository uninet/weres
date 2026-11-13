import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/request";
import { prisma } from "@/lib/prisma";
import { getSmtpConfig, getTransporter } from "@/lib/kindle";
import { z } from "zod";
import crypto from "crypto";
import {
  checkRateLimit,
  checkGlobalRateLimit,
  getClientIdentifier,
  rateLimitConfigs,
} from "@/lib/rate-limit";

// 要读写数据库与发信，绝不能被构建期预渲染
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  email: z.string().email("请输入有效的邮箱地址"),
});

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 小时

/**
 * POST /api/auth/forgot-password
 *
 * 发一封带重置链接的邮件。
 *
 * 两个刻意的设计：
 *
 * 1. **无论邮箱是否存在都返回成功**。
 *    如果「不存在」返回 404、「存在」返回 200，这个接口就成了
 *    批量探测「哪些邮箱注册过本站」的工具。返回同一句话，
 *    真正的信息只出现在收件人自己的邮箱里。
 *
 * 2. **没配 SMTP 时明确说没配**，而不是假装发了。
 *    不知道自己在跑什么版本的用户，会去邮箱等一晚上。
 */
export async function POST(req: Request) {
  try {
    // 重置邮件是最容易被拿来当免费发信机的接口，限制比登录更严。
    //
    // 这里只能按 IP 限流（邮箱在 body 里，伪造一个没注册的邮箱就绕过了），
    // 而 X-Forwarded-For 客户端可伪造 —— 所以必须再叠一层全局上限，
    // 否则换 IP 就能把这台实例当作发信机用。
    // 先确认有没有邮件通道，再决定要不要记这次额度。
    //
    // 没配 SMTP 时这个分支只回一句话：不发信、不查库、不建 token，
    // 它没有任何可被滥用的成本，却要占掉「15 分钟 5 次」的发信额度 ——
    // 结果是用户点几次之后看到的是「请求过于频繁」，而不是真正的原因
    // 「服务端没配邮件通道」，照着前者去等 15 分钟也永远不会好。
    // 先校验请求形状，再判「有没有邮件通道」。
    // 顺序很重要：解析 body 是零成本的本地操作，不消耗发信额度；
    // 而畸形 JSON 应该得到「你的请求不对」（400），不是「服务端没配邮件」（503）——
    // 后者会把调用方引向完全错误的方向。
    const parsedBody = await readJsonBody<{ email?: string }>(req, "请提供注册邮箱");
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data;

    const smtp = getSmtpConfig();
    if (!smtp) {
      return NextResponse.json(
        {
          success: false,
          message:
            "服务端未配置邮件通道，无法发送重置邮件。请改用注册新账号，或联系部署者。",
        },
        { status: 503 }
      );
    }

    const globalRate = checkGlobalRateLimit(
      "forgot-password",
      rateLimitConfigs.globalForgotPassword
    );
    const identifier = getClientIdentifier(req);
    const rate = checkRateLimit(`forgot:${identifier}`, rateLimitConfigs.strict);
    if (!rate.success || !globalRate.success) {
      return NextResponse.json(
        { success: false, message: "请求过于频繁，请稍后再试" },
        { status: 429 }
      );
    }

    const { email } = requestSchema.parse(body);

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, nickname: true, status: true },
    });

    // 用户不存在 / 被停用：同样返回成功，不泄漏任何信息
    if (!user || user.status !== "ACTIVE") {
      return NextResponse.json({
        success: true,
        message: "如果该邮箱已注册，重置链接会在一分钟内送达",
      });
    }

    // token 只存哈希，数据库泄露也无法直接拿来重置别人密码
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });

    const baseUrl =
      process.env.NEXTAUTH_URL?.replace(/\/$/, "") || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

    try {
      const transporter = getTransporter(smtp);
      await transporter.sendMail({
        from: smtp.from,
        to: user.email!,
        subject: "重置你的 WeRSS 密码",
        text: [
          `你好${user.nickname ? `，${user.nickname}` : ""}：`,
          "",
          "有人（希望是你本人）请求重置这个邮箱对应的 WeRSS 密码。",
          `如果确实是你，请打开下面的链接（1 小时内有效，只能使用一次）：`,
          "",
          resetUrl,
          "",
          "如果不是你发起的，忽略这封邮件即可 —— 你的密码不会被改动。",
        ].join("\n"),
      });
    } catch (error) {
      console.error("发送重置邮件失败:", error);
      // 邮件没发出去，刚建的那条 token 就是垃圾数据，清掉
      await prisma.passwordResetToken
        .deleteMany({ where: { tokenHash } })
        .catch(() => undefined);
      return NextResponse.json(
        { success: false, message: "邮件发送失败，请稍后重试或联系部署者" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "如果该邮箱已注册，重置链接会在一分钟内送达",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: error.issues[0]?.message || "邮箱格式不正确" },
        { status: 400 }
      );
    }
    console.error("忘记密码失败:", error);
    return NextResponse.json(
      { success: false, message: "操作失败，请稍后重试" },
      { status: 500 }
    );
  }
}
