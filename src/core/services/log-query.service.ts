import { prisma } from "@/infrastructure/db/prisma";
import { NotFoundError } from "@/shared/errors/domain-errors";
import {
  LogCategory,
  LogSeverity,
  FreshnessState,
} from "@/core/domain/log.types";

export interface ListLogEventsParams {
  serverId?: string;
  category?: LogCategory;
  severity?: LogSeverity;
  from?: Date;
  to?: Date;
  search?: string | null;
  page?: number;
  limit?: number;
}

export interface LogEventWithRelations {
  id: string;
  serverId: string | null;
  serverName: string | null;
  category: LogCategory;
  eventTimestamp: Date;
  ingestionTimestamp: Date;
  processedTimestamp: Date | null;
  eventType: string | null;
  severity: LogSeverity;
  sanitizedMessage: string;
  rawLog: string;
  metadata: Record<string, unknown> | null;
  isUntrusted: boolean;
}

export class LogQueryService {
  /**
   * Consulta eventos de log con filtros multifactoriales indexados y paginación.
   * SC-002: Filtrado en menos de 2 segundos sobre 100,000 registros.
   */
  public static async listLogEvents(params: ListLogEventsParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (params.serverId) {
      where.serverId = params.serverId;
    }
    if (params.category) {
      where.category = params.category;
    }
    if (params.severity) {
      where.severity = params.severity;
    }

    if (params.from || params.to) {
      where.eventTimestamp = {};
      if (params.from) {
        (where.eventTimestamp as Record<string, unknown>).gte = params.from;
      }
      if (params.to) {
        (where.eventTimestamp as Record<string, unknown>).lte = params.to;
      }
    }

    if (params.search && params.search.trim().length > 0) {
      const query = params.search.trim();
      where.OR = [
        { sanitizedMessage: { contains: query, mode: "insensitive" } },
        { eventType: { contains: query, mode: "insensitive" } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.logEvent.count({ where }),
      prisma.logEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ eventTimestamp: "desc" }, { ingestionTimestamp: "desc" }],
        include: {
          server: {
            select: { id: true, name: true },
          },
          category: {
            select: { code: true, name: true },
          },
        },
      }),
    ]);

    const mappedItems: LogEventWithRelations[] = items.map((item) => ({
      id: item.id,
      serverId: item.serverId,
      serverName: item.server?.name ?? null,
      category: item.category.code as LogCategory,
      eventTimestamp: item.eventTimestamp,
      ingestionTimestamp: item.ingestionTimestamp,
      processedTimestamp: item.processedTimestamp,
      eventType: item.eventType,
      severity: item.severity as LogSeverity,
      sanitizedMessage: item.sanitizedMessage,
      rawLog: item.rawLog,
      metadata: (item.metadata as Record<string, unknown> | null) ?? null,
      isUntrusted: item.isUntrusted,
    }));

    return {
      items: mappedItems,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Obtiene el detalle completo de un evento de log específico.
   */
  public static async getLogEventById(id: string) {
    const event = await prisma.logEvent.findUnique({
      where: { id },
      include: {
        server: {
          select: { id: true, name: true, ipAddress: true },
        },
        category: {
          select: { code: true, name: true },
        },
      },
    });

    if (!event) {
      throw new NotFoundError("Evento de log");
    }

    return {
      id: event.id,
      serverId: event.serverId,
      serverName: event.server?.name ?? null,
      serverIp: event.server?.ipAddress ?? null,
      category: event.category.code as LogCategory,
      eventTimestamp: event.eventTimestamp,
      ingestionTimestamp: event.ingestionTimestamp,
      processedTimestamp: event.processedTimestamp,
      eventType: event.eventType,
      severity: event.severity as LogSeverity,
      sanitizedMessage: event.sanitizedMessage,
      rawLog: event.rawLog,
      metadata: (event.metadata as Record<string, unknown> | null) ?? null,
      isUntrusted: event.isUntrusted,
    };
  }

  /**
   * Consulta estados de frescura de datos por servidor.
   */
  public static async listDataFreshnessStates(params?: {
    serverId?: string;
    state?: FreshnessState;
  }) {
    const where: Record<string, unknown> = {};

    if (params?.serverId) {
      where.serverId = params.serverId;
    }
    if (params?.state) {
      where.freshnessState = params.state;
    }

    const items = await prisma.dataFreshnessState.findMany({
      where,
      include: {
        server: {
          select: { id: true, name: true, ipAddress: true },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
    });

    return items.map((item) => ({
      id: item.id,
      serverId: item.serverId,
      serverName: item.server?.name ?? null,
      serverIp: item.server?.ipAddress ?? null,
      freshnessState: item.freshnessState as FreshnessState,
      lastTelemetryAt: item.lastTelemetryAt,
      updatedAt: item.updatedAt,
    }));
  }
}
