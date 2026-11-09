import { z } from "zod";
import { NOTIFICATION_SEVERITIES } from "@/core/domain/notification-knowledge";

/** CRUD del catálogo de categorías de notificación. */
export const NotificationCategoryCreateSchema = z.object({
  code: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[A-Z][A-Z0-9_]*$/, "El código debe estar en MAYÚSCULAS_CON_GUIONES_BAJOS"),
  name: z.string().min(2, "El nombre es requerido").max(100),
  description: z.string().max(1000).nullish(),
  triggerInfo: z.string().max(1000).nullish(),
  defaultSeverity: z.enum(NOTIFICATION_SEVERITIES).optional(),
  recommendedActions: z.string().max(5000).nullish(),
  priority: z.coerce.number().int().min(1).max(10).optional(),
});

export const NotificationCategoryUpdateSchema = NotificationCategoryCreateSchema.omit({ code: true }).extend({
  name: z.string().min(2, "El nombre es requerido").max(100).optional(),
  description: z.string().max(1000).nullish(),
  triggerInfo: z.string().max(1000).nullish(),
  defaultSeverity: z.enum(NOTIFICATION_SEVERITIES).optional(),
  recommendedActions: z.string().max(5000).nullish(),
  priority: z.coerce.number().int().min(1).max(10).optional(),
});

/** Canales de notificación. */
export const ChannelTypeSchema = z.enum(["EMAIL", "SLACK", "WEBHOOK", "PAGERDUTY"]);
export const ChannelStatusSchema = z.enum(["ACTIVE", "INACTIVE"]);

export const ChannelCreateSchema = z.object({
  type: ChannelTypeSchema,
  name: z.string().min(3, "El nombre requiere al menos 3 caracteres").max(100),
  description: z.string().max(500).optional(),
  config: z.record(z.string(), z.unknown()),
  /** Categorías a las que suscribe el canal; vacío = recibe todas. */
  categories: z.array(z.string().max(50)).max(50).optional(),
});

export const ChannelUpdateSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(500).nullish(),
  status: ChannelStatusSchema.optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  categories: z.array(z.string().max(50)).max(50).nullish(),
});

export type NotificationCategoryCreateInput = z.infer<typeof NotificationCategoryCreateSchema>;
export type NotificationCategoryUpdateInput = z.infer<typeof NotificationCategoryUpdateSchema>;
export type ChannelCreateInput = z.infer<typeof ChannelCreateSchema>;
export type ChannelUpdateInput = z.infer<typeof ChannelUpdateSchema>;
