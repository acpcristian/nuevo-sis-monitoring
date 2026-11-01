import { describe, it, expect } from "vitest";
import { sanitizeMessage, sanitizeRawLog } from "@/infrastructure/log/sanitizer";

describe("Log Sanitizer", () => {
  it("enmascara contraseñas en mensajes de log", () => {
    const raw = "Failed login for user admin with password=secretPassword123 from 10.0.0.1";
    const result = sanitizeMessage(raw);

    expect(result.hasSensitiveData).toBe(true);
    expect(result.sanitized).not.toContain("secretPassword123");
    expect(result.sanitized).toContain("[REDACTED]");
  });

  it("enmascara API tokens y llaves secretas", () => {
    const raw = "Authorization token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
    const result = sanitizeMessage(raw);

    expect(result.hasSensitiveData).toBe(true);
    expect(result.sanitized).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    expect(result.sanitized).toContain("[REDACTED]");
  });

  it("enmascara tarjetas de crédito y PII", () => {
    const raw = "Payment processed for card 4532-1234-5678-9012";
    const result = sanitizeMessage(raw);

    expect(result.hasSensitiveData).toBe(true);
    expect(result.sanitized).not.toContain("4532-1234-5678-9012");
    expect(result.sanitized).toContain("[REDACTED_CARD]");
  });

  it("preserva mensajes sin información sensible", () => {
    const raw = "System reboot initiated by scheduled maintenance cron job";
    const result = sanitizeMessage(raw);

    expect(result.hasSensitiveData).toBe(false);
    expect(result.sanitized).toBe(raw);
  });

  it("sanitiza raw log preservando la inmutabilidad de la estructura", () => {
    const rawLog = JSON.stringify({
      user: "operator",
      key: "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...",
      status: "failed",
    });

    const sanitized = sanitizeRawLog(rawLog);

    expect(sanitized).not.toContain("ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...");
    expect(sanitized).toContain("[REDACTED]");
  });
});
