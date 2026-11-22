import { prisma } from "@/infrastructure/db/prisma";
import { ConflictError, NotFoundError } from "@/shared/errors/domain-errors";
import {
  MAX_UNIT_TAGS,
  ORG_CATEGORY_SEEDS,
  ORG_UNIT_SEEDS,
  buildOrgUnitIndex,
  normalizeOrgTags,
  normalizedSecretariaKey,
  slugifyOrgCategory,
} from "@/core/domain/org-taxonomy";

/**
 * Catálogo editable de categorías (tipo de entidad) y etiquetas por unidad
 * organizacional. Complementa —no reemplaza— la etiqueta `secretaria` de los
 * servidores: el nombre de la unidad sigue siendo el valor de esa etiqueta.
 */
export interface OrgCategoryDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string;
  sortOrder: number;
  unitCount: number;
}

export interface OrgUnitCategoryDto {
  id: string;
  slug: string;
  name: string;
  color: string;
  sortOrder: number;
}

export interface OrgUnitDto {
  id: string;
  name: string;
  categoryId: string | null;
  category: OrgUnitCategoryDto | null;
  tags: string[];
  sortOrder: number;
  active: boolean;
}

export interface OrgCategoryInput {
  name?: string;
  slug?: string;
  description?: string | null;
  color?: string;
  sortOrder?: number;
}

export interface OrgUnitInput {
  name?: string;
  categoryId?: string | null;
  tags?: string[];
  sortOrder?: number;
  active?: boolean;
}

export class OrgTaxonomyService {
  /**
   * Autocura idempotente: si las tablas están vacías siembra el catálogo
   * institucional. No sobrescribe ediciones existentes.
   */
  public static async ensureSeed(): Promise<void> {
    const categoryCount = await prisma.orgCategory.count();
    if (categoryCount === 0) {
      await prisma.orgCategory.createMany({
        data: ORG_CATEGORY_SEEDS.map((category) => ({
          slug: category.slug,
          name: category.name,
          description: category.description,
          color: category.color,
          sortOrder: category.sortOrder,
        })),
        skipDuplicates: true,
      });
    }

    const unitCount = await prisma.orgUnit.count();
    if (unitCount === 0) {
      const categories = await prisma.orgCategory.findMany({ select: { id: true, slug: true } });
      const categoryBySlug = new Map(categories.map((category) => [category.slug, category.id]));

      await prisma.orgUnit.createMany({
        data: ORG_UNIT_SEEDS.map((unit) => ({
          name: unit.name,
          categoryId: categoryBySlug.get(unit.categorySlug) ?? null,
          tags: unit.tags,
          sortOrder: unit.sortOrder,
        })),
        skipDuplicates: true,
      });
    }
  }

