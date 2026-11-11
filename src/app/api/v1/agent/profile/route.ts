import { NextRequest, NextResponse } from "next/server";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { AuditService } from "@/core/services/audit.service";
import { AgentProfileService } from "@/core/services/agent-profile.service";
import { AgentProfileUpdateSchema } from "@/shared/validations/agent.schema";
import { DomainError } from "@/shared/errors/domain-errors";

export async function GET(request: NextRequest) {
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "VIEW_AGENT_PROFILE");
    const profile = await AgentProfileService.getProfile();
    return NextResponse.json(profile);
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error en GET /api/v1/agent/profile:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al consultar el perfil del agente." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "UPDATE_AGENT_PROFILE");

    const body = await request.json();
    const input = AgentProfileUpdateSchema.parse(body);

    const profile = await AgentProfileService.updateProfile(input);

    // Auditoría: qué secciones del perfil cambió y su tamaño, no su contenido completo.
    await AuditService.recordEvent({
      userId: user.id,
      action: "AGENT_PROFILE_UPDATED",
      detailsDiff: {
        enabled: profile.enabled,
        name: profile.name,
        sectionsUpdated: Object.keys(input),
        sizes: {
          tone: profile.tone?.length ?? 0,
          instructions: profile.instructions?.length ?? 0,
          escalationRules: profile.escalationRules?.length ?? 0,
          greeting: profile.greeting?.length ?? 0,
        },
      },
      ipAddress: user.ipAddress,
    });

    return NextResponse.json(profile);
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
          message: "Datos de entrada inválidos para el perfil del agente.",
          details: error,
        },
        { status: 400 }
      );
    }
    console.error("Error en PUT /api/v1/agent/profile:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al guardar el perfil del agente." },
      { status: 500 }
    );
  }
}
