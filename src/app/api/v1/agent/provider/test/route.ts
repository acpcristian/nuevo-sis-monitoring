import { NextRequest, NextResponse } from "next/server";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { AuditService } from "@/core/services/audit.service";
import { AgentProviderService } from "@/core/services/agent-provider.service";
import { AgentProviderTestSchema } from "@/shared/validations/agent.schema";
import { DomainError } from "@/shared/errors/domain-errors";

export async function POST(request: NextRequest) {
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "TEST_AGENT_PROVIDER");

    const body = await request.json();
    const input = AgentProviderTestSchema.parse(body);

    const result = await AgentProviderService.testConnection(input);
    await AgentProviderService.recordTestResult(result);

    // Auditoría sin secretos: solo modelo, URL base y desenlace.
    await AuditService.recordEvent({
      userId: user.id,
      action: "AGENT_PROVIDER_TESTED",
      detailsDiff: {
        baseUrl: input.baseUrl,
        model: input.model,
        ok: result.ok,
        latencyMs: result.latencyMs,
      },
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
    if (error && typeof error === "object" && "issues" in error) {
      return NextResponse.json(
        {
          error_code: "VALIDATION_FAILED",
          message: "Datos de entrada inválidos para la prueba del proveedor.",
          details: error,
        },
        { status: 400 }
      );
    }
    console.error("Error en POST /api/v1/agent/provider/test:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al probar la conexión." },
      { status: 500 }
    );
  }
}
