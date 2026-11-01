import { NextRequest, NextResponse } from "next/server";
import { IncidentService } from "@/core/services/incident.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = RbacGuard.extractUser(request);
    const { id } = await context.params;

    const incident = await IncidentService.getIncidentById(id);

    return NextResponse.json(incident);
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Error en GET /api/v1/incidents/[id]:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error al consultar incidente." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = RbacGuard.extractUser(request);
    const { id } = await context.params;

    const body = await request.json();
    const { status, notes } = body;

    // Validar que el usuario tenga permisos
    // SUPERADMIN puede todas las transiciones
    // OBSERVADOR solo puede consultar (no transitar)
    if (user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error_code: "FORBIDDEN_ACTION", message: "Solo SUPERADMIN puede transitar el estado de incidentes." },
        { status: 403 }
      );
    }

    const result = await IncidentService.transitionState(
      id,
      status as any,
      user.id
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Error en PATCH /api/v1/incidents/[id]:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error al transitar estado de incidente." },
      { status: 500 }
    );
  }
}