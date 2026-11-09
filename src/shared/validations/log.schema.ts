import { z } from "zod";

export const LogCategorySchema = z.enum([
  "SYS_KERNEL",
  "AUTH_ACCESS",
  "SSH_NETWORK",
  "SYSTEM_SERVICE",
  "WEB_APP",
  "DATABASE",
  "STORAGE_HW",
  "BACKUP_TASK",
  "SECURITY_AUDIT",
  "AGENT_ERROR",
]);

export const LogSeveritySchema = z.enum(["INFO", "WARN", "ERROR", "CRITICAL"]);

export const IngestLogSchema = z.object({
  serverId: z.string().uuid().optional().nullable(),
  category: LogCategorySchema,
  eventTimestamp: z.string().datetime({ offset: true }),
  eventType: z.string().max(100).optional().nullable(),
  severity: LogSeveritySchema,
  message: z.string().min(1, "El mensaje del log es obligatorio"),
  rawLog: z.string().optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const CreateDiagnosisSchema = z.object({
  eventIds: z.array(z.string().uuid()).min(1, "Debe proporcionar al menos un ID de evento"),
  observedFacts: z.string().min(1, "Los hechos observados son obligatorios"),
  probableCause: z.string().min(1, "La causa probable es obligatoria"),
  evidenceSupport: z.record(z.string(), z.unknown()).optional().nullable(),
  alternativeDiagnoses: z.string().max(1000).optional().nullable(),
  impactPotential: z.string().max(1000).optional().nullable(),
  verificationSteps: z.string().max(1000).optional().nullable(),
  remediationRecommendations: z.string().max(1000).optional().nullable(),
  confidenceLevel: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

export const LogListFilterSchema = z.object({
  serverId: z.string().uuid().optional(),
  category: LogCategorySchema.optional(),
  severity: LogSeveritySchema.optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  search: z.string().max(500).optional().nullable(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const FreshnessStateSchema = z.enum([
  "FRESH",
  "STALE",
  "AGENT_DISCONNECTED",
  "UNREACHABLE",
]);

/**
 * CRUD del catálogo de categorías de log (análisis: ¿por qué ocurre?,
 * ¿cómo resolverlo?). commonCauses y solutions se guardan como texto con
 * un elemento por línea.
 */
export const LogCategoryCreateSchema = z.object({
  code: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[A-Z][A-Z0-9_]*$/, "El código debe estar en MAYÚSCULAS_CON_GUIONES_BAJOS"),
  name: z.string().min(1, "El nombre es requerido").max(100),
  description: z.string().max(2000).nullish(),
  commonCauses: z.string().max(5000).nullish(),
  solutions: z.string().max(5000).nullish(),
  priority: z.coerce.number().int().min(1).max(10).optional(),
});

export const LogCategoryUpdateSchema = LogCategoryCreateSchema.omit({ code: true }).extend({
  name: z.string().min(1, "El nombre es requerido").max(100).optional(),
  description: z.string().max(2000).nullish(),
  commonCauses: z.string().max(5000).nullish(),
  solutions: z.string().max(5000).nullish(),
  priority: z.coerce.number().int().min(1).max(10).optional(),
});

export type LogCategoryCreateInput = z.infer<typeof LogCategoryCreateSchema>;
export type LogCategoryUpdateInput = z.infer<typeof LogCategoryUpdateSchema>;

export type IngestLogInput = z.infer<typeof IngestLogSchema>;
export type CreateDiagnosisInput = z.infer<typeof CreateDiagnosisSchema>;
export type LogListFilterInput = z.infer<typeof LogListFilterSchema>;
