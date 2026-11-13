import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { denyUnlessGroupOwned } from "@/lib/ownership";
import { readJsonBody } from "@/lib/request";

// DELETE /api/feeds/subscriptions/[id] - 取消订阅
// [id] 可以是 subscription.id 或 feedId
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user } = auth;
    const { id } = params;

    // 先尝试通过 subscription id 查找
    let subscription = await prisma.subscription.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    // 如果找不到，尝试通过 feedId 查找
    if (!subscription) {
      subscription = await prisma.subscription.findFirst({
        where: {
          feedId: id,
          userId: user.id,
        },
      });
    }

    if (!subscription) {
      return NextResponse.json(
        { success: false, message: "订阅不存在" },
        { status: 404 }
      );
    }

    // 删除订阅
    await prisma.subscription.delete({
      where: { id: subscription.id },
    });

    return NextResponse.json({
      success: true,
      message: "取消订阅成功",
    });
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return NextResponse.json(
      { success: false, message: "取消订阅失败" },
      { status: 500 }
    );
  }
}

// PATCH /api/feeds/subscriptions/[id] - 更新订阅设置
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(req);
    if (auth.error) {
      return NextResponse.json(auth.error, { status: auth.status });
    }
    const { user } = auth;
    const { id } = params;

    const parsed = await readJsonBody<{ isNotify?: boolean; groupId?: string }>(
      req,
      "请提供要修改的字段"
    );
    if (!parsed.ok) return parsed.response;
    const { isNotify, groupId } = parsed.data;

    // 检查订阅是否存在且属于当前用户
    const subscription = await prisma.subscription.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, message: "订阅不存在" },
        { status: 404 }
      );
    }

    // 改挂分组时同样要校验目标分组是本人的 ——
    // 这条路径和被修过的 POST 是同一个漏洞的另一半，
    // 只修 POST 等于留了一扇同款的门。
    const denied = await denyUnlessGroupOwned(user.id, groupId);
    if (denied) return denied;

    // 更新订阅
    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        ...(isNotify !== undefined && { isNotify }),
        ...(groupId !== undefined && { groupId }),
      },
      include: {
        feed: true,
        group: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: { subscription: updated },
      message: "更新成功",
    });
  } catch (error) {
    console.error("Update subscription error:", error);
    return NextResponse.json(
      { success: false, message: "更新订阅失败" },
      { status: 500 }
    );
  }
}
