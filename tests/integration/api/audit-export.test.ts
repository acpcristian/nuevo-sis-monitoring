import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/infrastructure/db/prisma", () => ({
  prisma: {
    inventoryAuditLog: { findMany: vi.fn(), count: vi.fn() },
    user: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/infrastructure/db/prisma";
import { AuditService } from "@/core/services/audit.service";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "audit-1",
  timestamp: new Date("2026-11-03T10:00:00Z"),
  userId: "user-1",
  action: "LOGIN_FAILED",
  targetServerId: null,
  detailsDiff: { username: "admin" },
  ipAddress: "10.0.0.5",
  ...overrides,
});

describe("009 — Exportación del registro de auditoría", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve los eventos con el actor resuelto y sin paginación", async () => {
    vi.mocked(prisma.inventoryAuditLog.findMany).mockResolvedValue([
      row(),
      row({ id: "audit-2", userId: "anonimo" }),
    ] as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "user-1", username: "admin" },
    ] as never);

    const items = await AuditService.exportRows({});

    expect(items).toHaveLength(2);
    expect(items[0]?.actorUsername).toBe("admin");
    expect(items[1]?.actorUsername).toBeNull();
    expect(vi.mocked(prisma.inventoryAuditLog.findMany).mock.calls[0]?.[0]?.skip).toBeUndefined();
  });

  it("aplica los filtros y respeta el tope de filas", async () => {
    vi.mocked(prisma.inventoryAuditLog.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    const from = new Date("2026-11-01T00:00:00Z");
    const to = new Date("2026-11-03T23:59:59Z");
    await AuditService.exportRows({ action: "LOGIN_FAILED", userId: "user-1", from, to }, 5000);

    const args = vi.mocked(prisma.inventoryAuditLog.findMany).mock.calls[0]?.[0];
    expect(args?.where).toEqual({
      action: "LOGIN_FAILED",
      userId: "user-1",
      timestamp: { gte: from, lte: to },
    });
    expect(args?.take).toBe(5000);
    expect(args?.orderBy).toEqual({ timestamp: "desc" });
  });

  it("no consulta usuarios cuando no hay eventos", async () => {
    vi.mocked(prisma.inventoryAuditLog.findMany).mockResolvedValue([] as never);

    const items = await AuditService.exportRows({});

    expect(items).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("acota el tope al máximo absoluto de 10000 filas", async () => {
    vi.mocked(prisma.inventoryAuditLog.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    await AuditService.exportRows({}, 999999);

    expect(vi.mocked(prisma.inventoryAuditLog.findMany).mock.calls[0]?.[0]?.take).toBe(10000);
  });
});
