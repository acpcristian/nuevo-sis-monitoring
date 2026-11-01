import { NextRequest, NextResponse } from "next/server";
import { ServerService } from "@/core/services/server.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = RbacGuard.extractUser(request);
    const { id } = await context.params;
    await RbacGuard.assertSuperAdmin(user, "TEST_CONNECTION", id);

    const result = await ServerService.testConnection(id);

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Error en prueba de conexión bajo demanda:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error al ejecutar prueba de conexión." },
      { status: 500 }
    );
  }
}

