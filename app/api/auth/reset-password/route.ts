import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { z } from "zod";
import crypto from "crypto";

// 会写数据库，绝不能被构建期预渲染
export const dynamic = "force-dynamic";

const resetSchema = z.object({
  token: z.string().min(1, "缺少重置令牌"),
  password: z
    .string()
    .min(8, "密码至少 8 位")
    .max(72, "密码最多 72 位")
    .regex(/[a-zA-Z]/, "密码需包含字母")
    .regex(/[0-9]/, "密码需包含数字"),
});

/**
 * POST /api/auth/reset-password
 *
 * 用邮件里的 token 换一个新密码。
 *
 * 几个必须成立的点：
 * - token 只接受一次：用完立刻写 usedAt，同一个链接不能重放。
 * - 过期即废：expiresAt 到点就拒绝，不管 token 内容对不对。
 * - 改密码的同时删掉该用户所有其它未用 token：
 *   用户主动重置说明可能怀疑账号被盗，其它还活着的链接应当一起失效。
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const { token, password } = resetSchema.parse(body);

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        expiresAt: true,
        usedAt: true,
      },
    });

    // 统一文案：不区分「没这个 token」和「已过期」，
    // 否则攻击者能通过错误信息判断 token 是否存在过。
    if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { success: false, message: "重置链接无效或已过期，请重新申请" },
        { status: 400 }
      );
    }

    const passwordHash = await hash(password, 10);
    const now = new Date();

    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: now },
      }),
      // 其余未使用的 token 一并作废
      prisma.passwordResetToken.updateMany({
        where: { userId: record.userId, usedAt: null, id: { not: record.id } },
        data: { usedAt: now },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "密码已重置，请用新密码登录",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: error.issues[0]?.message || "输入不合法" },
        { status: 400 }
      );
    }
    console.error("重置密码失败:", error);
    return NextResponse.json(
      { success: false, message: "重置失败，请稍后重试" },
      { status: 500 }
    );
  }
}
