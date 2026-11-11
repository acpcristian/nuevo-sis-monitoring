import { NextRequest, NextResponse } from "next/server";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { AuditService } from "@/core/services/audit.service";
import { AgentProviderService } from "@/core/services/agent-provider.service";
import { AgentProviderUpsertSchema } from "@/shared/validations/agent.schema";
import { DomainError } from "@/shared/errors/domain-errors";

export async function GET(request: NextRequest) {
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "VIEW_AGENT_PROVIDER");

    const result = await AgentProviderService.listProviders();
    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error en GET /api/v1/agent/provider:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al consultar el proveedor de IA." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "UPDATE_AGENT_PROVIDER");

    const body = await request.json();
    const input = AgentProviderUpsertSchema.parse(body);

    const provider = await AgentProviderService.upsertProvider(input, user.id, user.ipAddress);

    // Auditoría sin secretos: nunca se registra el token.
    await AuditService.recordEvent({
      userId: user.id,
      action: "AGENT_PROVIDER_UPDATED",
      detailsDiff: {
        providerType: provider.providerType,
        name: provider.name,
        baseUrl: provider.baseUrl,
        model: provider.model,
        hasApiKey: provider.hasApiKey,
        keyFingerprint: provider.keyFingerprint,
      },
      ipAddress: user.ipAddress,
    });

    return NextResponse.json(provider);
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
          message: "Datos de entrada inválidos para el proveedor de IA.",
          details: error,
        },
        { status: 400 }
      );
    }
    console.error("Error en PUT /api/v1/agent/provider:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al guardar el proveedor de IA." },
      { status: 500 }
    );
  }
}
