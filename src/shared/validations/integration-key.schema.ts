import { z } from "zod";

/** Claves de servicio para integraciones MCP (agentes externos). */
export const ServiceKeyCreateSchema = z.object({
  name: z
    .string()
    .min(3, "El nombre requiere al menos 3 caracteres")
    .max(60)
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/, "El nombre solo admite letras, números, guiones y guion bajo"),
  scopes: z
    .array(z.enum(["mcp:read", "mcp:create_incident"]))
    .max(10)
    .optional(),
});

export type ServiceKeyCreateInput = z.infer<typeof ServiceKeyCreateSchema>;
