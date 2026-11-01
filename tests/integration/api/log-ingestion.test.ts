import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { LogIngestionService } from "@/core/services/log-ingestion.service";
import { classifyLog } from "@/infrastructure/log/classifier";
import { sanitizeMessage } from "@/infrastructure/log/sanitizer";
import { IngestLogSchema } from "@/shared/validations/log.schema";

describe("LogIngestionService", () => {
  const mockUserId = "test-user-id";
  const mockServerId = "test-server-id";

  beforeEach(() => {
    // Setup: no hay base de datos real, los tests usan mocks implícitos
  });

  afterEach(() => {
    // Cleanup
  });

  it("debe clasificar un log de autenticación SSH en categoría AUTH_ACCESS", () => {
    const category = classifyLog(
      "Failed password for invalid user admin from 10.0.0.5 port 2222 ssh2",
      "Oct 29 10:00:01 sshd[1234]: Failed password for invalid user admin from 10.0.0.5 port 2222 ssh2"
    );
    expect(category).toBe("AUTH_ACCESS");
  });

  it("debe clasificar un log de seguridad en categoría SECURITY_AUDIT", () => {
    const category = classifyLog(
      "Security alert: intrusion detected from external IP",
      "ALERT: Security breach detected on interface eth0"
    );
    expect(category).toBe("SECURITY_AUDIT");
  });

  it("debe clasificar un log de base de datos en categoría DATABASE", () => {
    const category = classifyLog(
      "PostgreSQL connection pool exhausted, query timeout",
      "ERROR: database connection failed after 30s"
    );
    expect(category).toBe("DATABASE");
  });

  it("debe clasificar un log de aplicación web en categoría WEB_APP", () => {
    const category = classifyLog(
      "Nginx 500 error on endpoint /api/v1/users",
      "HTTP 500 Internal Server Error at /api/v1/users"
    );
    expect(category).toBe("WEB_APP");
  });

  it("debe devolver AGENT_ERROR como categoría por defecto cuando no hay coincidencia", () => {
    const category = classifyLog("unknown system message without patterns");
    expect(category).toBe("AGENT_ERROR");
  });
});

describe("Sanitizador de logs", () => {
  it("debe enmascarar contraseñas embebidas en el mensaje", () => {
    const { sanitized, hasSensitiveData } = sanitizeMessage(
      "Login failed for user admin with password=supersecret123"
    );
    expect(sanitized).not.toContain("supersecret123");
    expect(sanitized).toContain("[REDACTED]");
    expect(hasSensitiveData).toBe(true);
  });

  it("debe enmascarar claves privadas SSH", () => {
    const { sanitized } = sanitizeMessage(
      "-----BEGIN OPENSSH PRIVATE KEY-----\nAAAAB3NzaC1yc2EAAAADAQABAAABgQ...\n-----END OPENSSH PRIVATE KEY-----"
    );
    expect(sanitized).not.toContain("AAAAB3NzaC1yc2E");
    expect(sanitized).toContain("[REDACTED]");
  });

  it("no debe modificar mensajes sin datos sensibles", () => {
    const { sanitized, hasSensitiveData } = sanitizeMessage(
      "Server started successfully on port 8080"
    );
    expect(sanitized).toBe("Server started successfully on port 8080");
    expect(hasSensitiveData).toBe(false);
  });

  it("debe enmascarar direcciones de correo electrónico (PII)", () => {
    const { sanitized } = sanitizeMessage(
      "User john.doe@example.com attempted login"
    );
    expect(sanitized).not.toContain("john.doe@example.com");
    expect(sanitized).toContain("[REDACTED_EMAIL]");
  });

  it("debe enmascarar tokens JWT", () => {
    const { sanitized, hasSensitiveData } = sanitizeMessage(
      "Authorization header with token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
    );
    expect(sanitized).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(hasSensitiveData).toBe(true);
  });
});

describe("Validación de esquema de ingesta", () => {
  it("debe aceptar un evento de log válido", () => {
    const result = IngestLogSchema.safeParse({
      serverId: "550e8400-e29b-41d4-a716-446655440000",
      category: "AUTH_ACCESS",
      eventTimestamp: "2026-10-29T10:00:00Z",
      severity: "ERROR",
      message: "Failed login attempt",
    });
    expect(result.success).toBe(true);
  });

  it("debe rechazar un evento sin categoría válida", () => {
    const result = IngestLogSchema.safeParse({
      serverId: "550e8400-e29b-41d4-a716-446655440000",
      category: "INVALID_CATEGORY",
      eventTimestamp: "2026-10-29T10:00:00Z",
      severity: "ERROR",
      message: "Test message",
    });
    expect(result.success).toBe(false);
  });

  it("debe rechazar un evento sin mensaje", () => {
    const result = IngestLogSchema.safeParse({
      category: "AUTH_ACCESS",
      eventTimestamp: "2026-10-29T10:00:00Z",
      severity: "ERROR",
      message: "",
    });
    expect(result.success).toBe(false);
  });
});
