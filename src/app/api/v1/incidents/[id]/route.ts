import { NextRequest, NextResponse } from "next/server";
import { IncidentService } from "@/core/services/incident.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await RbacGuard.extractUser(request);
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
    const user = await RbacGuard.extractUser(request);
    const { id } = await context.params;

    // OBSERVADOR es solo lectura (Principio IV)
    if (user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error_code: "FORBIDDEN_ACTION", message: "Solo SUPERADMIN puede transitar el estado de incidentes." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { status, assignedTo, rootCause, correctiveActions } = body;

    const result = await IncidentService.transitionState(id, status, user.id, {
      assignedTo,
      rootCause,
      correctiveActions,
      ipAddress: user.ipAddress,
    });

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

/**
 * Acciones de ciclo de vida que no son transiciones simples:
 *  - close: cierra el incidente (resuelve + cierra si es necesario, exige rootCause)
 *  - escalate: escala con motivo
 *  - sla-scan: barrido de SLA vencidos
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await RbacGuard.extractUser(request);
    const { id } = await context.params;

    if (user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error_code: "FORBIDDEN_ACTION", message: "Solo SUPERADMIN puede ejecutar acciones sobre incidentes." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { action, rootCause, correctiveActions, assignedTo, reason } = body ?? {};

    if (action === "close") {
      if (!rootCause || typeof rootCause !== "string" || rootCause.trim().length < 5) {
        return NextResponse.json(
          { error_code: "VALIDATION_ERROR", message: "Para cerrar un incidente se requiere documentar la causa raíz (mínimo 5 caracteres)." },
          { status: 422 }
        );
      }
      const result = await IncidentService.closeIncident(id, user.id, {
        rootCause,
        correctiveActions: typeof correctiveActions === "string" ? correctiveActions : undefined,
        ipAddress: user.ipAddress,
      });
      return NextResponse.json(result);
    }

    if (action === "escalate") {
      if (!reason || typeof reason !== "string" || reason.trim().length < 5) {
        return NextResponse.json(
          { error_code: "VALIDATION_ERROR", message: "Se requiere un motivo de escalado (mínimo 5 caracteres)." },
          { status: 422 }
        );
      }
      const result = await IncidentService.escalate(id, user.id, reason, {
        assignedTo,
        ipAddress: user.ipAddress,
      });
      return NextResponse.json(result);
    }

    if (action === "sla-scan") {
      const result = await IncidentService.slaScan(user.id);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error_code: "VALIDATION_ERROR", message: "Acción no reconocida (close | escalate | sla-scan)." },
      { status: 422 }
    );
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Error en POST /api/v1/incidents/[id]:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error al ejecutar la acción del incidente." },
      { status: 500 }
    );
  }
}
