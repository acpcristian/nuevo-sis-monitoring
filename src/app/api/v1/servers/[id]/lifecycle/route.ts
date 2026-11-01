import { NextRequest, NextResponse } from "next/server";
import { ServerLifecycleService } from "@/core/services/server-lifecycle.service";
import { ChangeLifecycleSchema } from "@/shared/validations/server.schema";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = RbacGuard.extractUser(request);
    const { id } = await context.params;
    await RbacGuard.assertSuperAdmin(user, "CHANGE_LIFECYCLE", id);

    const body = await request.json();
    const { newState, reason } = ChangeLifecycleSchema.parse(body);

    const updated = await ServerLifecycleService.changeLifecycleState(
      id,
      newState,
      reason,
      user.id,
      user.ipAddress
    );

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      lifecycleState: updated.lifecycleState,
      healthStatus: updated.healthStatus,
      message: `Estado del ciclo de vida actualizado a '${newState}'.`,
    });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Error en PATCH lifecycle:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error al actualizar estado de ciclo de vida." },
      { status: 500 }
    );
  }
}

