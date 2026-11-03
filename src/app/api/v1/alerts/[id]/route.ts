import { NextRequest, NextResponse } from "next/server";
import { AlertService } from "@/core/services/alert-service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await RbacGuard.extractUser(request);
    const { id } = await context.params;

    // Solo SUPERADMIN puede reconocer o resolver alertas (Principio IV)
    if (user.role !== "SUPERADMIN") {
      return NextResponse.json(
        {
          error_code: "FORBIDDEN_ACTION",
          message: "Solo SUPERADMIN puede reconocer o resolver alertas.",
        },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = (body as { action?: string }).action;

    let result;
    if (action === "acknowledge") {
      result = await AlertService.acknowledgeAlert(id, user.id, user.ipAddress);
    } else if (action === "resolve") {
      result = await AlertService.resolveAlert(id, user.id, user.ipAddress);
    } else {
      return NextResponse.json(
        {
          error_code: "VALIDATION_FAILED",
          message: "Acción inválida. Use 'acknowledge' o 'resolve'.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Error en PATCH /api/v1/alerts/[id]:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al actualizar alerta." },
      { status: 500 }
    );
  }
}