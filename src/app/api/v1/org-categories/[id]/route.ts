import { NextRequest, NextResponse } from "next/server";
import { OrgTaxonomyService } from "@/core/services/org-taxonomy.service";
import { AuditService } from "@/core/services/audit.service";
import { OrgCategoryUpdateSchema } from "@/shared/validations/org.schema";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await RbacGuard.extractUser(request);
    const categories = await OrgTaxonomyService.listCategories();
    const category = categories.find((item) => item.id === id);
    if (!category) {
      return NextResponse.json(
        { error_code: "NOT_FOUND", message: "Categoría organizacional no encontrada." },
        { status: 404 }
      );
    }
    return NextResponse.json(category);
  } catch (error: unknown) {
    return handleError(error, `GET /api/v1/org-categories/${id}`);
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "UPDATE_ORG_CATEGORY");

    const body = await request.json();
    const input = OrgCategoryUpdateSchema.parse(body);
    const updated = await OrgTaxonomyService.updateCategory(id, input);

    await AuditService.recordEvent({
      userId: user.id,
      action: "ORG_CATEGORY_UPDATED",
      detailsDiff: {
        id: updated.id,
        name: updated.name,
        color: updated.color,
        sortOrder: updated.sortOrder,
      },
      ipAddress: user.ipAddress ?? null,
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    return handleError(error, `PUT /api/v1/org-categories/${id}`);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "DELETE_ORG_CATEGORY");

    const result = await OrgTaxonomyService.deleteCategory(id);

    await AuditService.recordEvent({
      userId: user.id,
      action: "ORG_CATEGORY_DELETED",
      detailsDiff: { id },
      ipAddress: user.ipAddress ?? null,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    return handleError(error, `DELETE /api/v1/org-categories/${id}`);
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
        message: "Datos de entrada inválidos para la categoría organizacional.",
        details: error,
      },
      { status: 400 }
    );
  }

  console.error(`Error inesperado en ${context}:`, error);
  return NextResponse.json(
    { error_code: "INTERNAL_ERROR", message: "Error interno al gestionar categorías organizacionales." },
    { status: 500 }
  );
}
