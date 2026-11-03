import { describe, it, expect } from "vitest";
import { createSessionToken, verifySessionToken } from "@/infrastructure/security/session";

describe("008 — Token de sesión con versión (sv)", () => {
  it("firma y verifica un token incluyendo la versión de sesión", () => {
    const token = createSessionToken("user-1", "admin", "SUPERADMIN", 3);
    const payload = verifySessionToken(token);

    expect(payload).not.toBeNull();
    expect(payload?.uid).toBe("user-1");
    expect(payload?.role).toBe("SUPERADMIN");
    expect(payload?.sv).toBe(3);
  });

  it("rechaza un token con la firma manipulada", () => {
    const token = createSessionToken("user-1", "admin", "SUPERADMIN", 0);
    const [body] = token.split(".");
    expect(verifySessionToken(`${body}.firma-invalida`)).toBeNull();
  });

  it("rechaza un token expirado", () => {
    const nineHoursAgo = Date.now() - 9 * 60 * 60 * 1000;
    const token = createSessionToken("user-1", "admin", "SUPERADMIN", 0, nineHoursAgo);
    expect(verifySessionToken(token)).toBeNull();
  });

  it("rechaza tokens ausentes o mal formados", () => {
    expect(verifySessionToken(undefined)).toBeNull();
    expect(verifySessionToken("")).toBeNull();
    expect(verifySessionToken("sin-punto")).toBeNull();
  });
});
