import { NextRequest, NextResponse } from "next/server";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { prisma } from "@/infrastructure/db/prisma";
import { DomainError } from "@/shared/errors/domain-errors";

/** Devuelve el usuario de la sesión actual, revalidado contra la base de datos. */
export async function GET(request: NextRequest) {
  try {
    const actor = await RbacGuard.extractUser(request);
    const user = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { id: true, username: true, displayName: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { error_code: "UNAUTHORIZED", message: "Sesión no válida o cuenta desactivada." },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error en GET /api/v1/auth/me:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error al obtener la sesión." },
      { status: 500 }
    );
  }
}
