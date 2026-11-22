import { NextRequest, NextResponse } from "next/server";
import { ServerQueryService } from "@/core/services/server-query.service";
import { OrgTaxonomyService } from "@/core/services/org-taxonomy.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

/**
 * Contenedores organizacionales: agregado de solo lectura que agrupa el
 * catálogo de servidores por la etiqueta `secretaria`, enriquecido con la
 * categoría de entidad y las etiquetas del catálogo editable.
 */
export async function GET(request: NextRequest) {
  try {
    await RbacGuard.extractUser(request);

    const [items, categories, tags] = await Promise.all([
      ServerQueryService.listSecretariaGroups(),
      OrgTaxonomyService.listCategories(),
      OrgTaxonomyService.listTagVocabulary(),
    ]);

    return NextResponse.json({
      items,
      categories,
      tags,
      total: items.length,
    });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Error en GET /api/v1/secretarias:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al consultar secretarías." },
      { status: 500 }
    );
  }
}
