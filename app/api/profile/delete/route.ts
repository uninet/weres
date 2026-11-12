import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, GUEST_USER_ID } from "@/lib/auth";
import { compare } from "bcryptjs";
import { readJsonBody } from "@/lib/request";

// 会删数据库，绝不能被构建期预渲染
export const dynamic = "force-dynamic";

/**
 * POST /api/profile/delete
 *
 * 账号注销。
 *
 * 之前个人中心里这个按钮只弹一句「账号注销功能开发中」——
 * 一个承诺了却永远兑现不了的入口。要么实现，要么从界面上拿掉；
 * 留着一个骗人的按钮是最差的选择。
 *
 * 这里选择实现，但加了两道闸：
 *   1. 必须输当前密码。注销是不可逆的，只凭登录态不够 ——
 *      公用电脑上没退出登录的人一样能删光别人的数据。
 *   2. 必须显式传 confirm: "DELETE"。前端弹窗里要用户手输，
 *      避免误触连点两下就把账号删了。
 *
 * 关联数据靠 schema 里的 onDelete: Cascade 清掉
 * （订阅、分组、收藏、阅读历史、通知、登录日志、标签、
 * Kindle 投递记录、重置令牌都在 User 上有级联）。
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
        { success: false, message: "访客账号不支持注销" },
        { status: 403 }
      );
    }

    // 演示账号不能删：删掉之后 README 里的演示登录就废了，
    // 而换一个人重新部署时又会遇到同样的问题。
    // 这里用固定的访客 id 之外再挡一次，避免 seed 的演示账号被误删。
    if (user.id === GUEST_USER_ID) {
      return NextResponse.json(
        { success: false, message: "演示账号不支持注销" },
        { status: 403 }
      );
    }

    const parsed = await readJsonBody(req, "请提供密码以确认注销");
    if (!parsed.ok) return parsed.response;

    const body = parsed.data as {
      password?: unknown;
      confirm?: unknown;
    };

    if (body.confirm !== "DELETE") {
      return NextResponse.json(
        { success: false, message: "请确认注销操作" },
        { status: 400 }
      );
    }

    const password = typeof body.password === "string" ? body.password : "";
    if (!password) {
      return NextResponse.json(
        { success: false, message: "请输入密码" },
        { status: 400 }
      );
    }

    const record = await prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });

    if (!record?.passwordHash) {
      return NextResponse.json(
        { success: false, message: "密码不正确" },
        { status: 400 }
      );
    }

    const isValid = await compare(password, record.passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { success: false, message: "密码不正确" },
        { status: 400 }
      );
    }

    await prisma.user.delete({ where: { id: user.id } });

    // 登出：用户已被删除，留着 Cookie 只会让后续请求全部 401，
    // 前端表现成「页面空白」而不是「已退出」。
    const response = NextResponse.json({
      success: true,
      message: "账号已注销",
    });
    response.cookies.delete("token");
    return response;
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json(
      { success: false, message: "注销失败，请稍后重试" },
      { status: 500 }
    );
  }
}
