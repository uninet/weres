import { NextResponse } from "next/server";

/**
 * 安全地读取 JSON 请求体。
 *
 * `await req.json()` 在 body 为空、body 是空字符串、以及 body 不是合法
 * JSON 这三种情况下都会抛 SyntaxError。如果直接放在路由的 try 里，
 * 会落到最后的 catch 变成 500「操作失败」——但这明明是调用方少传了
 * 参数或传坏了，属于 400。
 *
 * 实测：`POST /api/groups` 不带 body 一直返回 500，前端只能显示
 * 「创建失败」，用户完全不知道自己少了什么。
 *
 * 返回值用判别式联合而非抛异常，强迫调用方处理失败分支。
 */
export type JsonBodyResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/**
 * @param req 请求对象
 * @param message 解析失败时给调用方看的话。默认提示要带请求体。
 */
export async function readJsonBody<T = unknown>(
  req: Request,
  message = "请求体格式不正确，需要合法的 JSON"
): Promise<JsonBodyResult<T>> {
  let text: string;
  try {
    text = await req.text();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: "请求体读取失败" },
        { status: 400 }
      ),
    };
  }

  if (!text.trim()) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message },
        { status: 400 }
      ),
    };
  }

  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message },
        { status: 400 }
      ),
    };
  }
}
