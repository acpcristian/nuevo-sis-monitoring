import { NextRequest, NextResponse } from "next/server";
import { AuditService } from "@/core/services/audit.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";
import { AUDIT_ACTIONS, type AuditAction } from "@/core/domain/audit-actions";
import { toCsv, type CsvColumn } from "@/shared/utils/csv";

const EXPORT_LIMIT = 5000;

const COLUMNS: CsvColumn[] = [
  { key: "fecha", header: "fecha" },
  { key: "actor", header: "actor" },
  { key: "accion", header: "accion" },
  { key: "objetivo", header: "objetivo" },
  { key: "ip", header: "ip" },
  { key: "detalle", header: "detalle" },
];

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function fileStamp(): string {
  return new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
}

/**
 * GET /api/v1/audit/export?action=&userId=&from=&to=&format=csv|json
 * Exporta el registro de auditoría con los mismos filtros de la pantalla /audit.
 * Solo SUPERADMIN; la propia exportación queda auditada como REPORT_EXPORTED.
 */
export async function GET(request: NextRequest) {
  try {
    const actor = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(actor, "EXPORT_AUDIT");

    const params = request.nextUrl.searchParams;
    const actionParam = params.get("action");
    const userId = params.get("userId") ?? undefined;
    const format = params.get("format") ?? "csv";

    if (format !== "csv" && format !== "json") {
      return NextResponse.json(
        { error_code: "VALIDATION_ERROR", message: "format debe ser csv | json." },
        { status: 422 }
      );
    }

    let action: AuditAction | undefined;
    if (actionParam) {
      if (!(AUDIT_ACTIONS as readonly string[]).includes(actionParam)) {
        return NextResponse.json(
          {
            error_code: "VALIDATION_ERROR",
            message: `Acción de auditoría desconocida: ${actionParam}.`,
          },
          { status: 422 }
        );
      }
      action = actionParam as AuditAction;
    }

    const fromParam = params.get("from");
    const toParam = params.get("to");
    const from = parseDate(fromParam);
    const to = parseDate(toParam);
    if ((fromParam && !from) || (toParam && !to)) {
      return NextResponse.json(
        {
          error_code: "VALIDATION_ERROR",
          message: "Las fechas from/to deben estar en formato ISO 8601.",
        },
        { status: 422 }
      );
    }

    const items = await AuditService.exportRows(
      {
        action,
        userId: userId || undefined,
        from: from ?? undefined,
        to: to ?? undefined,
      },
      EXPORT_LIMIT
    );

    await AuditService.recordEvent({
      userId: actor.id,
      action: "REPORT_EXPORTED",
      detailsDiff: {
        dataset: "audit",
        format,
        rows: items.length,
        filters: {
          action: action ?? null,
          userId: userId ?? null,
          from: from?.toISOString() ?? null,
          to: to?.toISOString() ?? null,
        },
        truncated: items.length === EXPORT_LIMIT,
      },
      ipAddress: actor.ipAddress ?? null,
    });

    if (format === "json") {
      return NextResponse.json({
        dataset: "audit",
        exportedAt: new Date().toISOString(),
        total: items.length,
        rows: items,
      });
    }

    const rows = items.map((item) => ({
      fecha: item.timestamp,
      actor: item.actorUsername ?? item.userId,
      accion: item.action,
      objetivo: item.targetServerId ?? "",
      ip: item.ipAddress ?? "",
      detalle: JSON.stringify(item.detailsDiff ?? {}),
    }));

    // BOM UTF-8 para que Excel respete los acentos.
    const csv = `\uFEFF${toCsv(rows, COLUMNS)}`;

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="auditoria_${fileStamp()}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error en GET /api/v1/audit/export:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error al exportar la auditoría." },
      { status: 500 }
    );
  }
}
