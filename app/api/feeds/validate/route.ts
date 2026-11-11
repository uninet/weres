import { NextResponse } from "next/server";
import { validateRSSUrl, extractFavicon } from "@/lib/rss-parser";
import { z } from "zod";
import { getClientIdentifier, checkRateLimit, rateLimitConfigs } from "@/lib/rate-limit";

const validateSchema = z.object({
  url: z.string().url(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { url } = validateSchema.parse(body);

    // 速率限制 - 防止滥用
    const identifier = `validate:${getClientIdentifier(req)}`;
    const rateLimit = checkRateLimit(identifier, rateLimitConfigs.generous);

    if (!rateLimit.success) {
      return NextResponse.json(
        {
          success: false,
          message: "请求过于频繁，请稍后再试",
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": "5",
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

    console.error("Validate RSS error:", error);
    return NextResponse.json(
      { success: false, message: "验证失败" },
      { status: 500 }
    );
  }
}
