import { NextResponse } from "next/server";
import { readJsonBody } from "@/lib/request";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";

// 返回内容依赖当前登录用户，绝不能被构建期预渲染
export const dynamic = "force-dynamic";

const updateProfileSchema = z.object({
  nickname: z.string().min(1, "昵称不能为空").max(30, "昵称最多 30 个字").optional(),
  bio: z.string().max(200, "简介最多 200 个字").optional(),
  avatar: z.string().url("头像必须是合法链接").optional().or(z.literal("")),
  // Kindle 地址既可以是 xxx@kindle.com 也可以是 xxx@kindle.cn，
  // 这里只校验「是不是邮箱」——具体域名由 Amazon 决定，
  // 卡太死会挡住用户后来新增的域名。
  kindleEmail: z
    .string()
    .email("Kindle 邮箱格式不正确")
    .max(120)
    .optional()
    .or(z.literal("")),
  // 这两个是服务端偏好：生成通知的是同步任务、发摘要的是定时任务，
  // 它们都读不到浏览器的 localStorage，所以必须落在数据库里。
  notifyNewArticles: z.boolean().optional(),
  emailDigest: z.boolean().optional(),
});

/**
 * GET /api/profile
 *
 * 返回当前用户的可编辑资料。
 *
 * 存在的理由：个人资料页原本是把昵称/邮箱/手机写死在组件里的
 * 假数据（「用户名」「user@example.com」「138****8000」），
 * 点「保存修改」只是弹一句 toast。这一页需要真的读写自己。
 */
export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user, isGuest } = auth;

    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        nickname: true,
        avatar: true,
        bio: true,
        kindleEmail: true,
        notifyNewArticles: true,
        emailDigest: true,
        createdAt: true,
        _count: {
          select: {
            subscriptions: true,
            favorites: true,
            readHistories: true,
          },
        },
      },
    });

    if (!profile) {
      return NextResponse.json(
        { success: false, message: "用户不存在" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...profile,
        isGuest,
        // 前端要展示「注册于」
        createdAt: profile.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("Get profile error:", error);
    return NextResponse.json(
      { success: false, message: "获取个人资料失败" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/profile
 *
 * 只允许改这四项。邮箱、手机号、密码不在这里改 ——
 * 那些需要验证码/旧密码校验，混进来会让这个接口的权限边界变模糊。
 */
export async function PATCH(req: Request) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user, isGuest } = auth;

    if (isGuest) {
      return NextResponse.json(
        { success: false, message: "访客模式下无法修改资料" },
        { status: 403 }
      );
    }

    const parsedBody = await readJsonBody<Record<string, unknown>>(
      req,
      "请求内容无效"
    );
    if (!parsedBody.ok) return parsedBody.response;

    const parsed = updateProfileSchema.parse(parsedBody.data);

    // 空字符串表示「清空这个字段」，对应数据库里的 null。
    // 不做这个转换的话，avatar 会被存成空串，
    // 前端 <img src=""> 会触发一次对当前页面的请求。
    const data: {
      nickname?: string;
      bio?: string | null;
      avatar?: string | null;
      kindleEmail?: string | null;
      notifyNewArticles?: boolean;
      emailDigest?: boolean;
    } = {};

    if (parsed.nickname !== undefined) data.nickname = parsed.nickname;
    if (parsed.bio !== undefined) data.bio = parsed.bio || null;
    if (parsed.avatar !== undefined) data.avatar = parsed.avatar || null;
    if (parsed.kindleEmail !== undefined) {
      data.kindleEmail = parsed.kindleEmail || null;
    }
    if (parsed.notifyNewArticles !== undefined) {
      data.notifyNewArticles = parsed.notifyNewArticles;
    }
    if (parsed.emailDigest !== undefined) {
      data.emailDigest = parsed.emailDigest;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { success: false, message: "没有需要更新的内容" },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data,
      select: {
        id: true,
        nickname: true,
        avatar: true,
        bio: true,
        kindleEmail: true,
        notifyNewArticles: true,
        emailDigest: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: "个人资料已保存",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: error.issues[0]?.message || "资料格式不正确",
        },
        { status: 400 }
      );
    }
    console.error("Update profile error:", error);
    return NextResponse.json(
      { success: false, message: "保存失败，请稍后重试" },
      { status: 500 }
    );
  }
}
