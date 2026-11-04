import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).default("postgresql://postgres:postgres@localhost:5432/nuevo_sis"),
  ENCRYPTION_KEY: z
    .string()
    .length(64, "ENCRYPTION_KEY debe ser un string hexadecimal de 64 caracteres (32 bytes)")
    .regex(/^[0-9a-fA-F]+$/, "ENCRYPTION_KEY debe contener únicamente caracteres hexadecimales")
    .default("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"),
  PORT: z.coerce.number().default(3000),
  AUTH_SECRET: z.string().min(16).optional(),
  SUPERADMIN_USER: z.string().min(3).optional(),
  SUPERADMIN_PASSWORD: z.string().min(8).optional(),
  /** Sondeo periódico de servidores en el proceso del servidor Next.js. */
  MONITOR_SCHEDULER_ENABLED: z.enum(["true", "false"]).default("true"),
  /** Intervalo entre pasadas del scheduler; se recorta a [15 s, 1 h]. */
  MONITOR_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
});

export type Env = z.infer<typeof envSchema>;

let parsedEnv: Env;

export function getEnv(): Env {
  if (!parsedEnv) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
      throw new Error(`Error de configuración de entorno: ${issues}`);
    }
    parsedEnv = result.data;
  }
  return parsedEnv;
}

