import { NextRequest, NextResponse } from "next/server";
import { AuditService } from "@/core/services/audit.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";
import { AUDIT_ACTIONS, type AuditAction } from "@/core/domain/audit-actions";

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** GET /api/v1/audit — consulta paginada del registro de auditoría (solo SUPERADMIN). */
export async function GET(request: NextRequest) {
  try {
    const actor = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(actor, "LIST_AUDIT");

    const params = request.nextUrl.searchParams;
    const actionParam = params.get("action");
    const userId = params.get("userId") ?? undefined;
    const limitParam = Number(params.get("limit"));
    const offsetParam = Number(params.get("offset"));

    let action: AuditAction | undefined;
    if (actionParam) {
      if (!(AUDIT_ACTIONS as readonly string[]).includes(actionParam)) {
        return NextResponse.json(
          { error_code: "VALIDATION_ERROR", message: `Acción de auditoría desconocida: ${actionParam}.` },
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
        { error_code: "VALIDATION_ERROR", message: "Las fechas from/to deben estar en formato ISO 8601." },
        { status: 422 }
      );
    }

    const result = await AuditService.list({
      action,
      userId: userId || undefined,
      from: from ?? undefined,
      to: to ?? undefined,
      limit: Number.isFinite(limitParam) && limitParam > 0 ? limitParam : undefined,
      offset: Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : undefined,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error en GET /api/v1/audit:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error al consultar la auditoría." },
      { status: 500 }
    );
  }
}
