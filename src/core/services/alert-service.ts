import { prisma } from "@/infrastructure/db/prisma";
import { AuditService } from "@/core/services/audit.service";
import { recordAlertPattern, getCategoryInfo } from "@/infrastructure/log/alert-engine";
import type { AlertPatternInput } from "@/infrastructure/log/alert-engine";
import { NotFoundError } from "@/shared/errors/domain-errors";

export interface AlertFilters {
  serverId?: string;
  status?: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  page?: number;
  limit?: number;
}

export class AlertService {
  /**
   * Lista alertas de log deduplicadas con paginación y filtros.
   * Accesible por SUPERADMIN y OBSERVADOR (consulta solo lectura).
   */
  public static async listAlerts(params?: AlertFilters) {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(100, Math.max(1, params?.limit || 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (params?.serverId) {
      where.serverId = params.serverId;
    }
    if (params?.status) {
      where.status = params.status;
    }

    const [total, items] = await Promise.all([
      prisma.logAlert.count({ where }),
      prisma.logAlert.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ windowStart: "desc" }],
        include: {
          server: { select: { id: true, name: true } },
          // category is an enum field, not a relation
        },
      }),
    ]);

    return {
      items: items.map((a) => ({
        id: a.id,
        serverId: a.serverId,
        serverName: a.server?.name ?? null,
        category: a.category ?? null,
        categoryName: a.category ? getCategoryInfo(a.category).name : null,
        patternType: a.patternType,
        eventCount: a.eventCount,
        windowStart: a.windowStart,
        windowEnd: a.windowEnd,
        severity: a.severity as "INFO" | "WARN" | "ERROR" | "CRITICAL",
        status: a.status as "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED",
        acknowledgedBy: a.acknowledgedBy,
        acknowledgedAt: a.acknowledgedAt,
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Reconoce una alerta (ACK). Solo SUPERADMIN.
   */
  public static async acknowledgeAlert(
    id: string,
    userId: string,
    userIp?: string
  ) {
    const alert = await prisma.logAlert.findUnique({ where: { id } });
    if (!alert) {
      throw new NotFoundError("Alerta");
    }

    const updated = await prisma.logAlert.update({
      where: { id },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
    });

    await AuditService.recordEvent({
      userId,
      action: "LOG_ALERT_ACKNOWLEDGED",
      targetServerId: updated.serverId ?? undefined,
      detailsDiff: {
        alertId: id,
        patternType: alert.patternType,
        previousStatus: alert.status,
        newStatus: "ACKNOWLEDGED",
      },
      ipAddress: userIp,
    });

    return {
      id: updated.id,
      status: updated.status as "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED",
      acknowledgedBy: updated.acknowledgedBy,
      acknowledgedAt: updated.acknowledgedAt,
    };
  }

  /**
   * Resuelve una alerta. Solo SUPERADMIN.
   */
  public static async resolveAlert(id: string, userId: string, userIp?: string) {
    const alert = await prisma.logAlert.findUnique({ where: { id } });
    if (!alert) {
      throw new NotFoundError("Alerta");
    }

    const updated = await prisma.logAlert.update({
      where: { id },
      data: {
        status: "RESOLVED",
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
    });

    await AuditService.recordEvent({
      userId,
      action: "LOG_ALERT_RESOLVED",
      targetServerId: updated.serverId ?? undefined,
      detailsDiff: {
        alertId: id,
        patternType: alert.patternType,
        previousStatus: alert.status,
        newStatus: "RESOLVED",
      },
      ipAddress: userIp,
    });

    return {
      id: updated.id,
      status: updated.status as "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED",
      acknowledgedBy: updated.acknowledgedBy,
      acknowledgedAt: updated.acknowledgedAt,
    };
  }

  /**
   * Registra un patrón anómalo proveniente del motor de ingesta.
   * Usado por LogIngestionService cuando se detecta un burst de errores.
   */
  public static async recordPattern(
    input: AlertPatternInput,
    userId: string,
    userIp?: string
  ) {
    return recordAlertPattern(input, userId, userIp);
  }
}