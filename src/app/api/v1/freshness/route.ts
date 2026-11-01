import { NextRequest, NextResponse } from "next/server";
import { FreshnessService } from "@/core/services/freshness.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

export async function GET(request: NextRequest) {
  try {
    const user = RbacGuard.extractUser(request);
    const { searchParams } = new URL(request.url);

    const result = await FreshnessService.listFreshnessStates({
      serverId: searchParams.get("server_id") || undefined,
      state: (searchParams.get("state") as
        | "FRESH"
        | "STALE"
        | "AGENT_DISCONNECTED"
        | "UNREACHABLE") || undefined,
    });

    return NextResponse.json({ items: result });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Error en GET /api/v1/freshness:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al consultar estados de frescura." },
      { status: 500 }
    );
  }
}