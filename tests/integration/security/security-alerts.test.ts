import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/infrastructure/db/prisma", () => ({
  prisma: {
    inventoryAuditLog: { count: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("@/core/services/notification.service", () => ({
  NotificationService: { sendNotification: vi.fn() },
}));

vi.mock("@/core/services/audit.service", () => ({
  AuditService: { recordEvent: vi.fn() },
}));

import { prisma } from "@/infrastructure/db/prisma";
import { NotificationService } from "@/core/services/notification.service";
import { AuditService } from "@/core/services/audit.service";
import {
  SecurityAlertService,
  LOGIN_FAILURE_THRESHOLD,
  LOGIN_FAILURE_WINDOW_MINUTES,
} from "@/core/services/security-alert.service";

describe("009 — Alertas de seguridad", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(NotificationService.sendNotification).mockResolvedValue([]);
    vi.mocked(AuditService.recordEvent).mockResolvedValue(undefined);
  });

  it("no alerta si los fallos de login están por debajo del umbral", async () => {
    vi.mocked(prisma.inventoryAuditLog.count).mockResolvedValue(LOGIN_FAILURE_THRESHOLD - 1);

    await SecurityAlertService.onLoginFailed({ username: "admin", ipAddress: "10.0.0.9" });

    expect(NotificationService.sendNotification).not.toHaveBeenCalled();
    expect(AuditService.recordEvent).not.toHaveBeenCalled();
  });

  it("alerta al alcanzar el umbral dentro de la ventana y audita el envío", async () => {
    vi.mocked(prisma.inventoryAuditLog.count).mockResolvedValue(LOGIN_FAILURE_THRESHOLD);

    await SecurityAlertService.onLoginFailed({ username: "admin", ipAddress: "10.0.0.9" });

    const countArgs = vi.mocked(prisma.inventoryAuditLog.count).mock.calls[0]?.[0];
    expect(countArgs?.where).toMatchObject({
      action: "LOGIN_FAILED",
      detailsDiff: { path: ["username"], equals: "admin" },
    });
    const since = (countArgs?.where?.timestamp as { gte?: Date } | undefined)?.gte;
    expect(since).toBeInstanceOf(Date);
    expect(Date.now() - (since as Date).getTime()).toBeGreaterThanOrEqual(
      LOGIN_FAILURE_WINDOW_MINUTES * 60 * 1000 - 5000
    );

    expect(NotificationService.sendNotification).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(NotificationService.sendNotification).mock.calls[0]?.[0];
    expect(payload?.severity).toBe("CRITICAL");
    expect(payload?.message).toContain("admin");
    expect(payload?.message).toContain(String(LOGIN_FAILURE_THRESHOLD));

    const audit = vi.mocked(AuditService.recordEvent).mock.calls[0]?.[0];
    expect(audit?.action).toBe("SECURITY_ALERT_SENT");
    expect(audit?.detailsDiff).toMatchObject({
      kind: "REPEATED_LOGIN_FAILURES",
      username: "admin",
      failures: LOGIN_FAILURE_THRESHOLD,
    });
  });

  it("no repite la alerta en fallos intermedios entre múltiplos del umbral", async () => {
    vi.mocked(prisma.inventoryAuditLog.count).mockResolvedValue(LOGIN_FAILURE_THRESHOLD + 1);

    await SecurityAlertService.onLoginFailed({ username: "admin" });

    expect(NotificationService.sendNotification).not.toHaveBeenCalled();
  });

  it("alerta de intento no autorizado con severidad alta y resuelve el username", async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ username: "observador" } as never);

    await SecurityAlertService.onUnauthorizedAttempt({
      userId: "user-obs",
      attemptedAction: "CREATE_SERVER",
      targetId: "server-1",
      ipAddress: "10.0.0.7",
    });

    expect(prisma.user.findUnique).toHaveBeenCalled();
    const payload = vi.mocked(NotificationService.sendNotification).mock.calls[0]?.[0];
    expect(payload?.severity).toBe("HIGH");
    expect(payload?.message).toContain("observador");
    expect(payload?.message).toContain("CREATE_SERVER");

    const audit = vi.mocked(AuditService.recordEvent).mock.calls[0]?.[0];
    expect(audit?.action).toBe("SECURITY_ALERT_SENT");
    expect(audit?.detailsDiff).toMatchObject({
      kind: "UNAUTHORIZED_ATTEMPT",
      attemptedAction: "CREATE_SERVER",
      targetId: "server-1",
    });
  });

  it("registra la alerta aunque no haya canales de notificación configurados", async () => {
    vi.mocked(prisma.inventoryAuditLog.count).mockResolvedValue(LOGIN_FAILURE_THRESHOLD);
    vi.mocked(NotificationService.sendNotification).mockResolvedValue([]);

    await SecurityAlertService.onLoginFailed({ username: "admin" });

    expect(AuditService.recordEvent).toHaveBeenCalledTimes(1);
    const audit = vi.mocked(AuditService.recordEvent).mock.calls[0]?.[0];
    expect(audit?.detailsDiff).toMatchObject({ channels: 0, delivered: 0 });
  });

  it("no propaga errores si el envío falla", async () => {
    vi.mocked(prisma.inventoryAuditLog.count).mockResolvedValue(LOGIN_FAILURE_THRESHOLD);
    vi.mocked(NotificationService.sendNotification).mockRejectedValue(new Error("SMTP caído"));

    await expect(
      SecurityAlertService.onLoginFailed({ username: "admin" })
    ).resolves.toBeUndefined();
  });
});
