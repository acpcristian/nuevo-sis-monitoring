import { z } from "zod";
import { MAX_UNIT_TAGS, MAX_UNIT_TAG_LENGTH } from "@/core/domain/org-taxonomy";

/** Categorías organizacionales (tipo de entidad). */
export const OrgCategoryCreateSchema = z.object({
  name: z.string().trim().min(2, "El nombre es requerido").max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "El slug solo admite minúsculas, números y guiones")
    .optional(),
  description: z.string().max(500).nullish(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "El color debe tener formato hexadecimal #RRGGBB")
    .optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export const OrgCategoryUpdateSchema = OrgCategoryCreateSchema.partial();

/** Etiquetas y categoría de una unidad organizacional. */
const UnitTagsSchema = z
  .array(z.string().trim().min(1).max(MAX_UNIT_TAG_LENGTH))
  .max(MAX_UNIT_TAGS, `Máximo ${MAX_UNIT_TAGS} etiquetas por unidad`);

export const OrgUnitCreateSchema = z.object({
  name: z.string().trim().min(2, "El nombre es requerido").max(200),
  categoryId: z.string().min(1).nullable().optional(),
  tags: UnitTagsSchema.optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  active: z.boolean().optional(),
});

export const OrgUnitUpdateSchema = z.object({
  categoryId: z.string().min(1).nullable().optional(),
  tags: UnitTagsSchema.optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  active: z.boolean().optional(),
});

export type OrgCategoryCreateInput = z.infer<typeof OrgCategoryCreateSchema>;
export type OrgCategoryUpdateInput = z.infer<typeof OrgCategoryUpdateSchema>;
export type OrgUnitCreateInput = z.infer<typeof OrgUnitCreateSchema>;
export type OrgUnitUpdateInput = z.infer<typeof OrgUnitUpdateSchema>;
