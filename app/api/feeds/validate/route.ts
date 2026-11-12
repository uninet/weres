import { NextResponse } from "next/server";
import { validateRSSUrl, extractFavicon } from "@/lib/rss-parser";
import { UnsafeUrlError } from "@/lib/url-safety";
import { z } from "zod";
import { getClientIdentifier, checkRateLimit, checkGlobalRateLimit, rateLimitConfigs } from "@/lib/rate-limit";

// 这个接口要读请求头做限流标识，不能被预渲染
export const dynamic = "force-dynamic";

const validateSchema = z.object({
  url: z.string().url(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url } = validateSchema.parse(body);

    // 速率限制 - 防止滥用
    //
    // 两层：单 IP 一层负责公平（防一个访客把额度占满），
    // 全局一层负责安全 —— X-Forwarded-For 是客户端可控的，
    // 只按 IP 限流的话，每次换一个伪造 IP 就绕过了，而这个接口
    // 每次都会真的去 fetch 一个外网地址。
    const globalLimit = checkGlobalRateLimit(
      "validate",
      rateLimitConfigs.globalValidate
    );
    const identifier = `validate:${getClientIdentifier(req)}`;
    const rateLimit = checkRateLimit(identifier, rateLimitConfigs.generous);

    if (!rateLimit.success || !globalLimit.success) {
      return NextResponse.json(
        {
          success: false,
          message: "请求过于频繁，请稍后再试",
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "20",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": rateLimit.resetTime.toString(),
          },
        }
      );
    }

    const result = await validateRSSUrl(url);

    if (!result.valid) {
      return NextResponse.json(
        {
          success: false,
          data: { valid: false },
          message: result.error || "无效的 RSS 源",
        },
        { status: 400 }
      );
    }

    const feed = result.feed!;

    return NextResponse.json({
      success: true,
      data: {
        valid: true,
        feed: {
          title: feed.title,
          description: feed.description,
          icon: feed.icon || extractFavicon(url),
          url,
          itemCount: feed.items.length,
        },
      },
      message: "RSS 源验证成功",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: "URL 格式无效" },
        { status: 400 }
      );
    }

    // 内网地址不是「服务器故障」，是用户输入不合法，必须是 400。
    // 混进 500 会让调用方以为服务挂了、重试同一地址，也容易在监控里
    // 被当成异常噪音掩盖真实故障。
    if (error instanceof UnsafeUrlError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    console.error("Validate RSS error:", error);
    return NextResponse.json(
      { success: false, message: "验证失败" },
      { status: 500 }
    );
  }
}
