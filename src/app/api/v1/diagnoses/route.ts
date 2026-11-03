import { NextRequest, NextResponse } from "next/server";
import { CreateDiagnosisSchema } from "@/shared/validations/log.schema";
import { DiagnosisService } from "@/core/services/diagnosis.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";
import { AuditService } from "@/core/services/audit.service";

export async function GET(request: NextRequest) {
  try {
    const user = await RbacGuard.extractUser(request);
    const { searchParams } = new URL(request.url);

    const result = await DiagnosisService.listDiagnoses({
      serverId: searchParams.get("server_id") || undefined,
      status: (searchParams.get("status") as any) || undefined,
      page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1,
      limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50,
    });

    return NextResponse.json({
      items: result.items,
      total: result.total,
      page: result.page,
      limit: result.limit,
      pages: result.pages,
    });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Error en GET /api/v1/diagnoses:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al consultar diagnósticos." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await RbacGuard.extractUser(request);

    // Solo SUPERADMIN puede generar diagnósticos (Principio IV)
    if (user.role !== "SUPERADMIN") {
      await recordUnauthorizedAttempt("CREATE_DIAGNOSIS", user.id, user.ipAddress);
      return NextResponse.json(
        { error_code: "FORBIDDEN_ACTION", message: "Solo SUPERADMIN puede generar diagnósticos de incidentes." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedInput = CreateDiagnosisSchema.parse(body);

    const diagnosis = await DiagnosisService.createDiagnosis(
      validatedInput,
      user.id,
      user.ipAddress
    );

    return NextResponse.json(diagnosis, { status: 201 });
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
          message: "Datos de entrada inválidos para el diagnóstico.",
          details: error,
        },
        { status: 400 }
      );
    }

    console.error("Error inesperado en POST /api/v1/diagnoses:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al crear diagnóstico." },
      { status: 500 }
    );
  }
}

async function recordUnauthorizedAttempt(actionAttempted: string, userId: string, userIp?: string): Promise<void> {
  try {
    await AuditService.recordEvent({
      userId,
      action: "UNAUTHORIZED_ATTEMPT",
      targetServerId: null,
      detailsDiff: {
        role: "OBSERVADOR",
        actionAttempted,
        reason: "Intento de mutación no autorizado por rol OBSERVADOR",
      },
      ipAddress: userIp ?? null,
    });
  } catch {
    // Ignorar errores de auditoría en fallos de autorización
  }
}
