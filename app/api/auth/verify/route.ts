import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

// 这个接口要读请求头里的 Authorization，本身就依赖请求。
// 不声明的话 Next 仍会在构建期尝试静态渲染，取 headers 时抛
// "Dynamic server usage" —— 虽然被 catch 住了不影响构建成功，
// 但会在日志里刷一条看起来像故障的报错。
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { success: false, message: "未提供认证令牌" },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { success: false, message: "认证令牌无效或已过期" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        userId: payload.sub,
        email: payload.email,
      },
    });
  } catch (error) {
    console.error("Token verification error:", error);
    return NextResponse.json(
      { success: false, message: "认证失败" },
      { status: 500 }
    );
  }
}
