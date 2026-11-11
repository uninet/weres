import { NextResponse } from "next/server";

// 登出接口不读数据库，但会写 Cookie，必须实时执行
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout
 *
 * 清除登录 Cookie。
 *
 * 为什么必须有这个接口：
 *   登录 Cookie 是 HttpOnly 的，前端 JS 读不到也删不掉。
 *   没有服务端登出接口时，「退出登录」只能靠前端把页面跳回登录页，
 *   而 Cookie 仍然有效 7 天 —— 在公用电脑上这等同于没退出。
 *
 * 同时用 POST 而不是 GET：GET 形式的登出可以被任意第三方页面
 * 通过 <img src="/api/auth/logout"> 触发，属于 CSRF 登出。
 */
export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "已退出登录",
  });

  // 覆盖写入空值 + 立即过期。
  // 属性必须与登录时一致（path/secure/sameSite），否则某些浏览器
  // 会认为是另一个 Cookie，删不掉原来那个。
  response.cookies.set({
    name: "token",
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    expires: new Date(0),
    path: "/",
  });

  return response;
}
