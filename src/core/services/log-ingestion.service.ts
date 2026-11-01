import { prisma } from "@/infrastructure/db/prisma";
import { NotFoundError } from "@/shared/errors/domain-errors";
import type { Prisma } from "@prisma/client";
import { classifyLog, sanitizeMessage, containsSensitiveData } from "@/infrastructure/log";
import { AuditService } from "@/core/services/audit.service";
import { LogCategory, LogSeverity, FreshnessState, ConfidenceLevel } from "@/core/domain/log.types";

export interface IngestLogInput {
  serverId?: string;
  category?: LogCategory;
  eventTimestamp: Date;
  eventType?: string | null;
  severity?: LogSeverity;
  message: string;
  rawLog?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface IngestLogResult {
  eventId: string;
  category: LogCategory;
  sanitizedMessage: string;
  hasSensitiveData: boolean;
  dataFreshnessUpdated: boolean;
}

/**
 * Servicio de ingesta de logs que coordina:
 * 1. Clasificación automática en 10 categorías prioritarias
 * 2. Sanitización de datos sensibles antes del almacenamiento
 * 3. Persistencia del evento con marcas temporales
 * 4. Actualización del estado de frescura del servidor
 * 5. Registro de auditoría
 */
export class LogIngestionService {
  /**
   * Ingiere un evento de log, clasificándolo y sanitizándolo automáticamente.
   */
  public static async ingestLog(
    input: IngestLogInput,
    userId: string,
    ipAddress?: string | null
  ): Promise<IngestLogResult> {
    const { serverId, category, eventTimestamp, eventType, severity, message, rawLog, metadata } = input;

    // 1. Clasificar automáticamente si no se proporciona categoría
    const resolvedCategory = category ?? classifyLog(message, rawLog);

    // 2. Sanitizar el mensaje (enmascarar datos sensibles)
    const { sanitized, hasSensitiveData } = sanitizeMessage(message);

    // 3. Garantizar la fila de categoría (taxonomía idempotente)
    const categoryModel = await prisma.logCategoryModel.upsert({
      where: { code: resolvedCategory },
      create: { code: resolvedCategory, name: resolvedCategory },
      update: {},
    });

    // 3. Persistir el evento de log (rawLog append-only; nunca vacío)
    const event = await prisma.logEvent.create({
      data: {
        serverId: serverId ?? null,
        categoryId: categoryModel.id,
        eventTimestamp,
        eventType,
        severity: severity ?? "INFO",
        sanitizedMessage: sanitized,
        rawLog: rawLog ?? message,
        metadata: (metadata ?? undefined) as unknown as Prisma.InputJsonValue,
        isUntrusted: containsSensitiveData(message) || hasSensitiveData,
      },
      include: {
        server: {
          select: { id: true, name: true, ipAddress: true },
        },
        category: {
          select: { code: true, name: true },
        },
      },
    });

    // 4. Actualizar estado de frescura del servidor
    if (serverId) { await this.updateServerFreshness(serverId, eventTimestamp); }

    // 5. Registrar en auditoría
    await AuditService.recordEvent({
      userId,
      action: "LOG_INGESTED",
      targetServerId: serverId,
      detailsDiff: {
        category: resolvedCategory,
        severity: event.severity,
        hasSensitiveData,
      },
      ipAddress: ipAddress ?? null,
    });

    return {
      eventId: event.id,
      category: resolvedCategory,
      sanitizedMessage: event.sanitizedMessage,
      hasSensitiveData,
      dataFreshnessUpdated: true,
    };  }

  /**
   * Actualiza el estado de frescura basado en la última telemetría recibida.
   */
  private static async updateServerFreshness(serverId: string, lastTelemetry: Date) {
    // Verificar si ya existe un registro de frescura
    const existing = await prisma.dataFreshnessState.findUnique({
      where: { serverId },
    });

    const now = new Date();

    if (existing) {
      // Actualizar estado existente
      await prisma.dataFreshnessState.update({
        where: { serverId },
        data: {
          freshnessState: this.determineFreshnessState(lastTelemetry, now),
          lastTelemetryAt: lastTelemetry,
          updatedAt: now,
        },
      });
    } else {
      // Crear nuevo registro
      await prisma.dataFreshnessState.create({
        data: {
          serverId,
          freshnessState: this.determineFreshnessState(lastTelemetry, now),
          lastTelemetryAt: lastTelemetry,
          updatedAt: now,
        },
      });
    }
  }

  /**
   * Determina el estado de frescura basado en la última telemetría.
   */
  private static determineFreshnessState(lastTelemetry: Date, now: Date): FreshnessState {
    const diffMinutes = (now.getTime() - lastTelemetry.getTime()) / (1000 * 60);

    // Si fue hace menos de 5 minutos: FRESH
    if (diffMinutes < 5) {
      return "FRESH";
    }
    // Si fue hace entre 5 y 30 minutos: STALE
    if (diffMinutes < 30) {
      return "STALE";
    }
    // Si fue hace entre 30 minutos y 4 horas: AGENT_DISCONNECTED
    if (diffMinutes < 240) {
      return "AGENT_DISCONNECTED";
    }
    // Si fue hace más de 4 horas: UNREACHABLE
    return "UNREACHABLE";
  }
}