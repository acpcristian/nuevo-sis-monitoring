import { describe, it, expect } from "vitest";
import { ChangeLifecycleSchema, RetireServerSchema } from "@/shared/validations/server.schema";

describe("Dominio: Máquina de Estados del Ciclo de Vida de Servidores (US3)", () => {
  it("debe validar transiciones hacia MAINTENANCE con motivo explícito", () => {
    const input = {
      newState: "MAINTENANCE" as const,
      reason: "Ventana de mantenimiento programada para actualización de SO",
    };

    const parsed = ChangeLifecycleSchema.safeParse(input);
    expect(parsed.success).toBe(true);
  });

  it("debe validar transiciones hacia ACTIVE y DISABLED", () => {
    expect(ChangeLifecycleSchema.safeParse({ newState: "ACTIVE" }).success).toBe(true);
    expect(ChangeLifecycleSchema.safeParse({ newState: "DISABLED" }).success).toBe(true);
  });

  it("debe rechazar estados no reconocidos en el ciclo de vida", () => {
    expect(ChangeLifecycleSchema.safeParse({ newState: "UNKNOWN_STATE" }).success).toBe(false);
  });

  it("debe validar el esquema de desincorporación exigiendo confirmationName no vacío", () => {
    expect(RetireServerSchema.safeParse({ confirmationName: "srv-prod-01" }).success).toBe(true);
    expect(RetireServerSchema.safeParse({ confirmationName: "" }).success).toBe(false);
  });
});

