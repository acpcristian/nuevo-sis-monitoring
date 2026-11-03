import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UserService } from "@/core/services/user.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";
import { CreateUserSchema } from "@/shared/validations/user.schema";

function zodMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos.";
}

function toErrorResponse(error: unknown, fallback: string) {
  if (error instanceof DomainError) {
    return NextResponse.json(
      { error_code: error.code, message: error.message },
      { status: error.statusCode }
    );
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error_code: "VALIDATION_ERROR", message: zodMessage(error), details: error.issues.map((i) => i.message) },
      { status: 422 }
    );
  }
  console.error(fallback, error);
  return NextResponse.json({ error_code: "INTERNAL_ERROR", message: fallback }, { status: 500 });
}

/** GET /api/v1/users — lista de usuarios (solo SUPERADMIN). */
export async function GET(request: NextRequest) {
  try {
    const actor = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(actor, "LIST_USERS");

    const users = await UserService.list();
    return NextResponse.json({ items: users, total: users.length });
  } catch (error: unknown) {
    return toErrorResponse(error, "Error al listar usuarios.");
  }
}

/** POST /api/v1/users — alta de usuario (solo SUPERADMIN). */
export async function POST(request: NextRequest) {
  try {
    const actor = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(actor, "CREATE_USER");

    const body = await request.json().catch(() => null);
    const input = CreateUserSchema.parse(body);

    const user = await UserService.create(input, actor);
    return NextResponse.json(user, { status: 201 });
  } catch (error: unknown) {
    return toErrorResponse(error, "Error al crear el usuario.");
  }
}
