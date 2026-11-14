import { NextRequest, NextResponse } from "next/server";
import { IntegrationKeyService } from "@/core/services/integration-key.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

/** DELETE /api/v1/integration-keys/[id] — revoca la clave (no borra el registro, trazabilidad). */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await RbacGuard.extractUser(request);
    const { id } = await context.params;

    if (user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error_code: "FORBIDDEN_ACTION", message: "Solo SUPERADMIN puede administrar claves de servicio." },
        { status: 403 }
      );
    }

    await IntegrationKeyService.revokeKey(id, user.id, user.ipAddress);
    return NextResponse.json({ ok: true, id, status: "REVOKED" });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    console.error("Error en DELETE /api/v1/integration-keys/[id]:", error);
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al revocar la clave." }, { status: 500 });
  }
}
