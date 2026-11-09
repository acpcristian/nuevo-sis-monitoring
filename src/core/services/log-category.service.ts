import { prisma } from "@/infrastructure/db/prisma";
import { NotFoundError, ConflictError } from "@/shared/errors/domain-errors";
import { getCategoryKnowledge, joinKnowledgeText } from "@/core/domain/log-knowledge";

/**
 * Servicio del CRUD del catálogo de categorías de log.
 *
 * Este catálogo alimenta la sección "¿Por qué ocurre?" y "Soluciones
 * sugeridas" del detalle de logs; el contenido por defecto proviene de
 * LOG_CATEGORY_KNOWLEDGE y puede personalizarse aquí sin tocar código.
 */
export class LogCategoryService {
  /** Lista el catálogo con el conteo de eventos por categoría. */
  public static async listCategories() {
    const items = await prisma.logCategoryModel.findMany({
      orderBy: [{ priority: "asc" }, { code: "asc" }],
      include: { _count: { select: { events: true } } },
    });

    return items.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      commonCauses: item.commonCauses,
      solutions: item.solutions,
      priority: item.priority,
      eventCount: item._count.events,
    }));
  }

  public static async getCategoryById(id: string) {
    const item = await prisma.logCategoryModel.findUnique({
      where: { id },
      include: { _count: { select: { events: true } } },
    });
    if (!item) {
      throw new NotFoundError("Categoría de log");
    }
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      commonCauses: item.commonCauses,
      solutions: item.solutions,
      priority: item.priority,
      eventCount: item._count.events,
    };
  }

  public static async createCategory(input: {
    code: string;
    name: string;
    description?: string | null;
    commonCauses?: string | null;
    solutions?: string | null;
    priority?: number;
  }) {
    const existing = await prisma.logCategoryModel.findUnique({ where: { code: input.code } });
    if (existing) {
      throw new ConflictError("Ya existe una categoría de log con ese código.");
    }
    const created = await prisma.logCategoryModel.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        commonCauses: input.commonCauses ?? null,
        solutions: input.solutions ?? null,
        priority: input.priority ?? 5,
      },
    });
    return created;
  }

  public static async updateCategory(
    id: string,
    input: {
      name?: string;
      description?: string | null;
      commonCauses?: string | null;
      solutions?: string | null;
      priority?: number;
    }
  ) {
    const existing = await prisma.logCategoryModel.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("Categoría de log");
    }
    return prisma.logCategoryModel.update({
      where: { id },
      data: {
        name: input.name ?? existing.name,
        description: input.description === undefined ? existing.description : input.description,
        commonCauses:
          input.commonCauses === undefined ? existing.commonCauses : input.commonCauses,
        solutions: input.solutions === undefined ? existing.solutions : input.solutions,
        priority: input.priority ?? existing.priority,
      },
    });
  }

  /**
   * Elimina una categoría solo si no tiene eventos asociados; se usa
   * básicamente para retirar entradas personalizadas del catálogo.
   */
  public static async deleteCategory(id: string) {
    const existing = await prisma.logCategoryModel.findUnique({
      where: { id },
      include: { _count: { select: { events: true } } },
    });
    if (!existing) {
      throw new NotFoundError("Categoría de log");
    }
    if (existing._count.events > 0) {
      throw new ConflictError(
        `No se puede eliminar: la categoría tiene ${existing._count.events} evento(s) asociados. Reasigna o depura los eventos primero.`
      );
    }
    await prisma.logCategoryModel.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Vector de autocura: completa causas/soluciones default en categorías
   *buscadas por código cuando aún no tienen contenido editado.
   */
  public static async ensureKnowledgeSeed(code: string): Promise<void> {
    const knowledge = getCategoryKnowledge(code);
    const item = await prisma.logCategoryModel.findUnique({ where: { code } });
    if (item && !item.description && !item.commonCauses && !item.solutions) {
      await prisma.logCategoryModel.update({
        where: { id: item.id },
        data: {
          name: item.name === code ? knowledge.label : item.name,
          description: knowledge.description,
          commonCauses: joinKnowledgeText(knowledge.defaultCauses),
          solutions: joinKnowledgeText(knowledge.defaultSolutions),
        },
      });
    }
  }
}
