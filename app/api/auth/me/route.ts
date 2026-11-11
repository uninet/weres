import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserFromRequest } from "@/lib/auth";

/**
 * 获取当前登录用户信息
 * GET /api/auth/me
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUserFromRequest(req);

    if (!user) {
      return NextResponse.json(
        { 
          code: "UNAUTHORIZED",
          message: "未登录或登录已过期" 
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      code: "SUCCESS",
      data: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatar: user.avatar,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    return NextResponse.json(
      { 
        code: "INTERNAL_ERROR",
        message: "获取用户信息失败" 
      },
      { status: 500 }
    );
  }
}
