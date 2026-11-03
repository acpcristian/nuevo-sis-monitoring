import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UserService } from "@/core/services/user.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";
import { ChangeOwnPasswordSchema } from "@/shared/validations/user.schema";

/** POST /api/v1/auth/password — cambio de contraseña del usuario autenticado. */
export async function POST(request: NextRequest) {
  try {
    const actor = RbacGuard.extractUser(request);
    const body = await request.json().catch(() => null);
    const { currentPassword, newPassword } = ChangeOwnPasswordSchema.parse(body);

    await UserService.changeOwnPassword(actor.id, currentPassword, newPassword, actor);

    return NextResponse.json({ ok: true, message: "Contraseña actualizada." });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error_code: "VALIDATION_ERROR",
          message: error.issues[0]?.message ?? "Datos inválidos.",
          details: error.issues.map((i) => i.message),
        },
        { status: 422 }
      );
    }
    console.error("Error en POST /api/v1/auth/password:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error al cambiar la contraseña." },
      { status: 500 }
    );
  }
}
