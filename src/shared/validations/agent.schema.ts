import { z } from "zod";

export const LLM_PROVIDER_TYPES = [
  "OPENROUTER",
  "FREELLMAPI",
  "OPENAI",
  "ANTHROPIC",
  "DEEPSEEK",
  "GROQ",
  "OLLAMA_LOCAL",
  "CUSTOM",
] as const;

export const LlmProviderTypeSchema = z.enum(LLM_PROVIDER_TYPES);

/** Alta/actualización del proveedor de IA activo. */
export const AgentProviderUpsertSchema = z
  .object({
    providerType: LlmProviderTypeSchema,
    name: z.string().min(1, "El nombre del proveedor es requerido").max(80),
    baseUrl: z.string().min(1, "La URL base es requerida").max(500),
    model: z.string().min(1, "El modelo es requerido").max(150),
    temperature: z.coerce.number().min(0).max(2).optional(),
    maxOutputTokens: z.coerce.number().int().min(64).max(16384).optional(),
    /** Rate limiting por proveedor: null/ausente = sin límite. */
    rateLimitPerMinute: z.coerce.number().int().min(1).max(10000).nullable().optional(),
    rateLimitPerDay: z.coerce.number().int().min(1).max(1_000_000).nullable().optional(),
    /** La clave solo se envía para crear/rotar; nunca se devuelve por GET. */
    apiToken: z.string().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    // CUSTOM permite cualquier URL; el resto exige https o http de red local.
    if (!/^https?:\/\/.+/.test(value.baseUrl)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["baseUrl"],
        message: "La URL base debe iniciar con http:// o https://",
      });
    }
  });

/** Prueba de conexión con el proveedor (sin guardar). */
export const AgentProviderTestSchema = z.object({
  baseUrl: z.string().min(1).max(500),
  model: z.string().min(1).max(150),
  /** Vacío → usa la clave cifrada almacenada del proveedor activo. */
  apiToken: z.string().max(500).optional(),
});

/** Perfil de comportamiento del agente. */
export const AgentProfileUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  /** Tools de dominio (function calling sobre inventario/logs/alertas/incidentes). */
  toolsEnabled: z.boolean().optional(),
  name: z.string().min(1, "El nombre del agente es requerido").max(120).optional(),
  tone: z.string().max(8000).nullish(),
  instructions: z.string().max(32000).nullish(),
  escalationRules: z.string().max(16000).nullish(),
  greeting: z.string().max(2000).nullish(),
});

/** Mensaje del chat de prueba (historial efímero del cliente). */
export const AgentChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(16000),
});

export const AgentChatRequestSchema = z.object({
  message: z.string().min(1, "El mensaje no puede estar vacío").max(16000),
  /** Conversación persistida: si viene, el historial se carga de la BD. */
  conversationId: z.string().uuid().optional(),
  /** Fallback efímero (solo primera vez sin conversación). */
  history: z.array(AgentChatMessageSchema).max(40).optional(),
});

/** Entrada de Knowledge Base del agente. */
export const AgentKbEntryCreateSchema = z
  .object({
    kind: z.enum(["QA", "BLOQUE"]),
    question: z.string().max(2000).optional(),
    answer: z.string().max(8000).optional(),
    title: z.string().max(200).optional(),
    content: z.string().max(24000).optional(),
    enabled: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "QA") {
      if (!value.question?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["question"], message: "La pregunta es requerida en una entrada QA." });
      }
      if (!value.answer?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["answer"], message: "La respuesta es requerida en una entrada QA." });
      }
    } else {
      if (!value.title?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["title"], message: "El título es requerido en un bloque." });
      }
      if (!value.content?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["content"], message: "El contenido es requerido en un bloque." });
      }
    }
  });

export const AgentKbEntryUpdateSchema = z.object({
  question: z.string().max(2000).optional(),
  answer: z.string().max(8000).optional(),
  title: z.string().max(200).optional(),
  content: z.string().max(24000).optional(),
  enabled: z.boolean().optional(),
});

export type LlmProviderTypeInput = z.infer<typeof LlmProviderTypeSchema>;
export type AgentProviderUpsertInput = z.infer<typeof AgentProviderUpsertSchema>;
export type AgentProviderTestInput = z.infer<typeof AgentProviderTestSchema>;
export type AgentProfileUpdateInput = z.infer<typeof AgentProfileUpdateSchema>;
export type AgentChatRequestInput = z.infer<typeof AgentChatRequestSchema>;
export type AgentKbEntryCreateInput = z.infer<typeof AgentKbEntryCreateSchema>;
export type AgentKbEntryUpdateInput = z.infer<typeof AgentKbEntryUpdateSchema>;
