import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { hash, compare } from "bcryptjs";
import { z } from "zod";
import { readJsonBody } from "@/lib/request";

// 会写数据库，绝不能被构建期预渲染
export const dynamic = "force-dynamic";

const changePasswordSchema = z.object({
  // 旧密码只校验非空，不套用「8 位 + 字母数字」那套新密码规则。
  // 这里核对的是用户已有的密码，可能是策略收紧前注册的 6 位密码。
  // 卡死它等于让老用户永远改不了密码。
  currentPassword: z.string().min(1, "请输入当前密码"),
  // 新密码与注册、重置保持同一套规则，避免三个入口三种标准。
  newPassword: z
    .string()
    .min(8, "密码至少 8 位")
    .max(72, "密码最多 72 位")
    .regex(/[a-zA-Z]/, "密码需包含字母")
    .regex(/[0-9]/, "密码需包含数字"),
});

/**
 * POST /api/profile/password
 *
 * 个人中心「账号安全」里的修改密码。
 *
 * 为什么必须校验旧密码：JWT 有效期 7 天，如果只凭「当前登录态」就能
 * 改密码，那么任何拿到未过期的 token 的人（比如公用电脑上没退出的
 * 浏览器）都能把账号彻底接管 —— 改完密码原主人就进不去了。
 *
 * 改完同时清掉其它未使用的重置 token：用户主动改密码往往意味着
 * 怀疑账号异常，此时还活着的重置链接应当一起作废。
 */
export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user, isGuest } = auth;

    if (isGuest) {
      return NextResponse.json(
        { success: false, message: "访客模式下无法修改密码" },
        { status: 403 }
      );
    }

    const parsed = await readJsonBody(req, "请提供当前密码和新密码");
    if (!parsed.ok) return parsed.response;

    const result = changePasswordSchema.safeParse(parsed.data);
    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.error.issues[0]?.message || "密码格式不正确",
        },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = result.data;

    // 统一提示「当前密码不正确」，不区分「没设过密码」和「密码错了」——
    // 后者会让攻击者知道这个账号有没有密码。
    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    if (!record?.passwordHash) {
      return NextResponse.json(
        { success: false, message: "当前密码不正确" },
        { status: 400 }
      );
    }

    const isValid = await compare(currentPassword, record.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: "当前密码不正确" },
        { status: 400 }
      );
    }

    // 新旧密码相同就直接拒绝：改了个寂寞，用户还以为自己加固了账号。
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { success: false, message: "新密码不能与当前密码相同" },
        { status: 400 }
      );
    }

    const passwordHash = await hash(newPassword, 10);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.deleteMany({
        where: { userId: user.id, usedAt: null },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "密码已修改，请用新密码重新登录",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json(
      { success: false, message: "修改失败，请稍后重试" },
      { status: 500 }
    );
  }
}
