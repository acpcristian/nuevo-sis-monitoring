import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/infrastructure/db/prisma", () => ({
  prisma: {
    systemSetting: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock("@/core/services/audit.service", () => ({
  AuditService: { recordEvent: vi.fn() },
}));

import { prisma } from "@/infrastructure/db/prisma";
import { AuditService } from "@/core/services/audit.service";
import { ThemeService } from "@/core/services/theme.service";
import { DEFAULT_THEME } from "@/core/domain/theme";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "global",
  preset: "ocean",
  primaryColor: "#0284c7",
  mode: "dark",
  radius: 4,
  density: "compact",
  updatedBy: "user-1",
  createdAt: new Date("2026-11-01T10:00:00Z"),
  updatedAt: new Date("2026-11-03T10:00:00Z"),
  ...overrides,
});

describe("010 — Servicio de apariencia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuditService.recordEvent).mockResolvedValue(undefined);
  });

  it("devuelve el tema por defecto cuando no hay configuración guardada", async () => {
    vi.mocked(prisma.systemSetting.findUnique).mockResolvedValue(null);

    const record = await ThemeService.getThemeRecord();

    expect(record.theme).toEqual(DEFAULT_THEME);
    expect(record.updatedAt).toBeNull();
  });

  it("resuelve la configuración guardada", async () => {
    vi.mocked(prisma.systemSetting.findUnique).mockResolvedValue(row() as never);

    const record = await ThemeService.getThemeRecord();

    expect(record.theme).toMatchObject({
      preset: "ocean",
      primaryColor: "#0284c7",
      mode: "dark",
      radius: 4,
      density: "compact",
    });
    expect(record.updatedBy).toBe("user-1");
    expect(record.updatedAt).toBe("2026-11-03T10:00:00.000Z");
  });

  it("cae al tema por defecto si la BD falla (build o caída)", async () => {
    vi.mocked(prisma.systemSetting.findUnique).mockRejectedValue(new Error("BD caída"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    const theme = await ThemeService.getTheme();

    expect(theme).toEqual(DEFAULT_THEME);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("guarda el tema con upsert y audita antes/después", async () => {
    vi.mocked(prisma.systemSetting.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.systemSetting.upsert).mockResolvedValue(
      row({ preset: "emerald", primaryColor: "#059669", mode: "light", radius: 12, density: "comfortable" }) as never
    );

    const record = await ThemeService.updateTheme(
      { preset: "emerald", primaryColor: "#000000", mode: "light", radius: 12, density: "comfortable" },
      { id: "admin-1", ipAddress: "10.0.0.9" }
    );

    const upsertArgs = vi.mocked(prisma.systemSetting.upsert).mock.calls[0]?.[0];
    expect(upsertArgs?.create).toMatchObject({
      id: "global",
      preset: "emerald",
      primaryColor: "#059669",
      updatedBy: "admin-1",
    });

    expect(record.theme.preset).toBe("emerald");
    expect(record.theme.radius).toBe(12);

    const audit = vi.mocked(AuditService.recordEvent).mock.calls[0]?.[0];
    expect(audit?.action).toBe("THEME_UPDATED");
    expect(audit?.detailsDiff).toMatchObject({
      before: DEFAULT_THEME,
      after: { preset: "emerald", primaryColor: "#059669" },
    });
    expect(audit?.ipAddress).toBe("10.0.0.9");
  });
});
