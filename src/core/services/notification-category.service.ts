import { prisma } from "@/infrastructure/db/prisma";
import { NotFoundError, ConflictError } from "@/shared/errors/domain-errors";
import {
  getNotificationCategoryKnowledge,
  NOTIFICATION_CATEGORY_KNOWLEDGE,
} from "@/core/domain/notification-knowledge";

/**
 * CRUD del catálogo de categorías de notificación (por sección del sistema).
 * Alimenta la revisión de "¿cuándo se dispara?" y "acciones recomendadas"
 * del detalle de cada categoría, y el enrutamiento canal → categorías.
 */
export class NotificationCategoryService {
  /** Lista el catálogo con el número de canales suscritos (categories has code). */
  public static async listCategories() {
    const items = await prisma.notificationCategoryModel.findMany({
      orderBy: [{ priority: "asc" }, { code: "asc" }],
    });

    const channelGroups = await prisma.notificationChannel.groupBy({
      by: ["categories"],
      _count: { id: true },
    });

    const counts = new Map<string, number>();
    for (const group of channelGroups) {
      for (const code of group.categories) {
        counts.set(code, (counts.get(code) ?? 0) + group._count.id);
      }
    }

    return items.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      section: this.sectionFor(item.code),
      description: item.description,
      triggerInfo: item.triggerInfo,
      defaultSeverity: item.defaultSeverity,
      recommendedActions: item.recommendedActions,
      priority: item.priority,
      channelCount: counts.get(item.code) ?? 0,
    }));
  }

  public static async getCategoryById(id: string) {
    const item = await prisma.notificationCategoryModel.findUnique({ where: { id } });
    if (!item) {
      throw new NotFoundError("Categoría de notificación");
    }
    const channelCount = await prisma.notificationChannel.count({
      where: { categories: { has: item.code } },
    });
    return {
      id: item.id,
      code: item.code,
      name: item.name,
      section: this.sectionFor(item.code),
      description: item.description,
      triggerInfo: item.triggerInfo,
      defaultSeverity: item.defaultSeverity,
      recommendedActions: item.recommendedActions,
      priority: item.priority,
      channelCount,
    };
  }

  public static async createCategory(input: {
    code: string;
    name: string;
    description?: string | null;
    triggerInfo?: string | null;
    defaultSeverity?: string;
    recommendedActions?: string | null;
    priority?: number;
  }) {
    const existing = await prisma.notificationCategoryModel.findUnique({ where: { code: input.code } });
    if (existing) {
      throw new ConflictError("Ya existe una categoría de notificación con ese código.");
    }
    return prisma.notificationCategoryModel.create({
      data: {
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        triggerInfo: input.triggerInfo ?? null,
        defaultSeverity: input.defaultSeverity ?? "MEDIUM",
        recommendedActions: input.recommendedActions ?? null,
        priority: input.priority ?? 5,
      },
    });
  }

  public static async updateCategory(
    id: string,
    input: {
      name?: string;
      description?: string | null;
      triggerInfo?: string | null;
      defaultSeverity?: string;
      recommendedActions?: string | null;
      priority?: number;
    }
  ) {
    const existing = await prisma.notificationCategoryModel.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("Categoría de notificación");
    }
    return prisma.notificationCategoryModel.update({
      where: { id },
      data: {
        name: input.name ?? existing.name,
        description: input.description === undefined ? existing.description : input.description,
        triggerInfo: input.triggerInfo === undefined ? existing.triggerInfo : input.triggerInfo,
        defaultSeverity: input.defaultSeverity ?? existing.defaultSeverity,
        recommendedActions:
          input.recommendedActions === undefined ? existing.recommendedActions : input.recommendedActions,
        priority: input.priority ?? existing.priority,
      },
    });
  }

  /** Solo puede eliminarse si ningún canal usa la categoría (canal → suscripciones). */
  public static async deleteCategory(id: string) {
    const existing = await prisma.notificationCategoryModel.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("Categoría de notificación");
    }
    const inUse = await prisma.notificationChannel.count({
      where: { categories: { has: existing.code } },
    });
    if (inUse > 0) {
      throw new ConflictError(
        `No se puede eliminar: ${inUse} canal(es) están suscritos a esta categoría. Retíralos primero.`
      );
    }
    await prisma.notificationCategoryModel.delete({ where: { id } });
    return { deleted: true };
  }

  /**
   * Autocura: si una categoría del conocimiento por defecto aún no existe
   * en la tabla, se crea con su contenido base (idempotente).
   */
  public static async resolveByCode(code: string) {
    const row = await prisma.notificationCategoryModel.findUnique({ where: { code } });
    if (row) return row;
    const knowledge = getNotificationCategoryKnowledge(code);
    return prisma.notificationCategoryModel.upsert({
      where: { code },
      create: knowledge
        ? {
            code,
            name: knowledge.name,
            description: knowledge.description,
            triggerInfo: knowledge.triggerInfo,
            defaultSeverity: knowledge.defaultSeverity,
            recommendedActions: knowledge.recommendedActions.join("\n"),
          }
        : { code, name: code },
      update: {},
    });
  }

  public static async ensureDefaultSeed(): Promise<void> {
    for (const knowledge of NOTIFICATION_CATEGORY_KNOWLEDGE) {
      const existing = await prisma.notificationCategoryModel.findUnique({
        where: { code: knowledge.code },
      });
      if (!existing) {
        await prisma.notificationCategoryModel.create({
          data: {
            code: knowledge.code,
            name: knowledge.name,
            description: knowledge.description,
            triggerInfo: knowledge.triggerInfo,
            defaultSeverity: knowledge.defaultSeverity,
            recommendedActions: knowledge.recommendedActions.join("\n"),
          },
        });
      }
    }
  }

  private static sectionFor(code: string): string {
    return getNotificationCategoryKnowledge(code)?.section ?? "Personalizada";
  }
}
