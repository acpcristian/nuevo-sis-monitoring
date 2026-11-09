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
  /** Mostrar también eventos sin servidor asignado (auditoría/depuración). */
  includeUnassigned?: boolean;
  /** Mostrar también logs de servidores retirados del inventario. */
  includeRetired?: boolean;
}

export interface LogEventWithRelations {
  id: string;
  serverId: string | null;
  serverName: string | null;
  /** Información adicional del servidor cargada en el inventario. */
  serverIp: string | null;
  serverEnvironment: string | null;
  serverHealth: string | null;
  serverOs: string | null;
  serverDescription: string | null;
  serverOwner: string | null;
  serverLastSeenAt: string | null;
  serverTags: Array<{ key: string; value: string }>;
  serverServices: Array<{ id: string; name: string; status: string }>;
  serviceId: string | null;
  serviceName: string | null;
  serviceStatus: string | null;
  category: LogCategory;
  categoryName: string;
  categoryDescription: string | null;
  categoryCommonCauses: string | null;
  categorySolutions: string | null;
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
    } else if (!params.includeUnassigned && !params.includeRetired) {
      // Solo logs de servidores vigentes del inventario: oculta eventos sin
      // servidor asignado (típicamente ingesta de prueba) y servidores retirados.
      where.server = { lifecycleState: { not: "RETIRED" } };
    } else if (params.includeUnassigned && !params.includeRetired) {
      where.server = { lifecycleState: { not: "RETIRED" } };
      where.OR = [{ server: { is: { lifecycleState: { not: "RETIRED" } } } }, { serverId: null }];
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
            select: {
              id: true,
              name: true,
              ipAddress: true,
              environment: true,
              healthStatus: true,
              osType: true,
              osVersion: true,
              description: true,
              technicalOwner: true,
              lastSeenAt: true,
              tags: { select: { tag: { select: { key: true, value: true } } } },
              services: { select: { id: true, name: true, status: true }, orderBy: { name: "asc" } },
            },
          },
          service: {
            select: { id: true, name: true, status: true },
          },
          category: {
            select: {
              code: true,
              name: true,
              description: true,
              commonCauses: true,
              solutions: true,
            },
          },
        },
      }),
    ]);

    const mappedItems: LogEventWithRelations[] = items.map((item) => ({
      id: item.id,
      serverId: item.serverId,
      serverName: item.server?.name ?? null,
      serverIp: item.server?.ipAddress ?? null,
      serverEnvironment: item.server?.environment ?? null,
      serverHealth: item.server?.healthStatus ?? null,
      serverOs: item.server ? `${item.server.osType}${item.server.osVersion ? ` ${item.server.osVersion}` : ""}` : null,
      serverDescription: item.server?.description ?? null,
      serverOwner: item.server?.technicalOwner ?? null,
      serverLastSeenAt: item.server?.lastSeenAt?.toISOString() ?? null,
      serverTags:
        item.server?.tags?.map((t) => ({ key: t.tag.key, value: t.tag.value })) ?? [],
      serverServices: item.server?.services?.map((s) => ({ id: s.id, name: s.name, status: s.status })) ?? [],
      serviceId: item.serviceId,
      serviceName: item.service?.name ?? null,
      serviceStatus: item.service?.status ?? null,
      category: item.category.code as LogCategory,
      categoryName: item.category.name,
      categoryDescription: item.category.description,
      categoryCommonCauses: item.category.commonCauses,
      categorySolutions: item.category.solutions,
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
          select: {
            id: true,
            name: true,
            ipAddress: true,
            environment: true,
            healthStatus: true,
            osType: true,
            osVersion: true,
            description: true,
            technicalOwner: true,
            lastSeenAt: true,
            tags: { select: { tag: { select: { key: true, value: true } } } },
            services: { select: { id: true, name: true, status: true }, orderBy: { name: "asc" } },
          },
        },
        service: {
          select: { id: true, name: true, status: true, port: true, endpoint: true },
        },
        category: {
          select: {
            code: true,
            name: true,
            description: true,
            commonCauses: true,
            solutions: true,
          },
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
      serverEnvironment: event.server?.environment ?? null,
      serverHealth: event.server?.healthStatus ?? null,
      serverOs: event.server ? `${event.server.osType}${event.server.osVersion ? ` ${event.server.osVersion}` : ""}` : null,
      serverDescription: event.server?.description ?? null,
      serverOwner: event.server?.technicalOwner ?? null,
      serverLastSeenAt: event.server?.lastSeenAt?.toISOString() ?? null,
      serverTags: event.server?.tags?.map((t) => ({ key: t.tag.key, value: t.tag.value })) ?? [],
      serverServices: event.server?.services?.map((s) => ({ id: s.id, name: s.name, status: s.status })) ?? [],
      serviceId: event.serviceId,
      serviceName: event.service?.name ?? null,
      serviceStatus: event.service?.status ?? null,
      servicePort: event.service?.port ?? null,
      serviceEndpoint: event.service?.endpoint ?? null,
      category: event.category.code as LogCategory,
      categoryName: event.category.name,
      categoryDescription: event.category.description,
      categoryCommonCauses: event.category.commonCauses,
      categorySolutions: event.category.solutions,
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
