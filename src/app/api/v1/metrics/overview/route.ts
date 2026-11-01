import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

/** GET /api/v1/metrics/overview — KPIs consolidados para el dashboard (US1/US2/US3). */
export async function GET(request: NextRequest) {
  try {
    RbacGuard.extractUser(request);

    const now = new Date();
    const h24 = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      healthByStatus,
      envByType,
      incidentsByStatus,
      incidentsByPriority,
      eventsBySeverity24h,
      eventsByHour,
      topAlertPatterns,
      openSlaBreached,
      slaMet7d,
      slaTotal7d,
      ingest24h,
      channelStatus,
    ] = await Promise.all([
      prisma.server.groupBy({ by: ["healthStatus"], _count: { _all: true } }),
      prisma.server.groupBy({ by: ["environment"], _count: { _all: true }, where: { lifecycleState: { not: "RETIRED" } } }),
      prisma.incident.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.incident.groupBy({ by: ["priority"], _count: { _all: true }, where: { status: { notIn: ["RESOLVED", "CLOSED"] } } }),
      prisma.logEvent.groupBy({ by: ["severity"], _count: { _all: true }, where: { eventTimestamp: { gte: h24 } } }),
      prisma.logEvent.findMany({
        where: { eventTimestamp: { gte: h24 } },
        select: { eventTimestamp: true },
        take: 5000,
      }),
      prisma.logAlert.groupBy({
        by: ["patternType"],
        _count: { _all: true },
        _sum: { eventCount: true },
        orderBy: { _sum: { eventCount: "desc" } },
        take: 8,
      }),
      prisma.incident.count({ where: { slaDueAt: { lt: now }, status: { notIn: ["RESOLVED", "CLOSED"] } } }),
      prisma.incident.count({ where: { slaMet: true, resolvedAt: { gte: d7 } } }),
      prisma.incident.count({ where: { slaTimeoutMin: { not: null }, resolvedAt: { gte: d7 } } }),
      prisma.logEvent.count({ where: { eventTimestamp: { gte: h24 } } }),
      prisma.notificationChannel.groupBy({ by: ["status"], _count: { _all: true } }),
    ]);

    // MTTR: promedio (resolvedAt - createdAt) de RESOLVED en 30 días (calc en memoria sobre 500 máx)
    const resolved = await prisma.incident.findMany({
      where: { status: "RESOLVED", resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
      orderBy: { resolvedAt: "desc" },
      take: 200,
    });
    const mttrs = resolved
      .filter((i) => i.resolvedAt)
      .map((i) => (i.resolvedAt!.getTime() - i.createdAt.getTime()) / 60000);
    const mttrMedian =
      mttrs.length > 0 ? mttrs.sort((a, b) => a - b)[Math.floor(mttrs.length / 2)] : null;

    // Serie por hora de las últimas 24 h
    const hourly = new Array<number>(24).fill(0);
    for (const ev of eventsByHour) {
      if (!ev.eventTimestamp) continue;
      const diffH = Math.floor((now.getTime() - ev.eventTimestamp.getTime()) / 3600000);
      const idx = 23 - diffH;
      if (idx >= 0 && idx < 24) {
        hourly[idx] = (hourly[idx] ?? 0) + 1;
      }
    }

    return NextResponse.json({
      generatedAt: now.toISOString(),
      servers: {
        byHealthStatus: healthByStatus.map((g) => ({ label: g.healthStatus, count: (g._count as { _all: number })._all })),
        byEnvironment: envByType.map((g) => ({ label: g.environment, count: (g._count as { _all: number })._all })),
      },
      incidents: {
        byStatus: incidentsByStatus.map((g) => ({ label: g.status, count: (g._count as { _all: number })._all })),
        openByPriority: incidentsByPriority.map((g) => ({ label: g.priority, count: (g._count as { _all: number })._all })),
        openSlaBreached,
        slaMetPct7d: slaTotal7d > 0 ? Math.round((slaMet7d / slaTotal7d) * 100) : null,
        mttrMedianMinutes: mttrMedian,
      },
      logs: {
        ingest24h,
        bySeverity24h: eventsBySeverity24h.map((g) => ({ label: g.severity, count: (g._count as { _all: number })._all })),
        hourly24h: hourly,
      },
      alerts: {
        topPatterns: topAlertPatterns.map((g) => ({
          pattern: g.patternType,
          alerts: (g._count as { _all: number })._all,
          events: (g._sum as { eventCount: number | null }).eventCount ?? 0,
        })),
      },
      channels: channelStatus.map((g) => ({ label: g.status, count: (g._count as { _all: number })._all })),
    });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    console.error("Error en GET /api/v1/metrics/overview:", error);
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al calcular métricas." }, { status: 500 });
  }
}
