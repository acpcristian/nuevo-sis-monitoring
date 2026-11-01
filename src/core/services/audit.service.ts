import { prisma } from "@/infrastructure/db/prisma";
import type { Prisma } from "@prisma/client";

export interface AuditEventParams {
  userId: string;
  action:
    | "SERVER_CREATED"
    | "METADATA_UPDATED"
    | "STATUS_CHANGED"
    | "SERVER_RETIRED"
    | "UNAUTHORIZED_ATTEMPT"
    | "LOG_INGESTED"
    | "DIAGNOSIS_CREATED"
    | "LOG_ALERT_CREATED"
    | "LOG_ALERT_MERGED"
    | "LOG_ALERT_ACKNOWLEDGED"
    | "LOG_ALERT_RESOLVED"
    // — 003 Incident Management —
    | "INCIDENT_CREATED"
    | "INCIDENT_ASSIGNED"
    | "INCIDENT_ESCALATED"
    | "INCIDENT_RESOLVED"
    | "INCIDENT_CLOSED"
    | "INCIDENT_STATUS_CHANGED"
    // — 004 Notificaciones —
    | "CHANNEL_CREATED"
    | "CHANNEL_UPDATED"
    | "CHANNEL_DELETED"
    | "CHANNEL_TESTED"
    | "NOTIFICATION_SENT"
    | "NOTIFICATION_FAILED"
    | "NOTIFICATION_RETRY_SCHEDULED"
    | "NOTIFICATION_RETRY_PROCESSED"
    // — 005 Dashboards —
    | "REPORT_EXPORTED"
    // — 006 Automatización —
    | "PLAYBOOK_CREATED"
    | "PLAYBOOK_UPDATED"
    | "PLAYBOOK_DELETED"
    | "PLAYBOOK_EXECUTED"
    | "PLAYBOOK_FAILED"
    // — Autenticación —
    | "LOGIN_SUCCESS"
    | "LOGIN_FAILED"
    | "USER_CREATED"
    | "USER_UPDATED";
  targetServerId?: string | null;
  detailsDiff: Record<string, unknown>;
  ipAddress?: string | null;
}

export class AuditService {
  /**
   * Sanitiza cualquier campo sospechoso de contener credenciales o secretos
   * antes de persistir el diff en la base de datos (Principio VI).
   */
  private static sanitizeDiff(details: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = [
      "secret",
      "password",
      "key",
      "secret_value",
      "private_key",
      "token",
      "passphrase",
      "encrypted_payload",
    ];

    const sanitized: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(details)) {
      const lowerKey = k.toLowerCase();
      if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
        sanitized[k] = "[REDACTED_SECRET]";
      } else if (v && typeof v === "object" && !Array.isArray(v)) {
        sanitized[k] = this.sanitizeDiff(v as Record<string, unknown>);
      } else {
        sanitized[k] = v;
      }
    }

    return sanitized;
  }

  /**
   * Registra un evento inmutable en el log de auditoría.
   */
  public static async recordEvent(params: AuditEventParams): Promise<void> {
    const safeDiff = this.sanitizeDiff(params.detailsDiff);
    await prisma.inventoryAuditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        targetServerId: params.targetServerId ?? undefined,
        detailsDiff: safeDiff as Prisma.InputJsonValue,
        ipAddress: params.ipAddress ?? undefined,
      },
    });
  }
}

