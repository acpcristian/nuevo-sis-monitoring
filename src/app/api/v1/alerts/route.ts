import { NextRequest, NextResponse } from "next/server";
import { AlertService } from "@/core/services/alert-service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

export async function GET(request: NextRequest) {
  try {
    const user = RbacGuard.extractUser(request);
    const { searchParams } = new URL(request.url);

    const result = await AlertService.listAlerts({
      serverId: searchParams.get("server_id") || undefined,
      status: (searchParams.get("status") as "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED") || undefined,
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

    console.error("Error en GET /api/v1/alerts:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al consultar alertas." },
      { status: 500 }
    );
  }
}