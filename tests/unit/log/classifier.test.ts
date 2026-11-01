import { describe, it, expect } from "vitest";
import { classifyLog } from "@/infrastructure/log/classifier";

describe("Log Classifier", () => {
  it("clasifica eventos de SECURITY_AUDIT correctamente", () => {
    const log1 = classifyLog("Security alert: Brute force attack detected on port 22");
    expect(log1).toBe("SECURITY_AUDIT");

    const log2 = classifyLog("Failed password for invalid user admin from 192.168.1.100");
    expect(log2).toBe("SECURITY_AUDIT");
  });

  it("clasifica eventos de AUTH_ACCESS correctamente", () => {
    const log1 = classifyLog("pam_unix(sshd:session): session opened for user admin");
    expect(log1).toBe("AUTH_ACCESS");

    const log2 = classifyLog("User session closed for user operator");
    expect(log2).toBe("AUTH_ACCESS");
  });

  it("clasifica eventos de SSH_NETWORK correctamente", () => {
    const log1 = classifyLog("Connection refused on port 22 for host remote.local");
    expect(log1).toBe("SSH_NETWORK");

    const log2 = classifyLog("DNS resolution error for host server.internal");
    expect(log2).toBe("SSH_NETWORK");
  });

  it("clasifica eventos de DATABASE correctamente", () => {
    const log1 = classifyLog("PostgreSQL deadlock detected on transaction 1042");
    expect(log1).toBe("DATABASE");

    const log2 = classifyLog("SQL query execution timeout in database app_prod");
    expect(log2).toBe("DATABASE");
  });

  it("clasifica eventos de WEB_APP correctamente", () => {
    const log1 = classifyLog("nginx: 502 Bad Gateway response from upstream");
    expect(log1).toBe("WEB_APP");

    const log2 = classifyLog("HTTP GET /api/v1/data returned status 500");
    expect(log2).toBe("WEB_APP");
  });

  it("clasifica eventos de SYS_KERNEL correctamente", () => {
    const log1 = classifyLog("Kernel panic - not syncing: Fatal exception in interrupt");
    expect(log1).toBe("SYS_KERNEL");

    const log2 = classifyLog("Out of memory: Kill process 1234 (node) score 850");
    expect(log2).toBe("SYS_KERNEL");
  });

  it("clasifica eventos de SYSTEM_SERVICE correctamente", () => {
    const log1 = classifyLog("systemd[1]: Service nginx.service failed with exit code 1");
    expect(log1).toBe("SYSTEM_SERVICE");

    const log2 = classifyLog("Daemon cron restarted unexpectedly");
    expect(log2).toBe("SYSTEM_SERVICE");
  });

  it("clasifica eventos de STORAGE_HW correctamente", () => {
    const log1 = classifyLog("Filesystem error: No space left on device /dev/sda1");
    expect(log1).toBe("STORAGE_HW");

    const log2 = classifyLog("Disk I/O error on bad block sector 4096");
    expect(log2).toBe("STORAGE_HW");
  });

  it("clasifica eventos de BACKUP_TASK correctamente", () => {
    const log1 = classifyLog("Backup completed successfully for volume /data");
    expect(log1).toBe("BACKUP_TASK");

    const log2 = classifyLog("Snapshot restore failed due to corrupted archive");
    expect(log2).toBe("BACKUP_TASK");
  });

  it("clasifica eventos de AGENT_ERROR por defecto o cuando se refieren a telemetría/agente", () => {
    const log1 = classifyLog("Telemetry collector agent disconnected");
    expect(log1).toBe("AGENT_ERROR");

    const log2 = classifyLog("Unrecognized log message with no matching keywords");
    expect(log2).toBe("AGENT_ERROR");
  });
});
