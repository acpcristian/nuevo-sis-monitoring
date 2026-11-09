import { NextRequest, NextResponse } from "next/server";
import { LogCategoryCreateSchema } from "@/shared/validations/log.schema";
import { LogCategoryService } from "@/core/services/log-category.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

/**
 * CRUD del catálogo de categorías de log.
 * GET: lectura abierta para usuarios autenticados (alimenta el detalle de logs).
 * POST: SUPERADMIN crea entradas del catálogo.
 */
export async function GET(request: NextRequest) {
  try {
    await RbacGuard.extractUser(request);
    const categories = await LogCategoryService.listCategories();
    return NextResponse.json({ items: categories });
  } catch (error: unknown) {
    return handleError(error, "GET /api/v1/log-categories");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "CREATE_LOG_CATEGORY");

    const body = await request.json();
    const validatedInput = LogCategoryCreateSchema.parse(body);

    const created = await LogCategoryService.createCategory(validatedInput);
    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    return handleError(error, "POST /api/v1/log-categories");
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
        message: "Datos de entrada inválidos para la categoría de log.",
        details: error,
      },
      { status: 400 }
    );
  }

  console.error(`Error inesperado en ${context}:`, error);
  return NextResponse.json(
    { error_code: "INTERNAL_ERROR", message: "Error interno al gestionar el catálogo de categorías." },
    { status: 500 }
  );
}
