import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { UnauthorizedError } from "@/shared/errors/domain-errors";

vi.mock("@/infrastructure/db/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

import { prisma } from "@/infrastructure/db/prisma";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { createSessionToken, SESSION_COOKIE } from "@/infrastructure/security/session";

function requestWithSession(token?: string): NextRequest {
  const headers = token ? { cookie: `${SESSION_COOKIE}=${token}` } : undefined;
  return new NextRequest("http://localhost/api/v1/servers", { headers });
}

describe("008 — Revalidación de sesión contra la base de datos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("acepta una sesión vigente y toma el rol actual de la base de datos", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      role: "OBSERVADOR",
      isActive: true,
      sessionVersion: 2,
    } as never);

    // El token dice SUPERADMIN, pero la BD dice OBSERVADOR: debe imponerse la BD.
    const token = createSessionToken("user-1", "admin", "SUPERADMIN", 2);
    const user = await RbacGuard.extractUser(requestWithSession(token));

    expect(user.id).toBe("user-1");
    expect(user.role).toBe("OBSERVADOR");
  });

  it("rechaza la sesión cuando la versión de sesión cambió (reset de contraseña)", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      role: "SUPERADMIN",
      isActive: true,
      sessionVersion: 3,
    } as never);

    const token = createSessionToken("user-1", "admin", "SUPERADMIN", 2);
    await expect(RbacGuard.extractUser(requestWithSession(token))).rejects.toThrow(
      UnauthorizedError
    );
  });

  it("rechaza la sesión de una cuenta desactivada", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: "user-1",
      role: "SUPERADMIN",
      isActive: false,
      sessionVersion: 0,
    } as never);

    const token = createSessionToken("user-1", "admin", "SUPERADMIN", 0);
    await expect(RbacGuard.extractUser(requestWithSession(token))).rejects.toThrow(
      UnauthorizedError
    );
  });

  it("rechaza la sesión si el usuario ya no existe", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

    const token = createSessionToken("user-borrado", "fantasma", "OBSERVADOR", 0);
    await expect(RbacGuard.extractUser(requestWithSession(token))).rejects.toThrow(
      UnauthorizedError
    );
  });

  it("mantiene el fallback por header para pruebas e integraciones", async () => {
    const request = new NextRequest("http://localhost/api/v1/servers", {
      headers: { "x-user-role": "OBSERVADOR", "x-user-id": "test-user" },
    });

    const user = await RbacGuard.extractUser(request);
    expect(user.role).toBe("OBSERVADOR");
    expect(user.id).toBe("test-user");
  });

  it("rechaza peticiones sin cookie ni headers de autenticación", async () => {
    await expect(RbacGuard.extractUser(requestWithSession())).rejects.toThrow(UnauthorizedError);
  });
});