  public static async listCategories(): Promise<OrgCategoryDto[]> {
    await this.ensureSeed();
    const rows = await prisma.orgCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { units: true } } },
    });

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      color: row.color,
      sortOrder: row.sortOrder,
      unitCount: row._count.units,
    }));
  }

  public static async listUnits(): Promise<OrgUnitDto[]> {
    await this.ensureSeed();
    const rows = await prisma.orgUnit.findMany({
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
      include: { category: { select: { id: true, slug: true, name: true, color: true, sortOrder: true } } },
    });

    return rows.map((row) => this.toUnitDto(row));
  }

  /** Unidades con el conteo de servidores (no retirados) asociados a su etiqueta. */
  public static async listUnitsWithServerCounts(): Promise<Array<OrgUnitDto & { serverCount: number }>> {
    const [units, rows] = await Promise.all([
      this.listUnits(),
      prisma.server.findMany({
        where: { lifecycleState: { not: "RETIRED" } },
        select: { tags: { select: { tag: { select: { key: true, value: true } } } } },
      }),
    ]);

    const index = buildOrgUnitIndex(units);
    const counts = new Map<string, number>();

    for (const server of rows) {
      const raw = this.secretariaValueOf(server.tags);
      if (!raw) continue;
      const unit = index.get(normalizedSecretariaKey(raw));
      if (!unit) continue;
      counts.set(unit.id, (counts.get(unit.id) ?? 0) + 1);
    }

    return units.map((unit) => ({ ...unit, serverCount: counts.get(unit.id) ?? 0 }));
  }

  public static async createCategory(input: OrgCategoryInput): Promise<OrgCategoryDto> {
    const name = input.name?.trim();
    if (!name) throw new ConflictError("El nombre de la categoría es obligatorio.");

    const existingName = await prisma.orgCategory.findUnique({ where: { name } });
    if (existingName) throw new ConflictError("Ya existe una categoría con ese nombre.");

    const slug = await this.uniqueCategorySlug(input.slug?.trim() || slugifyOrgCategory(name));

    const created = await prisma.orgCategory.create({
      data: {
        name,
        slug,
        description: input.description?.trim() || null,
        color: this.normalizeColor(input.color),
        sortOrder: input.sortOrder ?? 999,
      },
    });

    return {
      id: created.id,
      slug: created.slug,
      name: created.name,
      description: created.description,
      color: created.color,
      sortOrder: created.sortOrder,
      unitCount: 0,
    };
  }

  public static async updateCategory(id: string, input: OrgCategoryInput): Promise<OrgCategoryDto> {
    const existing = await prisma.orgCategory.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Categoría organizacional");

    const name = input.name?.trim();
    if (name && name !== existing.name) {
      const duplicate = await prisma.orgCategory.findUnique({ where: { name } });
      if (duplicate) throw new ConflictError("Ya existe una categoría con ese nombre.");
    }

    const updated = await prisma.orgCategory.update({
      where: { id },
      data: {
        name: name ?? existing.name,
        description: input.description === undefined ? existing.description : (input.description?.trim() || null),
        color: input.color === undefined ? existing.color : this.normalizeColor(input.color),
        sortOrder: input.sortOrder ?? existing.sortOrder,
      },
      include: { _count: { select: { units: true } } },
    });

    return {
      id: updated.id,
      slug: updated.slug,
      name: updated.name,
      description: updated.description,
      color: updated.color,
      sortOrder: updated.sortOrder,
      unitCount: updated._count.units,
    };
  }

  /** Solo se elimina una categoría sin unidades asignadas. */
  public static async deleteCategory(id: string): Promise<{ deleted: true }> {
    const existing = await prisma.orgCategory.findUnique({
      where: { id },
      include: { _count: { select: { units: true } } },
    });
    if (!existing) throw new NotFoundError("Categoría organizacional");
    if (existing._count.units > 0) {
      throw new ConflictError(
        `No se puede eliminar: ${existing._count.units} unidad(es) usan esta categoría. Reasígnalas primero.`
      );
    }

    await prisma.orgCategory.delete({ where: { id } });
    return { deleted: true };
  }

  public static async createUnit(input: OrgUnitInput): Promise<OrgUnitDto> {
    const name = input.name?.trim();
    if (!name) throw new ConflictError("El nombre de la unidad es obligatorio.");

    const existing = await prisma.orgUnit.findUnique({ where: { name } });
    if (existing) throw new ConflictError("Ya existe una unidad con ese nombre.");

    if (input.categoryId) {
      const category = await prisma.orgCategory.findUnique({ where: { id: input.categoryId } });
      if (!category) throw new NotFoundError("Categoría organizacional");
    }

    const created = await prisma.orgUnit.create({
      data: {
        name,
        categoryId: input.categoryId ?? null,
        tags: normalizeOrgTags(input.tags ?? []),
        sortOrder: input.sortOrder ?? 999,
        active: input.active ?? true,
      },
      include: { category: { select: { id: true, slug: true, name: true, color: true, sortOrder: true } } },
    });

    return this.toUnitDto(created);
  }

  /**
   * Actualiza categoría, etiquetas y orden. El nombre es inmutable: es la clave
   * que comparten los servidores en su etiqueta `secretaria`.
   */
  public static async updateUnit(id: string, input: OrgUnitInput): Promise<OrgUnitDto> {
    const existing = await prisma.orgUnit.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Unidad organizacional");

    if (input.categoryId) {
      const category = await prisma.orgCategory.findUnique({ where: { id: input.categoryId } });
      if (!category) throw new NotFoundError("Categoría organizacional");
    }

    if (input.tags && input.tags.length > MAX_UNIT_TAGS) {
      throw new ConflictError(`Cada unidad admite hasta ${MAX_UNIT_TAGS} etiquetas.`);
    }

    const updated = await prisma.orgUnit.update({
      where: { id },
      data: {
        categoryId: input.categoryId === undefined ? existing.categoryId : input.categoryId,
        tags: input.tags === undefined ? existing.tags : normalizeOrgTags(input.tags),
        sortOrder: input.sortOrder ?? existing.sortOrder,
        active: input.active ?? existing.active,
      },
      include: { category: { select: { id: true, slug: true, name: true, color: true, sortOrder: true } } },
    });

    return this.toUnitDto(updated);
  }

  /** Solo se elimina una unidad sin servidores asociados por etiqueta. */
  public static async deleteUnit(id: string): Promise<{ deleted: true }> {
    const existing = await prisma.orgUnit.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Unidad organizacional");

    const assigned = await prisma.server.count({
      where: {
        tags: {
          some: {
            tag: {
              AND: [
                { value: { equals: existing.name, mode: "insensitive" } },
                { key: { equals: "secretaria", mode: "insensitive" } },
              ],
            },
          },
        },
      },
    });
    if (assigned > 0) {
      throw new ConflictError(
        `No se puede eliminar: ${assigned} servidor(es) usan "${existing.name}" en su etiqueta de secretaría.`
      );
    }

    await prisma.orgUnit.delete({ where: { id } });
    return { deleted: true };
  }

  /** Vocabulario de etiquetas en uso (para filtros y sugerencias del agente). */
  public static async listTagVocabulary(): Promise<string[]> {
    const units = await this.listUnits();
    const seen = new Map<string, string>();
    for (const unit of units) {
      for (const tag of unit.tags) {
        const key = normalizedSecretariaKey(tag);
        if (!seen.has(key)) seen.set(key, tag);
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, "es"));
  }

  private static toUnitDto(row: {
    id: string;
    name: string;
    categoryId: string | null;
    tags: string[];
    sortOrder: number;
    active: boolean;
    category: OrgUnitCategoryDto | null;
  }): OrgUnitDto {
    return {
      id: row.id,
      name: row.name,
      categoryId: row.categoryId,
      category: row.category,
      tags: row.tags,
      sortOrder: row.sortOrder,
      active: row.active,
    };
  }

  private static secretariaValueOf(
    tags: Array<{ tag: { key: string; value: string } }>
  ): string | null {
    const tag = tags.find(
      (entry) =>
        entry.tag.key.trim().toLowerCase().replace(/í/g, "i") === "secretaria" &&
        entry.tag.value.trim().length > 0
    );
    return tag?.tag.value.trim() ?? null;
  }

  private static normalizeColor(color?: string): string {
    if (color && /^#[0-9a-fA-F]{6}$/.test(color)) return color.toLowerCase();
    return "#6366f1";
  }

  private static async uniqueCategorySlug(base: string): Promise<string> {
    const root = base || "categoria";
    let candidate = root;
    let suffix = 2;
    // Tolerante a carreras: reintenta con sufijo hasta encontrar uno libre.
    while (await prisma.orgCategory.findUnique({ where: { slug: candidate }, select: { id: true } })) {
      candidate = `${root}-${suffix}`;
      suffix += 1;
      if (suffix > 50) {
        candidate = `${root}-${Date.now()}`;
        break;
      }
    }
    return candidate;
  }
}
