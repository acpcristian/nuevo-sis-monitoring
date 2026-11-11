import { NextRequest, NextResponse } from "next/server";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { AgentConversationsService } from "@/core/services/agent-conversations.service";
import { DomainError } from "@/shared/errors/domain-errors";

/** Métricas totales de uso del agente (tokens estimados). */
export async function GET(request: NextRequest) {
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "VIEW_AGENT_HISTORY");
    const data = await AgentConversationsService.getMetrics();
    return NextResponse.json(data);
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error en GET /api/v1/agent/metrics:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al calcular métricas del agente." },
      { status: 500 }
    );
  }
}
