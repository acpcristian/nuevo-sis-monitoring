import { NextRequest, NextResponse } from "next/server";
import { IncidentService } from "@/core/services/incident.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

export async function GET(request: NextRequest) {
  try {
    const user = await RbacGuard.extractUser(request);
    const { searchParams } = new URL(request.url);

    const result = await IncidentService.listIncidents({
      status: (searchParams.get("status") as any) || undefined,
      priority: (searchParams.get("priority") as any) || undefined,
      category: (searchParams.get("category") as any) || undefined,
      serverId: searchParams.get("server_id") || undefined,
      assignedTo: searchParams.get("assigned_to") || undefined,
      search: searchParams.get("search") || undefined,
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Error en GET /api/v1/incidents:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al consultar incidentes." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await RbacGuard.extractUser(request);

    // Solo SUPERADMIN puede crear incidentes (Principio IV)
    if (user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error_code: "FORBIDDEN_ACTION", message: "Solo SUPERADMIN puede crear incidentes." },
        { status: 403 }
      );
    }

    const body = await request.json();

    const incident = await IncidentService.createIncident(
      body,
      user.id,
      user.ipAddress
    );

    return NextResponse.json(incident, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Error inesperado en POST /api/v1/incidents:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al crear incidente." },
      { status: 500 }
    );
  }
}