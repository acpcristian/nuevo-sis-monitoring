import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConflictError, ValidationError } from "@/shared/errors/domain-errors";

vi.mock("@/infrastructure/db/prisma", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/core/services/audit.service", () => ({
  AuditService: { recordEvent: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/core/services/auth.service", () => ({
  hashPassword: vi.fn(async (password: string) => `hashed:${password}`),
  verifyPassword: vi.fn(),
}));

import { prisma } from "@/infrastructure/db/prisma";
import { AuditService } from "@/core/services/audit.service";
import { verifyPassword } from "@/core/services/auth.service";
import { UserService } from "@/core/services/user.service";

const actor = { id: "actor-1", ipAddress: "10.0.0.5" };

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "user-1",
  username: "admin",
  displayName: "Administrador",
  role: "SUPERADMIN" as const,
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
  passwordHash: "scrypt$aa$bb",
  ...overrides,
});

describe("007 — Protecciones del servicio de usuarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("impide que un SUPERADMIN desactive su propia cuenta", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(row({ id: actor.id }) as never);

    await expect(UserService.update(actor.id, { isActive: false }, actor)).rejects.toThrow(
      ConflictError
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("impide que un SUPERADMIN cambie su propio rol", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(row({ id: actor.id }) as never);

    await expect(
      UserService.update(actor.id, { role: "OBSERVADOR" }, actor)
    ).rejects.toThrow(ConflictError);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("impide dejar la plataforma sin SUPERADMIN activo", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(row({ id: "user-2" }) as never);
    vi.mocked(prisma.user.count).mockResolvedValue(0);

    await expect(
      UserService.update("user-2", { role: "OBSERVADOR" }, actor)
    ).rejects.toThrow(ConflictError);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("permite degradar a un SUPERADMIN cuando existe otro activo y audita el cambio", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(row({ id: "user-2" }) as never);
    vi.mocked(prisma.user.count).mockResolvedValue(1);
    vi.mocked(prisma.user.update).mockResolvedValue(
      row({ id: "user-2", username: "segundo", role: "OBSERVADOR" }) as never
    );

    const updated = await UserService.update("user-2", { role: "OBSERVADOR" }, actor);

    expect(updated.role).toBe("OBSERVADOR");
    expect(JSON.stringify(updated)).not.toContain("password");
    expect(AuditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "USER_UPDATED", userId: actor.id })
    );
  });

  it("rechaza el cambio propio de contraseña si la actual no coincide", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(row({ id: actor.id }) as never);
    vi.mocked(verifyPassword).mockResolvedValue(false);

    await expect(
      UserService.changeOwnPassword(actor.id, "incorrecta", "NuevaClave2026", actor)
    ).rejects.toThrow(ValidationError);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rechaza reutilizar la contraseña actual", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(row({ id: actor.id }) as never);
    vi.mocked(verifyPassword).mockResolvedValue(true);

    await expect(
      UserService.changeOwnPassword(actor.id, "Actual2026ok", "Actual2026ok", actor)
    ).rejects.toThrow(ConflictError);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("rechaza crear un usuario duplicado", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(row() as never);

    await expect(
      UserService.create(
        { username: "admin", role: "OBSERVADOR", password: "Duplicado2026" },
        actor
      )
    ).rejects.toThrow(ConflictError);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("nunca proyecta el hash en el listado", async () => {
    vi.mocked(prisma.user.findMany).mockResolvedValue([row()] as never);

    const users = await UserService.list();

    expect(users).toHaveLength(1);
    expect(JSON.stringify(users)).not.toContain("scrypt$");
  });
});
