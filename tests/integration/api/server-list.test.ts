import { describe, it, expect } from "vitest";
import { ServerPresenter, RawServerWithRelations } from "@/core/services/server-presenter";

describe("Integración: Sanitización de Credenciales y Consulta Segura (US2)", () => {
  const mockServerWithSecrets: RawServerWithRelations = {
    id: "srv-uuid-1234",
    name: "srv-prod-db-01",
    ipAddress: "10.0.1.15",
    hostname: "db01.internal",
    osType: "LINUX",
    osVersion: "Debian 12",
    environment: "PROD",
    connectionPort: 22,
    technicalOwner: "DBA Team",
    description: "Servidor de base de datos principal",
    lifecycleState: "ACTIVE",
    healthStatus: "ONLINE",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastCheckedAt: new Date(),
    lastSeenAt: new Date(),
    credential: {
      credentialType: "SSH_KEY",
      username: "mon-user",
      keyFingerprint: "SHA256:abcd1234ef567890...12345678",
      rotatedAt: new Date(),
    },
    tags: [{ tag: { key: "cluster", value: "primary" } }],
  };

  it("debe garantizar que NINGÚN secreto cifrado (payload, iv, authTag) sea expuesto en el DTO para rol OBSERVADOR", () => {
    const dto = ServerPresenter.toDto(mockServerWithSecrets, "OBSERVADOR");

    expect(dto).toBeDefined();
    expect(dto.name).toBe("srv-prod-db-01");
    expect(dto.hasCredential).toBe(true);

    // Verificar que los campos sensibles no existen en el objeto
    expect(dto).not.toHaveProperty("encryptedPayload");
    expect(dto).not.toHaveProperty("iv");
    expect(dto).not.toHaveProperty("authTag");
    expect(dto).not.toHaveProperty("secretValue");

    // Verificar estructura no sensible expuesta
    expect(dto.credentialSummary).toEqual({
      type: "SSH_KEY",
      username: "mon-user",
      keyFingerprint: "SHA256:abcd1234ef567890...12345678",
      lastRotatedAt: expect.any(Date),
    });
  });

  it("debe garantizar que NINGÚN secreto cifrado sea expuesto en el DTO para rol SUPERADMIN", () => {
    const dto = ServerPresenter.toDto(mockServerWithSecrets, "SUPERADMIN");

    expect(dto).not.toHaveProperty("encryptedPayload");
    expect(dto).not.toHaveProperty("iv");
    expect(dto).not.toHaveProperty("authTag");
    expect(dto).not.toHaveProperty("secretValue");
  });

  it("debe mapear correctamente servidores sin credencial configurada", () => {
    const mockWithoutCreds = {
      ...mockServerWithSecrets,
      id: "srv-2",
      credential: null,
    };

    const dto = ServerPresenter.toDto(mockWithoutCreds, "OBSERVADOR");
    expect(dto.hasCredential).toBe(false);
    expect(dto.credentialSummary).toBeNull();
  });
});

