import { NextRequest, NextResponse } from "next/server";
import { NotificationCategoryCreateSchema } from "@/shared/validations/notification.schema";
import { NotificationCategoryService } from "@/core/services/notification-category.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

/**
 * CRUD del catálogo de categorías de notificación.
 * GET: lectura abierta a usuarios autenticados (alimenta las tarjetas por
 * sección del sistema). POST: SUPERADMIN agrega categorías personalizadas.
 */
export async function GET(request: NextRequest) {
  try {
    await RbacGuard.extractUser(request);
    let categories = await NotificationCategoryService.listCategories();
    // Autocura inicial: si el catálogo no fue poblado aún, sembrar el
    // contenido por defecto (idempotente; no sobrescribe ediciones).
    if (categories.length === 0) {
      await NotificationCategoryService.ensureDefaultSeed();
      categories = await NotificationCategoryService.listCategories();
    }
    return NextResponse.json({ items: categories });
  } catch (error: unknown) {
    return handleError(error, "GET /api/v1/notification-categories");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "CREATE_NOTIFICATION_CATEGORY");

    const body = await request.json();
    const input = NotificationCategoryCreateSchema.parse(body);

    const created = await NotificationCategoryService.createCategory(input);
    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    return handleError(error, "POST /api/v1/notification-categories");
  }
}

function handleError(error: unknown, context: string) {
  if (error instanceof DomainError) {
    return NextResponse.json(
      { error_code: error.code, message: error.message },
      { status: error.statusCode }
    );
  }

  if (error && typeof error === "object" && "issues" in error) {
    return NextResponse.json(
      {
        error_code: "VALIDATION_FAILED",
        message: "Datos de entrada inválidos para la categoría de notificación.",
        details: error,
      },
      { status: 400 }
    );
  }

  console.error(`Error inesperado en ${context}:`, error);
  return NextResponse.json(
    { error_code: "INTERNAL_ERROR", message: "Error interno al gestionar el catálogo de notificaciones." },
    { status: 500 }
  );
}
