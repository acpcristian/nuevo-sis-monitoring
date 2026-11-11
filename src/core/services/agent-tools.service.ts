import { prisma } from "@/infrastructure/db/prisma";
import { DomainError } from "@/shared/errors/domain-errors";

/**
 * Tools de dominio del agente (function calling, SOLO lectura).
 * El LLM puede invocarlas durante un turno para consultar el estado vivo de la
 * infraestructura en lugar de depurar solo del contexto estático del prompt.
 *
 * Reglas:
 *  - Ninguna herramienta muta datos ni ejecuta acciones sobre servidores.
 *  - Los resultados se recortan (mensajes ≤ 200 chars, filas limitadas) para
 *    no desbordar la ventana de contexto del modelo.
 */

export interface AgentToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, { type: string; description: string; enum?: string[] }>;
    required?: string[];
  };
}

const TOOL_CATALOG: AgentToolDefinition[] = [
  {
    name: "consultar_inventario",
    description:
      "Lista los servidores registrados con su IP, ambiente, estado de salud, ciclo de vida y servicios. Opcionalmente filtra por ambiente o salud.",
    parameters: {
      type: "object",
      properties: {
        environment: {
          type: "string",
          description: "Filtrar por ambiente",
          enum: ["PROD", "STAGING", "DEV", "QA"],
        },
        healthStatus: {
          type: "string",
          description: "Filtrar por estado de salud",
          enum: ["ONLINE", "DEGRADED", "UNREACHABLE", "AUTH_FAILED", "PENDING"],
        },
      },
    },
  },
  {
    name: "detalle_servidor",
    description:
      "Detalle de un servidor por nombre (parcial o exacto): servicios con estado, últimos chequeos de conectividad, frescura de datos e incidents abiertos asociados.",
    parameters: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Nombre del servidor (coincidencia parcial permitida)" },
      },
      required: ["nombre"],
    },
  },
  {
    name: "consultar_logs",
    description:
      "Eventos de logs recientes, opcionalmente filtrados por servidor y severidad. Devuelve los más nuevos primero.",
    parameters: {
      type: "object",
      properties: {
        servidor: { type: "string", description: "Nombre del servidor (opcional, coincidencia parcial)" },
        severidad: {
          type: "string",
          description: "Filtrar por severidad (opcional)",
          enum: ["INFO", "WARN", "ERROR", "CRITICAL"],
        },
        limite: { type: "number", description: "Cantidad máxima de eventos (por defecto 20, máximo 50)" },
      },
    },
  },
  {
    name: "consultar_alertas",
    description: "Alertas de logs actualmente ACTIVAS (patrones detectados en ventanas de tiempo).",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "consultar_incidentes",
    description:
      "Incidentes del sistema. Por defecto los no cerrados (OPEN/ASSIGNED/IN_PROGRESS); se puede filtrar por estado.",
    parameters: {
      type: "object",
      properties: {
        estado: {
          type: "string",
          description: "Filtrar por estado exacto (opcional)",
          enum: ["OPEN", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"],
        },
      },
    },
  },
];

const MAX_LOG_ROWS = 50;
const MAX_MESSAGE_CHARS = 200;

export class AgentToolsService {
  /**
   * Definiciones en el formato `tools` de la API OpenAI-compatible:
   * [{ type: "function", function: { name, description, parameters } }]
   */
  public static getToolDefinitions(): Array<{
    type: "function";
    function: { name: string; description: string; parameters: AgentToolDefinition["parameters"] };
  }> {
    return TOOL_CATALOG.map((tool) => ({
      type: "function" as const,
      function: { name: tool.name, description: tool.description, parameters: tool.parameters },
    }));
  }

  /** Resumen nombre+descripción para el prompt de sistema. */
  public static getToolSummaries(): Array<{ name: string; description: string }> {
    return TOOL_CATALOG.map((tool) => ({ name: tool.name, description: tool.description }));
  }

  /** ¿Está registrada esta herramienta? (evita invocaciones inventadas por el modelo). */
  public static isKnownTool(name: string): boolean {
    return TOOL_CATALOG.some((tool) => tool.name === name);
  }

