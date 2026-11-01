import { NextRequest, NextResponse } from "next/server";
import { LogQueryService } from "@/core/services/log-query.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = RbacGuard.extractUser(request);
    const { id } = await context.params;

    const event = await LogQueryService.getLogEventById(id);

    return NextResponse.json(event);
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Error en GET /api/v1/logs/[id]:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error al consultar evento de log." },
      { status: 500 }
    );
  }
}
