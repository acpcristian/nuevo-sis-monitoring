import { NextRequest, NextResponse } from "next/server";
import { OrgTaxonomyService } from "@/core/services/org-taxonomy.service";
import { AuditService } from "@/core/services/audit.service";
import { OrgUnitUpdateSchema } from "@/shared/validations/org.schema";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    await RbacGuard.extractUser(request);
    const units = await OrgTaxonomyService.listUnitsWithServerCounts();
    const unit = units.find((item) => item.id === id);
    if (!unit) {
      return NextResponse.json(
        { error_code: "NOT_FOUND", message: "Unidad organizacional no encontrada." },
        { status: 404 }
      );
    }
    return NextResponse.json(unit);
  } catch (error: unknown) {
    return handleError(error, `GET /api/v1/org-units/${id}`);
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "UPDATE_ORG_UNIT");

    const body = await request.json();
    const input = OrgUnitUpdateSchema.parse(body);
    const updated = await OrgTaxonomyService.updateUnit(id, input);

    await AuditService.recordEvent({
      userId: user.id,
      action: "ORG_UNIT_UPDATED",
      detailsDiff: {
        id: updated.id,
        name: updated.name,
        categoryId: updated.categoryId,
        tags: updated.tags,
        sortOrder: updated.sortOrder,
      },
      ipAddress: user.ipAddress ?? null,
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    return handleError(error, `PUT /api/v1/org-units/${id}`);
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "DELETE_ORG_UNIT");

    const result = await OrgTaxonomyService.deleteUnit(id);

    await AuditService.recordEvent({
      userId: user.id,
      action: "ORG_UNIT_DELETED",
      detailsDiff: { id },
      ipAddress: user.ipAddress ?? null,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    return handleError(error, `DELETE /api/v1/org-units/${id}`);
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
