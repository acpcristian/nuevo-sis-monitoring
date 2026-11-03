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
  action: "USER_CREATED",
  targetServerId: null,
  detailsDiff: { username: "nuevo", role: "OBSERVADOR" },
  ipAddress: "10.0.0.5",
  ...overrides,
});

describe("008 — Consulta del registro de auditoría", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve eventos con el nombre del actor resuelto", async () => {
    vi.mocked(prisma.inventoryAuditLog.findMany).mockResolvedValue([row()] as never);
    vi.mocked(prisma.inventoryAuditLog.count).mockResolvedValue(1);
    vi.mocked(prisma.user.findMany).mockResolvedValue([
      { id: "user-1", username: "admin" },
    ] as never);

    const result = await AuditService.list({});

    expect(result.total).toBe(1);
    expect(result.items[0]?.actorUsername).toBe("admin");
    expect(result.items[0]?.action).toBe("USER_CREATED");
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(0);
  });

  it("aplica filtros de acción, actor y rango de fechas", async () => {
    vi.mocked(prisma.inventoryAuditLog.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.inventoryAuditLog.count).mockResolvedValue(0);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    const from = new Date("2026-11-01T00:00:00Z");
    const to = new Date("2026-11-03T23:59:59Z");
    await AuditService.list({ action: "LOGIN_FAILED", userId: "user-9", from, to });

    const where = vi.mocked(prisma.inventoryAuditLog.findMany).mock.calls[0]?.[0]?.where;
    expect(where).toEqual({
      action: "LOGIN_FAILED",
      userId: "user-9",
      timestamp: { gte: from, lte: to },
    });
  });

  it("acota el límite a 200 y normaliza offsets negativos", async () => {
    vi.mocked(prisma.inventoryAuditLog.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.inventoryAuditLog.count).mockResolvedValue(0);
    vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);

    const result = await AuditService.list({ limit: 9999, offset: -5 });

    expect(result.limit).toBe(200);
    expect(result.offset).toBe(0);
    expect(vi.mocked(prisma.inventoryAuditLog.findMany).mock.calls[0]?.[0]?.take).toBe(200);
    expect(vi.mocked(prisma.inventoryAuditLog.findMany).mock.calls[0]?.[0]?.skip).toBe(0);
  });

  it("no consulta usuarios si no hay eventos", async () => {
    vi.mocked(prisma.inventoryAuditLog.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.inventoryAuditLog.count).mockResolvedValue(0);

    await AuditService.list({});

    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});
