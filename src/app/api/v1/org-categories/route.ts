import { NextRequest, NextResponse } from "next/server";
import { OrgTaxonomyService } from "@/core/services/org-taxonomy.service";
import { AuditService } from "@/core/services/audit.service";
import { OrgCategoryCreateSchema } from "@/shared/validations/org.schema";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

/**
 * Catálogo de categorías organizacionales (tipo de entidad).
 * GET: lectura para usuarios autenticados. POST: solo SUPERADMIN, auditado.
 */
export async function GET(request: NextRequest) {
  try {
    await RbacGuard.extractUser(request);
    const items = await OrgTaxonomyService.listCategories();
    return NextResponse.json({ items, total: items.length });
  } catch (error: unknown) {
    return handleError(error, "GET /api/v1/org-categories");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "CREATE_ORG_CATEGORY");

    const body = await request.json();
    const input = OrgCategoryCreateSchema.parse(body);
    const created = await OrgTaxonomyService.createCategory(input);

    await AuditService.recordEvent({
      userId: user.id,
      action: "ORG_CATEGORY_CREATED",
      detailsDiff: { id: created.id, name: created.name, slug: created.slug },
      ipAddress: user.ipAddress ?? null,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    return handleError(error, "POST /api/v1/org-categories");
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
