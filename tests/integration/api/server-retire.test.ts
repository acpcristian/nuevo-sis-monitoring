import { describe, it, expect } from "vitest";
import { RetireServerSchema } from "@/shared/validations/server.schema";

describe("Integración: Retiro Seguro de Servidores y Purgado de Credenciales (US4)", () => {
  it("debe exigir el nombre de confirmación exacto para permitir la desincorporación", () => {
    const invalidPayload = { confirmationName: "" };
    const validPayload = { confirmationName: "srv-prod-web-01" };

    expect(RetireServerSchema.safeParse(invalidPayload).success).toBe(false);
    expect(RetireServerSchema.safeParse(validPayload).success).toBe(true);
  });

  it("debe rechazar payloads que no contengan la propiedad de confirmación requerida", () => {
    const emptyPayload = {};
    expect(RetireServerSchema.safeParse(emptyPayload).success).toBe(false);
  });
});

