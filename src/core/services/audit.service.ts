import { prisma } from "@/infrastructure/db/prisma";
import type { Prisma } from "@prisma/client";
import type { AuditAction } from "@/core/domain/audit-actions";

export interface AuditEventParams {
  userId: string;
  action: AuditAction;
  targetServerId?: string | null;
  detailsDiff: Record<string, unknown>;
  ipAddress?: string | null;
}

export interface AuditListFilters {
  action?: AuditAction;
  userId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditListItem {
  id: string;
  timestamp: string;
  userId: string;
  actorUsername: string | null;
  action: string;
  targetServerId: string | null;
  detailsDiff: unknown;
  ipAddress: string | null;
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

  /**
   * Consulta paginada del registro de auditoría (solo lectura, solo SUPERADMIN).
   * `detailsDiff` ya está sanitizado en origen: nunca contiene secretos.
   */
  public static async list(filters: AuditListFilters): Promise<{
    items: AuditListItem[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
    const offset = Math.max(filters.offset ?? 0, 0);

    const where: Prisma.InventoryAuditLogWhereInput = {};
    if (filters.action) where.action = filters.action;
    if (filters.userId) where.userId = filters.userId;
    if (filters.from || filters.to) {
      where.timestamp = {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      };
    }

    const [rows, total] = await Promise.all([
      prisma.inventoryAuditLog.findMany({
        where,
        orderBy: { timestamp: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.inventoryAuditLog.count({ where }),
    ]);

    const actorIds = [...new Set(rows.map((row) => row.userId))];
    const actors =
      actorIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: actorIds } },
            select: { id: true, username: true },
          })
        : [];
    const actorNames = new Map(actors.map((actor) => [actor.id, actor.username]));

    return {
      items: rows.map((row) => ({
        id: row.id,
        timestamp: row.timestamp.toISOString(),
        userId: row.userId,
        actorUsername: actorNames.get(row.userId) ?? null,
        action: row.action,
        targetServerId: row.targetServerId,
        detailsDiff: row.detailsDiff,
        ipAddress: row.ipAddress,
      })),
      total,
      limit,
      offset,
    };
  }
}

