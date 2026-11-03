import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UserService } from "@/core/services/user.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";
import { ResetPasswordSchema, UpdateUserSchema } from "@/shared/validations/user.schema";

function toErrorResponse(error: unknown, fallback: string) {
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
  console.error(fallback, error);
  return NextResponse.json({ error_code: "INTERNAL_ERROR", message: fallback }, { status: 500 });
}

/** GET /api/v1/users/[id] — detalle de usuario (solo SUPERADMIN). */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(actor, "GET_USER");

    const { id } = await context.params;
    const user = await UserService.get(id);
    return NextResponse.json(user);
  } catch (error: unknown) {
    return toErrorResponse(error, "Error al obtener el usuario.");
  }
}

/** PATCH /api/v1/users/[id] — actualiza nombre visible, rol o estado (solo SUPERADMIN). */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(actor, "UPDATE_USER");

    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const input = UpdateUserSchema.parse(body);

    const user = await UserService.update(id, input, actor);
    return NextResponse.json(user);
  } catch (error: unknown) {
    return toErrorResponse(error, "Error al actualizar el usuario.");
  }
}

/** POST /api/v1/users/[id] — { action: "reset-password", newPassword } (solo SUPERADMIN). */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(actor, "RESET_USER_PASSWORD");

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    if (body?.action !== "reset-password") {
      return NextResponse.json(
        { error_code: "VALIDATION_ERROR", message: "Acción no reconocida (reset-password)." },
        { status: 422 }
      );
    }

    const { newPassword } = ResetPasswordSchema.parse(body);
    await UserService.resetPassword(id, newPassword, actor);

    return NextResponse.json({ ok: true, message: "Contraseña restablecida." });
  } catch (error: unknown) {
    return toErrorResponse(error, "Error al restablecer la contraseña.");
  }
}
