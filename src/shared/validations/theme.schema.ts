import { z } from "zod";

export const ThemeSchema = z.object({
  preset: z.enum([
    "indigo",
    "ocean",
    "emerald",
    "violet",
    "rose",
    "amber",
    "graphite",
    "custom",
  ]),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color inválido: usa el formato #rrggbb."),
  mode: z.enum(["light", "dark"]),
  radius: z
    .number()
    .int("El radio debe ser un número entero.")
    .min(0, "El radio mínimo es 0 px.")
    .max(16, "El radio máximo es 16 px."),
  density: z.enum(["comfortable", "compact"]),
});

export type ThemeInput = z.infer<typeof ThemeSchema>;
