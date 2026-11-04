import { z } from "zod";

export const ServerCredentialInputSchema = z.object({
  credentialType: z.enum(["SSH_KEY", "PASSWORD", "AGENT_TOKEN"]),
  username: z.string().min(1, "El usuario técnico es obligatorio").max(60),
  secretValue: z.string().min(1, "La clave o contraseña es obligatoria"),
  passphrase: z.string().optional(),
});

export const ServerTagSchema = z.object({
  key: z.string().min(1).max(50),
  value: z.string().min(1).max(100),
});

export const CreateServerSchema = z.object({
  name: z
    .string()
    .min(3, "El nombre debe tener al menos 3 caracteres")
    .max(100, "El nombre no puede exceder 100 caracteres")
    .regex(/^[a-zA-Z0-9_\-\.]+$/, "El nombre solo puede contener letras, números, guiones y puntos"),
  ipAddress: z
    .string()
    .min(1, "La dirección IP o hostname es obligatoria")
    .refine((val) => {
      // Validador flexible para IP o FQDN
      const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
      const fqdnRegex = /^[a-zA-Z0-9.-]+$/;
      return ipv4Regex.test(val) || fqdnRegex.test(val);
    }, "Debe ser una dirección IP o nombre de host válido"),
  hostname: z.string().max(255).optional().nullable(),
  osType: z.enum(["LINUX", "WINDOWS", "OTHER"]),
  osVersion: z.string().max(100).optional().nullable(),
  environment: z.enum(["PROD", "STAGING", "DEV", "QA"]),
  connectionPort: z.coerce.number().int().min(1).max(65535).default(22),
  technicalOwner: z.string().max(120).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  credential: ServerCredentialInputSchema.optional(),
  tags: z.array(ServerTagSchema).optional().default([]),
});

export const UpdateServerSchema = CreateServerSchema.partial().extend({
  newCredential: ServerCredentialInputSchema.optional(),
});

export const ChangeLifecycleSchema = z.object({
  newState: z.enum(["ACTIVE", "MAINTENANCE", "DISABLED"]),
  reason: z.string().max(255).optional(),
});

export const RetireServerSchema = z.object({
  confirmationName: z.string().min(1, "Debe ingresar el nombre del servidor para confirmar"),
});

/**
 * Sondeo bajo demanda. `ids` vacío/omitido significa "todos los servidores
 * ACTIVE" (máximo 100) y se usa al abrir el dashboard. La cobertura completa
 * del inventario la hace el scheduler en segundo plano, por lotes.
 */
export const MonitorServersSchema = z.object({
  ids: z
    .array(z.string().min(1, "ID de servidor inválido"))
    .max(100, "No se pueden monitorear más de 100 servidores por petición")
    .optional(),
  force: z.boolean().optional().default(false),
});

export type CreateServerInput = z.infer<typeof CreateServerSchema>;
export type UpdateServerInput = z.infer<typeof UpdateServerSchema>;
export type ChangeLifecycleInput = z.infer<typeof ChangeLifecycleSchema>;
export type RetireServerInput = z.infer<typeof RetireServerSchema>;

