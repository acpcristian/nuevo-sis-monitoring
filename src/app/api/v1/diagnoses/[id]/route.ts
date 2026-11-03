import { NextRequest, NextResponse } from "next/server";
import { DiagnosisService } from "@/core/services/diagnosis.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await RbacGuard.extractUser(request);
    const { id } = await context.params;

    const diagnosis = await DiagnosisService.getDiagnosisById(id);

    return NextResponse.json(diagnosis);
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Error en GET /api/v1/diagnoses/[id]:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error al consultar diagnóstico." },
      { status: 500 }
    );
  }
}
