import { z } from "zod";

export const USER_ROLES = ["SUPERADMIN", "OBSERVADOR"] as const;
export const UserRoleSchema = z.enum(USER_ROLES);

export const UsernameSchema = z
  .string()
  .trim()
  .min(3, "El usuario debe tener al menos 3 caracteres.")
  .max(50, "El usuario no puede exceder 50 caracteres.")
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    "El usuario solo puede contener letras, números, punto, guion y guion bajo."
  );

export const PasswordSchema = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres.")
  .max(128, "La contraseña no puede exceder 128 caracteres.")
  .regex(/[A-Za-z]/, "La contraseña debe incluir al menos una letra.")
  .regex(/[0-9]/, "La contraseña debe incluir al menos un número.");

export const CreateUserSchema = z.object({
  username: UsernameSchema,
  displayName: z.string().trim().max(100, "El nombre visible no puede exceder 100 caracteres.").optional(),
  role: UserRoleSchema,
  password: PasswordSchema,
});

export const UpdateUserSchema = z
  .object({
    displayName: z.string().trim().max(100, "El nombre visible no puede exceder 100 caracteres.").optional(),
    role: UserRoleSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Debe indicar al menos un campo a actualizar.",
  });

export const ResetPasswordSchema = z.object({
  newPassword: PasswordSchema,
});

export const ChangeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1, "La contraseña actual es obligatoria."),
  newPassword: PasswordSchema,
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
