import { describe, it, expect, vi, beforeEach } from "vitest";
import { RbacGuard, AuthenticatedUser } from "@/infrastructure/security/rbac-guard";
import { ForbiddenError } from "@/shared/errors/domain-errors";
import { AuditService } from "@/core/services/audit.service";

describe("Seguridad: Aislamiento RBAC y Protección de Rutas de Mutación (US3)", () => {
  beforeEach(() => {
    vi.spyOn(AuditService, "recordEvent").mockResolvedValue(undefined);
  });
  const observador: AuthenticatedUser = {
    id: "obs-user-1",
    role: "OBSERVADOR",
    ipAddress: "192.168.1.10",
  };

  const superadmin: AuthenticatedUser = {
    id: "admin-user-1",
    role: "SUPERADMIN",
    ipAddress: "192.168.1.5",
  };

  it("debe rechazar con ForbiddenError cuando un OBSERVADOR intenta cambiar el estado de ciclo de vida (PATCH /lifecycle)", async () => {
    await expect(
      RbacGuard.assertSuperAdmin(observador, "CHANGE_LIFECYCLE", "srv-123")
    ).rejects.toThrow(ForbiddenError);
  });

  it("debe rechazar con ForbiddenError cuando un OBSERVADOR intenta desincorporar un servidor (DELETE /servers)", async () => {
    await expect(
      RbacGuard.assertSuperAdmin(observador, "RETIRE_SERVER", "srv-123")
    ).rejects.toThrow(ForbiddenError);
  });

  it("debe rechazar con ForbiddenError cuando un OBSERVADOR intenta actualizar metadatos (PATCH /servers)", async () => {
    await expect(
      RbacGuard.assertSuperAdmin(observador, "UPDATE_SERVER", "srv-123")
    ).rejects.toThrow(ForbiddenError);
  });

  it("debe permitir las operaciones de mutación a usuarios con rol SUPERADMIN", async () => {
    await expect(
      RbacGuard.assertSuperAdmin(superadmin, "CHANGE_LIFECYCLE", "srv-123")
    ).resolves.toBeUndefined();

    await expect(
      RbacGuard.assertSuperAdmin(superadmin, "RETIRE_SERVER", "srv-123")
    ).resolves.toBeUndefined();
  });
});
