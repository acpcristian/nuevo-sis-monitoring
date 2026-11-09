import { NextRequest, NextResponse } from "next/server";
import { LogCategoryUpdateSchema } from "@/shared/validations/log.schema";
import { LogCategoryService } from "@/core/services/log-category.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

type Params = { params: Promise<{ id: string }> };

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

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await RbacGuard.extractUser(request);
    const category = await LogCategoryService.getCategoryById(id);
    return NextResponse.json(category);
  } catch (error: unknown) {
    return handleError(error, `GET /api/v1/log-categories/${id}`);
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "UPDATE_LOG_CATEGORY");

    const body = await request.json();
    const validatedInput = LogCategoryUpdateSchema.parse(body);

    const updated = await LogCategoryService.updateCategory(id, validatedInput);
    return NextResponse.json(updated);
  } catch (error: unknown) {
    return handleError(error, `PUT /api/v1/log-categories/${id}`);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "DELETE_LOG_CATEGORY");

    const result = await LogCategoryService.deleteCategory(id);
    return NextResponse.json(result);
  } catch (error: unknown) {
    return handleError(error, `DELETE /api/v1/log-categories/${id}`);
  }
}