  /** Ejecuta una tool de dominio y devuelve el resultado serializable a JSON. */
  public static async execute(name: string, rawArgs: string | Record<string, unknown>): Promise<unknown> {
    if (!this.isKnownTool(name)) {
      throw new DomainError(`Herramienta desconocida: ${name}`, "UNKNOWN_AGENT_TOOL", 400);
    }

    let args: Record<string, unknown> = {};
    if (typeof rawArgs === "string" && rawArgs.trim()) {
      try {
        args = JSON.parse(rawArgs) as Record<string, unknown>;
      } catch {
        return { error: "Los argumentos no son JSON válido." };
      }
    }

    switch (name) {
      case "consultar_inventario":
        return this.consultarInventario(args);
      case "detalle_servidor":
        return this.detalleServidor(args);
      case "consultar_logs":
        return this.consultarLogs(args);
      case "consultar_alertas":
        return this.consultarAlertas();
      case "consultar_incidentes":
        return this.consultarIncidentes(args);
      default:
        throw new DomainError(`Herramienta sin executor: ${name}`, "UNKNOWN_AGENT_TOOL", 400);
    }
  }

  /** Resumen de una invocación para el evento SSE `tool` (sin datos crudos). */
  public static summarizeInvocation(name: string, rawArgs: string | Record<string, unknown>): string {
    let args: Record<string, unknown> = {};
    if (typeof rawArgs === "string" && rawArgs.trim()) {
      try {
        args = JSON.parse(rawArgs) as Record<string, unknown>;
      } catch {
        args = {};
      }
    }
    const parts = Object.entries(args)
      .filter(([, value]) => value !== undefined && value !== null && value !== "")
      .map(([key, value]) => `${key}=${String(value).slice(0, 60)}`);
    return parts.length ? `${name}(${parts.join(", ")})` : `${name}()`;
  }

  // ── Executors (read-only) ───────────────────────────────────────────────────

  private static async consultarInventario(args: Record<string, unknown>): Promise<unknown> {
    const environment = typeof args.environment === "string" ? args.environment.toUpperCase() : undefined;
    const healthStatus = typeof args.healthStatus === "string" ? args.healthStatus.toUpperCase() : undefined;

    const servers = await prisma.server.findMany({
      where: {
        ...(environment ? { environment: environment as never } : {}),
        ...(healthStatus ? { healthStatus: healthStatus as never } : {}),
      },
      select: {
        name: true,
        ipAddress: true,
        environment: true,
        healthStatus: true,
        lifecycleState: true,
        osType: true,
        osVersion: true,
        lastSeenAt: true,
        dataFreshness: { select: { freshnessState: true } },
        services: { select: { name: true, status: true } },
        _count: { select: { incidents: true } },
      },
      orderBy: { name: "asc" },
    });

    if (!servers.length) return { total: 0, mensaje: "No hay servidores que coincidan con el filtro." };

    return {
      total: servers.length,
      servidores: servers.map((server) => ({
        nombre: server.name,
        ip: server.ipAddress,
        ambiente: server.environment,
        salud: server.healthStatus,
        ciclo: server.lifecycleState,
        so: server.osType,
        frescura: server.dataFreshness?.freshnessState ?? null,
        ultima_conexion: server.lastSeenAt?.toISOString() ?? null,
        servicios: server.services.map((service) => `${service.name}=${service.status}`),
        incidentes_abiertos_count: server._count.incidents,
      })),
    };
  }

