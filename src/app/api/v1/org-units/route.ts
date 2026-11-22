import { NextRequest, NextResponse } from "next/server";
import { OrgTaxonomyService } from "@/core/services/org-taxonomy.service";
import { AuditService } from "@/core/services/audit.service";
import { OrgUnitCreateSchema } from "@/shared/validations/org.schema";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

/**
 * Unidades organizacionales con su categoría, etiquetas y conteo de servidores.
 * GET: lectura autenticada. POST: solo SUPERADMIN, auditado.
 */
export async function GET(request: NextRequest) {
  try {
    await RbacGuard.extractUser(request);

    const [items, categories, tags] = await Promise.all([
      OrgTaxonomyService.listUnitsWithServerCounts(),
      OrgTaxonomyService.listCategories(),
      OrgTaxonomyService.listTagVocabulary(),
    ]);

    return NextResponse.json({ items, categories, tags, total: items.length });
  } catch (error: unknown) {
    return handleError(error, "GET /api/v1/org-units");
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "CREATE_ORG_UNIT");

    const body = await request.json();
    const input = OrgUnitCreateSchema.parse(body);
    const created = await OrgTaxonomyService.createUnit(input);

    await AuditService.recordEvent({
      userId: user.id,
      action: "ORG_UNIT_CREATED",
      detailsDiff: {
        id: created.id,
        name: created.name,
        categoryId: created.categoryId,
        tags: created.tags,
      },
      ipAddress: user.ipAddress ?? null,
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    return handleError(error, "POST /api/v1/org-units");
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
        message: "Datos de entrada inválidos para la unidad organizacional.",
        details: error,
      },
      { status: 400 }
    );
  }

  console.error(`Error inesperado en ${context}:`, error);
  return NextResponse.json(
    { error_code: "INTERNAL_ERROR", message: "Error interno al gestionar unidades organizacionales." },
    { status: 500 }
  );
}
