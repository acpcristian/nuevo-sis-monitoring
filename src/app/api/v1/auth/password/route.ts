import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UserService } from "@/core/services/user.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";
import { ChangeOwnPasswordSchema } from "@/shared/validations/user.schema";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/infrastructure/security/session";

/** POST /api/v1/auth/password — cambio de contraseña del usuario autenticado. */
export async function POST(request: NextRequest) {
  try {
    const actor = await RbacGuard.extractUser(request);
    const body = await request.json().catch(() => null);
    const { currentPassword, newPassword } = ChangeOwnPasswordSchema.parse(body);

    const updated = await UserService.changeOwnPassword(
      actor.id,
      currentPassword,
      newPassword,
      actor
    );

    // La rotación incrementa la versión de sesión: emitimos un token nuevo para no
    // expulsar al usuario que acaba de cambiar su propia contraseña.
    const response = NextResponse.json({ ok: true, message: "Contraseña actualizada." });
    response.cookies.set({
      name: SESSION_COOKIE,
      value: createSessionToken(
        actor.id,
        updated.username,
        updated.role,
        updated.sessionVersion
      ),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });

    return response;
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
