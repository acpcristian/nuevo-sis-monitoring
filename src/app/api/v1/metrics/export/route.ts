import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
import { RbacGuard, type AuthenticatedUser } from "@/infrastructure/security/rbac-guard";
import { AuditService } from "@/core/services/audit.service";
import { DomainError } from "@/shared/errors/domain-errors";

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

/**
 * GET /api/v1/metrics/export?dataset=incidents|servers|events&format=csv|json
 * Reportes exportables con integridad de datos (Principio II).
 */
export async function GET(request: NextRequest) {
  try {
    const user: AuthenticatedUser = RbacGuard.extractUser(request);
    const { searchParams } = new URL(request.url);
    const dataset = searchParams.get("dataset") ?? "incidents";
    const format = searchParams.get("format") ?? "json";
    if (!["incidents", "servers", "events"].includes(dataset)) {
      return NextResponse.json(
        { error_code: "VALIDATION_ERROR", message: "dataset debe ser incidents | servers | events." },
        { status: 422 }
      );
    }
    if (!["csv", "json"].includes(format)) {
      return NextResponse.json(
        { error_code: "VALIDATION_ERROR", message: "format debe ser csv | json." },
        { status: 422 }
      );
    }

    let rows: Record<string, unknown>[];
    if (dataset === "incidents") {
      const items = await prisma.incident.findMany({
        select: {
          id: true, title: true, category: true, priority: true, status: true,
          assignedTo: true, slaTimeoutMin: true, slaDueAt: true, slaMet: true,
          escalationLevel: true, rootCause: true, createdAt: true, resolvedAt: true, closedAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 1000,
      });
      rows = items.map((i) => ({ ...i, slaDueAt: i.slaDueAt?.toISOString() ?? "", createdAt: i.createdAt.toISOString(), resolvedAt: i.resolvedAt?.toISOString() ?? "", closedAt: i.closedAt?.toISOString() ?? "" }));
    } else if (dataset === "servers") {
      const items = await prisma.server.findMany({
        select: {
          id: true, name: true, ipAddress: true, hostname: true, osType: true, osVersion: true,
          environment: true, status: true, healthStatus: true, lastCheckedAt: true, createdAt: true,
        },
        orderBy: { name: "asc" },
        take: 1000,
      });
      rows = items.map((s) => ({ ...s, lastCheckedAt: s.lastCheckedAt?.toISOString() ?? "", createdAt: s.createdAt.toISOString() }));
    } else {
      const items = await prisma.logEvent.findMany({
        select: {
          id: true, serverId: true, categoryId: true, eventType: true, severity: true,
          sanitizedMessage: true, eventTimestamp: true, isUntrusted: true,
        },
        orderBy: { eventTimestamp: "desc" },
        take: 2000,
      });
      rows = items.map((e) => ({ ...e, eventTimestamp: e.eventTimestamp.toISOString() }));
    }

    await AuditService.recordEvent({
      userId: user.id,
      action: "REPORT_EXPORTED",
      detailsDiff: { dataset, format, rows: rows.length },
      ipAddress: user.ipAddress ?? null,
    });

    if (format === "csv") {
      return new Response(toCsv(rows), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="monitoreo_${dataset}.csv"`,
        },
      });
    }

    return NextResponse.json({
      dataset,
      exportedAt: new Date().toISOString(),
      total: rows.length,
      rows,
    });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    console.error("Error en GET /api/v1/metrics/export:", error);
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al exportar el reporte." }, { status: 500 });
  }
}
