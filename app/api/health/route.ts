import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// 健康检查必须实时执行，不能被预渲染
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * 供容器编排（docker-compose healthcheck / k8s probe）和监控系统探活。
 *
 * 探测分两步：先证明「能连」，再证明「能写」。
 *
 * 只做 SELECT 1 是不够的。实测：把 /data/werss.db 改成只读（chmod 444）后重启，
 * `SELECT 1` 照样通过、这个接口返回 200 `database: "ok"`，编排器判定容器 healthy，
 * 而所有写操作（注册、订阅、收藏、标记已读）全部 500。
 * 恢复备份时用 root `cp` 覆盖库文件就会踩到这条路径 —— 属主变成 root，
 * 容器内的 nextjs(1001) 再无写权限。
 * 于是「健康的容器」变成一个只能读、不能用的空壳，且没有任何信号提示。
 *
 * 因此这里额外做一次**零副作用**的写探测：deleteMany 一个不可能存在的 id。
 * 它不修改任何业务数据（count 恒为 0），但会真实开启写事务，
 * 数据库只读时立刻抛 SQLITE_READONLY。
 *
 * 不返回任何用户数据、版本号以外的内部信息，避免信息泄露。
 */
async function probeWritable(): Promise<void> {
  await prisma.user.deleteMany({ where: { id: "__health_probe__" } });
}

export async function GET() {
  try {
    // 1) 连通性：最轻量的读查询，不碰任何业务表
    await prisma.$queryRaw`SELECT 1`;

    // 2) 可写性：见上方注释，只读库必须在这里暴露出来
    await probeWritable();

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

    // 区分「连不上」和「连得上但写不了」——两者的处置方式不同：
    // 前者查网络/路径/迁移，后者几乎总是文件属主或只读挂载。
    const message = error instanceof Error ? error.message : String(error);
    const readOnly = /readonly|read-only|SQLITE_READONLY|extended_code: 8/i.test(message);

    return NextResponse.json(
      {
        status: "degraded",
        database: readOnly ? "readonly" : "unreachable",
        hint: readOnly
          ? "数据库只读：检查数据目录属主应为 1001:65533（chown -R 1001:65533 /data）"
          : undefined,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
