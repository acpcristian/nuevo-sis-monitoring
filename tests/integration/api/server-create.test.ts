import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateServerSchema } from "@/shared/validations/server.schema";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { ForbiddenError } from "@/shared/errors/domain-errors";
import { AuditService } from "@/core/services/audit.service";

describe("Integración: Alta de Servidores y Validación de Seguridad (US1)", () => {
  beforeEach(() => {
    vi.spyOn(AuditService, "recordEvent").mockResolvedValue(undefined);
  });
  it("debe rechazar nombres de servidor que no cumplan con el formato seguro", () => {
    const invalidInput = {
      name: "servidor con espacios!",
      ipAddress: "192.168.1.50",
      osType: "LINUX",
      environment: "PROD",
    };

    const result = CreateServerSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  it("debe validar correctamente un payload completo con clave SSH para Linux", () => {
    const validInput = {
      name: "srv-linux-prod-01",
      ipAddress: "10.0.0.15",
      hostname: "web01.corp.internal",
      osType: "LINUX",
      osVersion: "Ubuntu 24.04",
      environment: "PROD",
      connectionPort: 22,
      technicalOwner: "Equipo DevOps",
      credential: {
        credentialType: "SSH_KEY",
        username: "mon-user",
        secretValue: "-----BEGIN OPENSSH PRIVATE KEY-----\ntest\n-----END OPENSSH PRIVATE KEY-----",
      },
      tags: [{ key: "env", value: "production" }],
    };

    const result = CreateServerSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("debe bloquear con ForbiddenError a usuarios con rol OBSERVADOR al intentar crear un servidor (Principio IV)", async () => {
    const observerUser = {
      id: "usr-observer-1",
      role: "OBSERVADOR" as const,
      ipAddress: "127.0.0.1",
    };

    await expect(
      RbacGuard.assertSuperAdmin(observerUser, "CREATE_SERVER")
    ).rejects.toThrow(ForbiddenError);
  });

  it("debe permitir la acción si el usuario posee rol SUPERADMIN", async () => {
    const adminUser = {
      id: "usr-admin-1",
      role: "SUPERADMIN" as const,
      ipAddress: "127.0.0.1",
    };

    await expect(
      RbacGuard.assertSuperAdmin(adminUser, "CREATE_SERVER")
    ).resolves.toBeUndefined();
  });
});