  private static async detalleServidor(args: Record<string, unknown>): Promise<unknown> {
    const nombre = typeof args.nombre === "string" ? args.nombre.trim() : "";
    if (!nombre) return { error: "El parámetro 'nombre' es requerido." };

    const server = await prisma.server.findFirst({
      where: { OR: [{ name: { equals: nombre } }, { name: { contains: nombre } }] },
      select: {
        name: true,
        ipAddress: true,
        hostname: true,
        environment: true,
        healthStatus: true,
        lifecycleState: true,
        osType: true,
        osVersion: true,
        connectionPort: true,
        technicalOwner: true,
        description: true,
        lastSeenAt: true,
        lastCheckedAt: true,
        dataFreshness: { select: { freshnessState: true, lastTelemetryAt: true } },
        services: { select: { name: true, status: true, port: true, lastResult: true } },
        checks: {
          orderBy: { eventTimestamp: "desc" },
          take: 5,
          select: { eventTimestamp: true, resultStatus: true, durationMs: true, diagnosticSummary: true },
        },
        incidents: {
          where: { status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] as never } },
          select: { title: true, priority: true, status: true },
        },
      },
      orderBy: { name: "asc" },
    });

    if (!server) return { error: `No existe un servidor cuyo nombre contenga "${nombre}".` };

    return {
      ...server,
      ultima_conexion: server.lastSeenAt?.toISOString() ?? null,
      ultimo_chequeo: server.lastCheckedAt?.toISOString() ?? null,
      incidentes_abiertos: server.incidents,
    };
  }

  private static async consultarLogs(args: Record<string, unknown>): Promise<unknown> {
    const servidor = typeof args.servidor === "string" ? args.servidor.trim() : "";
    const severity = typeof args.severidad === "string" ? args.severidad.toUpperCase() : undefined;
    const requested = typeof args.limite === "number" && Number.isFinite(args.limite) ? args.limite : 20;
    const limit = Math.min(Math.max(Math.trunc(requested), 1), MAX_LOG_ROWS);

    const events = await prisma.logEvent.findMany({
      where: {
        ...(servidor ? { server: { name: { contains: servidor } } } : {}),
        ...(severity ? { severity: severity as never } : {}),
      },
      orderBy: { eventTimestamp: "desc" },
      take: limit,
      select: {
        eventTimestamp: true,
        severity: true,
        sanitizedMessage: true,
        eventType: true,
        server: { select: { name: true } },
        service: { select: { name: true } },
        category: { select: { name: true } },
      },
    });

    if (!events.length) return { total: 0, mensaje: "No hay eventos de logs que coincidan con el filtro." };

    return {
      total: events.length,
      eventos: events.map((event) => ({
        timestamp: event.eventTimestamp.toISOString(),
        servidor: event.server?.name ?? null,
        servicio: event.service?.name ?? null,
        categoria: event.category?.name ?? null,
        severidad: event.severity,
        tipo: event.eventType,
        mensaje: event.sanitizedMessage.slice(0, MAX_MESSAGE_CHARS),
      })),
    };
  }

  private static async consultarAlertas(): Promise<unknown> {
    const alerts = await prisma.logAlert.findMany({
      where: { status: "ACTIVE" as never },
      orderBy: { windowEnd: "desc" },
      take: 30,
      select: {
        id: true,
        server: { select: { name: true } },
        patternType: true,
        eventCount: true,
        severity: true,
        windowStart: true,
        windowEnd: true,
      },
    });

    if (!alerts.length) return { total: 0, mensaje: "No hay alertas activas en este momento." };

    return {
      total: alerts.length,
      alertas: alerts.map((alert) => ({
        servidor: alert.server?.name ?? null,
        patron: alert.patternType,
        eventos: alert.eventCount,
        severidad: alert.severity,
        ventana: `${alert.windowStart.toISOString()} → ${alert.windowEnd.toISOString()}`,
      })),
    };
  }

  private static async consultarIncidentes(args: Record<string, unknown>): Promise<unknown> {
    const estado = typeof args.estado === "string" ? args.estado.toUpperCase() : undefined;
    const statuses = estado
      ? [estado]
      : (["OPEN", "ASSIGNED", "IN_PROGRESS"] as string[]);

    const incidents = await prisma.incident.findMany({
      where: { status: { in: statuses as never } },
      orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
      take: 30,
      select: {
        title: true,
        description: true,
        category: true,
        priority: true,
        status: true,
        createdAt: true,
        assignedTo: true,
        server: { select: { name: true } },
      },
    });

    if (!incidents.length) return { total: 0, mensaje: "No hay incidentes con ese criterio." };

    return {
      total: incidents.length,
      incidentes: incidents.map((incident) => ({
        titulo: incident.title,
        descripcion: incident.description.slice(0, MAX_MESSAGE_CHARS),
        categoria: incident.category,
        prioridad: incident.priority,
        estado: incident.status,
        servidor: incident.server?.name ?? null,
        asignado_a: incident.assignedTo,
        creado: incident.createdAt.toISOString(),
      })),
    };
  }
}
