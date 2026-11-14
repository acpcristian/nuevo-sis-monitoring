import { NextRequest, NextResponse } from "next/server";
import { IntegrationKeyService } from "@/core/services/integration-key.service";
import { ServiceKeyCreateSchema } from "@/shared/validations/integration-key.schema";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

/** GET /api/v1/integration-keys — lista SIN secretos (solo huellas) (Principio III). */
export async function GET(request: NextRequest) {
  try {
    const user = await RbacGuard.extractUser(request);
    if (user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error_code: "FORBIDDEN_ACTION", message: "Solo SUPERADMIN puede administrar claves de servicio." },
        { status: 403 }
      );
    }
    const items = await IntegrationKeyService.listKeys();
    return NextResponse.json({ items, total: items.length });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    console.error("Error en GET /api/v1/integration-keys:", error);
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al listar claves de servicio." }, { status: 500 });
  }
}

/**
 * POST /api/v1/integration-keys — crea la clave. La clave en claro se devuelve
 * UNA ÚNICA VEZ en esta respuesta; luego solo existe su hash en BD.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await RbacGuard.extractUser(request);
    if (user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error_code: "FORBIDDEN_ACTION", message: "Solo SUPERADMIN puede administrar claves de servicio." },
        { status: 403 }
      );
    }

    const input = ServiceKeyCreateSchema.parse(await request.json());
    const created = await IntegrationKeyService.createKey(
      { name: input.name.trim(), scopes: input.scopes },
      user.id,
      user.ipAddress
    );

    return NextResponse.json(
      { ...created.record, key: created.key, aviso: "Copie la clave ahora: no se volverá a mostrar." },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    if (error && typeof error === "object" && "issues" in error) {
      return NextResponse.json(
        { error_code: "VALIDATION_FAILED", message: "Datos de entrada inválidos para la clave." },
        { status: 400 }
      );
    }
    console.error("Error en POST /api/v1/integration-keys:", error);
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al crear la clave de servicio." }, { status: 500 });
  }
}
