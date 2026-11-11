import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 健康检查必须实时执行，不能被预渲染
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * 供容器编排（docker-compose healthcheck / k8s probe）和监控系统探活。
 *
 * 刻意分成两层：
 *   - 进程活着但数据库连不上，返回 503；这样编排器能发现「假活」，
 *     而不是把流量持续打到一个查不了库的实例上。
 *   - 数据库正常返回 200。
 *
 * 不返回任何用户数据、版本号以外的内部信息，避免信息泄露。
 */
export async function GET() {
  try {
    // 最轻量的探活查询：只数一行，不碰任何业务表
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      {
        status: "ok",
        database: "ok",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[health] 数据库探活失败:", error);

    return NextResponse.json(
      {
        status: "degraded",
        database: "unreachable",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
