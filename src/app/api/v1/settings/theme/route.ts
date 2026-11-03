import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { ThemeService } from "@/core/services/theme.service";
import { DomainError } from "@/shared/errors/domain-errors";
import { ThemeSchema } from "@/shared/validations/theme.schema";

/**
 * GET /api/v1/settings/theme — apariencia vigente (cualquier usuario autenticado).
 * PUT /api/v1/settings/theme — cambia la apariencia global (solo SUPERADMIN, auditado).
 */
export async function GET(request: NextRequest) {
  try {
    await RbacGuard.extractUser(request);
    const record = await ThemeService.getThemeRecord();

    return NextResponse.json({
      theme: record.theme,
      meta: { updatedAt: record.updatedAt, updatedBy: record.updatedBy },
    });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error en GET /api/v1/settings/theme:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error al obtener la apariencia." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const actor = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(actor, "UPDATE_THEME");

    const body = await request.json().catch(() => null);
    const theme = ThemeSchema.parse(body);

    const record = await ThemeService.updateTheme(theme, actor);

    return NextResponse.json({
      ok: true,
      theme: record.theme,
      meta: { updatedAt: record.updatedAt, updatedBy: record.updatedBy },
    });
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
          message: error.issues[0]?.message ?? "Datos de apariencia inválidos.",
          details: error.issues.map((issue) => issue.message),
        },
        { status: 422 }
      );
    }
    console.error("Error en PUT /api/v1/settings/theme:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error al guardar la apariencia." },
      { status: 500 }
    );
  }
}
