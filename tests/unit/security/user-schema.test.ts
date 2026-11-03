import { describe, it, expect } from "vitest";
import {
  CreateUserSchema,
  ChangeOwnPasswordSchema,
  PasswordSchema,
  UpdateUserSchema,
  UsernameSchema,
} from "@/shared/validations/user.schema";

describe("007 — Validación de usuarios y contraseñas", () => {
  it("acepta un username válido con punto, guion y guion bajo", () => {
    expect(UsernameSchema.parse("juan.perez_01-noche")).toBe("juan.perez_01-noche");
    expect(UsernameSchema.parse("  admin  ")).toBe("admin");
  });

  it("rechaza usernames demasiado cortos o con caracteres no permitidos", () => {
    expect(UsernameSchema.safeParse("ab").success).toBe(false);
    expect(UsernameSchema.safeParse("juan perez").success).toBe(false);
    expect(UsernameSchema.safeParse("juan@elalto.gob.bo").success).toBe(false);
  });

  it("exige contraseña de 10+ caracteres con letra y número", () => {
    expect(PasswordSchema.safeParse("Abcdef1234").success).toBe(true);
    expect(PasswordSchema.safeParse("corta1").success).toBe(false);
    expect(PasswordSchema.safeParse("sololetraslargas").success).toBe(false);
    expect(PasswordSchema.safeParse("1234567890123").success).toBe(false);
  });

  it("valida el contrato de alta completa", () => {
    expect(
      CreateUserSchema.safeParse({
        username: "operador.turno",
        displayName: "Operador Turno Noche",
        role: "OBSERVADOR",
        password: "Turno2026seguro",
      }).success
    ).toBe(true);

    expect(
      CreateUserSchema.safeParse({
        username: "operador.turno",
        role: "INVITADO",
        password: "Turno2026seguro",
      }).success
    ).toBe(false);
  });

  it("rechaza una actualización vacía", () => {
    expect(UpdateUserSchema.safeParse({}).success).toBe(false);
    expect(UpdateUserSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it("exige la contraseña actual en el cambio propio", () => {
    expect(ChangeOwnPasswordSchema.safeParse({ newPassword: "Nueva2026segura" }).success).toBe(false);
    expect(
      ChangeOwnPasswordSchema.safeParse({
        currentPassword: "Actual2026ok",
        newPassword: "Nueva2026segura",
      }).success
    ).toBe(true);
  });
});
