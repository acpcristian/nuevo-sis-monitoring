import { NextRequest, NextResponse } from "next/server";
import { ServerQueryService } from "@/core/services/server-query.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

/**
 * Contenedores de Secretarías municipales: agregado de solo lectura que
 * agrupa el catálogo de servidores por la etiqueta `secretaria` y entrega
 * sus conteos de estado. La relación servidor↔secretaría vive en el tag,
 * sin esquemas adicionales.
 */
export async function GET(request: NextRequest) {
  try {
    await RbacGuard.extractUser(request);

    const items = await ServerQueryService.listSecretariaGroups();

    return NextResponse.json({
      items,
      total: items.length,
    });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Error en GET /api/v1/secretarias:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al consultar secretarías." },
      { status: 500 }
    );
  }
}
