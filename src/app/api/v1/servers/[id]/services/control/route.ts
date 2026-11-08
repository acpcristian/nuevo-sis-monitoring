import { NextRequest, NextResponse } from "next/server";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";
import { ServiceControlService, type ServiceControlAction } from "@/core/services/service-control.service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await RbacGuard.extractUser(request);
    const { id } = await context.params;
    await RbacGuard.assertSuperAdmin(user, "CONTROL_SERVICE", id);

    const body = await request.json();
    const { serviceId, action } = body as { serviceId?: string; action?: ServiceControlAction };

    if (!serviceId || !action) {
      return NextResponse.json(
        { error_code: "BAD_REQUEST", message: "serviceId y action son requeridos." },
        { status: 400 }
      );
    }

    const validActions: ServiceControlAction[] = ["start", "stop", "restart", "enable", "disable"];
    if (!validActions.includes(action)) {
      return NextResponse.json(
        { error_code: "BAD_REQUEST", message: `Acción inválida: ${action}` },
        { status: 400 }
      );
    }

    const result = await ServiceControlService.executeAction(id, serviceId, action);

    if (!result.ok) {
      return NextResponse.json(
        {
          error_code: "EXECUTION_FAILED",
          message: result.error || "La acción no pudo completarse en el servidor remoto.",
          result,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    console.error("Error en POST /api/v1/servers/[id]/services/control:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: error instanceof Error ? error.message : "Error interno." },
      { status: 500 }
    );
  }
}

