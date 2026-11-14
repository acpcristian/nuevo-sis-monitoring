import { z } from "zod";
import { AgentToolsService } from "@/core/services/agent-tools.service";
import { IncidentService } from "@/core/services/incident.service";
import { AuditService } from "@/core/services/audit.service";
import { prisma } from "@/infrastructure/db/prisma";
import { DomainError } from "@/shared/errors/domain-errors";

/**
 * Servidor MCP (Model Context Protocol) sobre HTTP Streamable — estadoless.
 *
 * Implementación mínima y sin dependencias del subconjunto del protocolo que
 * usa Hermes Agent: `initialize`, `ping`, `tools/list`, `tools/call` y la
 * notificación `notifications/initialized` (JSON-RPC 2.0). Las respuestas
 * vuelven como `application/json` (el protocolo permite JSON directo además
 * de SSE); al ser estadoless no se emite `Mcp-Session-Id`.
 *
 * Alcance (Opción A acordada con el dueño):
 *  - SOLO lectura: consultar_inventario, detalle_servidor, consultar_logs,
 *    consultar_alertas, consultar_incidentes, estado_general.
 *  - UNA mutación auditada: crear_incidente.
 *  - El control de servicios de servidores NO se expone por MCP.
 */

const SERVER_INFO = { name: "nuevo-sis-monitoring", version: "1.0.0" } as const;
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;
const DEFAULT_PROTOCOL_VERSION: (typeof SUPPORTED_PROTOCOL_VERSIONS)[number] = "2025-06-18";

/** Identidad del agente externo para la trazabilidad de incidentes creados vía MCP. */
export const MCP_ACTOR_ID = "hermes-telegram";

const CrearIncidenteSchema = z.object({
  titulo: z.string().min(5, "El título requiere al menos 5 caracteres").max(200),
  descripcion: z.string().min(5, "La descripción requiere al menos 5 caracteres").max(5000),
  categoria: z.enum(["INCIDENT_CRITICAL", "INCIDENT_MAJOR", "INCIDENT_MINOR", "INCIDENT_MAINTENANCE"]).default("INCIDENT_MAJOR"),
  prioridad: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
  servidor: z.string().max(200).optional(),
  slaTimeoutMin: z.coerce.number().int().min(15).max(2880).optional(),
});
type CrearIncidenteArgs = z.infer<typeof CrearIncidenteSchema>;

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const CREAR_INCIDENTE_TOOL: McpToolDefinition = {
  name: "crear_incidente",
  description:
    "Crea un incidente en el sistema (única acción de escritura permitida). Queda auditado a nombre del agente externo. Opcionalmente asocia el incidente a un servidor por nombre (coincidencia parcial).",
  inputSchema: {
    type: "object",
    properties: {
      titulo: { type: "string", description: "Título corto del incidente (5-200 caracteres)" },
      descripcion: { type: "string", description: "Descripción del problema observado" },
      categoria: {
        type: "string",
        description: "Categoría del incidente (por defecto INCIDENT_MAJOR)",
        enum: ["INCIDENT_CRITICAL", "INCIDENT_MAJOR", "INCIDENT_MINOR", "INCIDENT_MAINTENANCE"],
      },
      prioridad: {
        type: "string",
        description: "Prioridad (por defecto MEDIUM)",
        enum: ["CRITICAL", "HIGH", "MEDIUM", "LOW"],
      },
      servidor: { type: "string", description: "Nombre del servidor asociado (opcional, coincidencia parcial)" },
      slaTimeoutMin: { type: "number", description: "SLA en minutos (opcional, 15-2880; por defecto según categoría)" },
    },
    required: ["titulo", "descripcion"],
  },
};

const ESTADO_GENERAL_TOOL: McpToolDefinition = {
  name: "estado_general",
  description:
    "Resumen agregado del sistema: servidores por estado de salud y frescura, alertas activas e incidentes abiertos.",
  inputSchema: { type: "object", properties: {} },
};

const READ_TOOLS = new Set(["consultar_inventario", "detalle_servidor", "consultar_logs", "consultar_alertas", "consultar_incidentes"]);

export interface McpCallContext {
  /** Nombre de la clave de servicio que autenticó la petición. */
  keyName: string;
}

export interface McpHttpResponse {
  httpStatus: number;
  /** `null` = notificación (respuesta vacía 202). */
  body: Record<string, unknown> | null;
}

export class McpService {
  /** Catálogo completo de tools MCP (lectura + crear_incidente + estado_general). */
  public static listToolDefinitions(): McpToolDefinition[] {
    const readDefs = AgentToolsService.getToolDefinitions().map((def) => ({
      name: def.function.name,
      description: def.function.description,
      inputSchema: def.function.parameters,
    }));
    return [...readDefs, CREAR_INCIDENTE_TOOL, ESTADO_GENERAL_TOOL];
  }

  /** Ejecuta una tool y devuelve el resultado serializable (JSON puro). */
  public static async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (READ_TOOLS.has(name)) {
      return AgentToolsService.execute(name, args);
    }
    if (name === "crear_incidente") {
      return this.crearIncidente(args);
    }
    if (name === "estado_general") {
      return this.estadoGeneral();
    }
    throw new DomainError(`Herramienta MCP desconocida: ${name}`, "UNKNOWN_AGENT_TOOL", 400);
  }

  /** Única mutación expuesta: creación de incidente con auditoría (Opción A). */
  private static async crearIncidente(rawArgs: Record<string, unknown>): Promise<unknown> {
    let input: CrearIncidenteArgs;
    try {
      input = CrearIncidenteSchema.parse(rawArgs);
    } catch (error) {
      if (error && typeof error === "object" && "issues" in error) {
        const first = (error as { issues: { message: string }[] }).issues[0];
        throw new DomainError(first?.message ?? "Argumentos inválidos para crear_incidente.", "VALIDATION_FAILED", 400);
      }
      throw error;
    }

    let serverId: string | undefined;
    if (input.servidor?.trim()) {
      const server = await prisma.server.findFirst({
        where: { OR: [{ name: { equals: input.servidor.trim() } }, { name: { contains: input.servidor.trim() } }] },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      if (!server) {
        throw new DomainError(`No existe un servidor cuyo nombre contenga "${input.servidor}".`, "SERVER_NOT_FOUND", 404);
      }
      serverId = server.id;
    }

    const incident = await IncidentService.createIncident(
      {
        title: input.titulo,
        description: input.descripcion,
        category: input.categoria,
        priority: input.prioridad,
        serverId,
        slaTimeoutMin: input.slaTimeoutMin,
        details: { source: "mcp", origin: "telegram" },
      },
      MCP_ACTOR_ID,
      null
    );

    return {
      ok: true,
      incidente: {
        id: incident.id,
        titulo: incident.title,
        categoria: incident.category,
        prioridad: incident.priority,
        estado: incident.status,
        servidor: serverId,
        slaDueAt: incident.slaDueAt,
        creado: incident.createdAt,
      },
    };
  }

  /** Resumen agregado (solo lecturas baratas con `count`/`groupBy`). */
  private static async estadoGeneral(): Promise<unknown> {
    const [porSalud, porFrescura, alertasActivas, incidentesAbiertos] = await Promise.all([
      prisma.server.groupBy({ by: ["healthStatus"], _count: true }),
      prisma.dataFreshnessState.groupBy({ by: ["freshnessState"], _count: true }),
      prisma.logAlert.count({ where: { status: "ACTIVE" as never } }),
      prisma.incident.count({ where: { status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] as never } } }),
    ]);

    return {
      servidores_por_salud: Object.fromEntries(porSalud.map((g) => [g.healthStatus, g._count])),
      servidores_por_frescura: Object.fromEntries(porFrescura.map((g) => [g.freshnessState, g._count])),
      alertas_activas: alertasActivas,
      incidentes_abiertos: incidentesAbiertos,
    };
  }

  // ==========================================================================
  // Manejo JSON-RPC 2.0 (HTTP Streamable, estadoless)
  // ==========================================================================

  /**
   * Procesa el cuerpo JSON-RPC de una petición POST.
   * Devuelve el cuerpo de respuesta (o `null` para notificaciones, HTTP 202).
   */
  public static async handleRequest(body: unknown, ctx: McpCallContext): Promise<McpHttpResponse> {
    const request = (body ?? {}) as {
      jsonrpc?: unknown;
      id?: unknown;
      method?: unknown;
      params?: unknown;
    };

    if (request.jsonrpc !== "2.0" || typeof request.method !== "string") {
      const errorBody = this.errorResponse(request.id, -32600, "Petición JSON-RPC inválida.");
      return { httpStatus: 200, body: errorBody };
    }

    switch (request.method) {
      case "initialize": {
        const requested = this.requestedProtocolVersion(request.params);
        const result = {
          protocolVersion: requested ?? DEFAULT_PROTOCOL_VERSION,
          capabilities: { tools: { listChanged: false } },
          serverInfo: SERVER_INFO,
          instructions:
            "Servidor MCP del sistema de monitoreo NUEVO SIS. Tools de solo lectura (inventario, logs, alertas, incidentes, estado general) más crear_incidente (auditada). El control de servicios NO está disponible vía MCP.",
        };
        return { httpStatus: 200, body: { jsonrpc: "2.0", id: request.id ?? null, result } };
      }

      case "notifications/initialized":
        return { httpStatus: 202, body: null };

      case "ping":
        return { httpStatus: 200, body: { jsonrpc: "2.0", id: request.id ?? null, result: {} } };

      case "tools/list": {
        const result = { tools: this.listToolDefinitions() };
        return { httpStatus: 200, body: { jsonrpc: "2.0", id: request.id ?? null, result } };
      }

      case "tools/call":
        return this.handleToolCall(request, ctx);

      default: {
        const hasId = request.id !== undefined && request.id !== null;
        if (!hasId) {
          // Notificación de método desconocido: no se responde (JSON-RPC 2.0).
          return { httpStatus: 202, body: null };
        }
        const errorBody = this.errorResponse(request.id, -32601, `Método no soportado: ${request.method}`);
        return { httpStatus: 200, body: errorBody };
      }
    }
  }

  private static requestedProtocolVersion(params: unknown): string | null {
    if (params && typeof params === "object" && "protocolVersion" in params) {
      const requested = (params as { protocolVersion?: unknown }).protocolVersion;
      if (typeof requested === "string" && (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)) {
        return requested;
      }
    }
    return null;
  }

  private static async handleToolCall(
    request: { id?: unknown; params?: unknown },
    ctx: McpCallContext
  ): Promise<McpHttpResponse> {
    const params = (request.params ?? {}) as { name?: unknown; arguments?: unknown };
    const name = typeof params.name === "string" ? params.name : "";
    let args: Record<string, unknown> = {};
    if (params.arguments && typeof params.arguments === "object") {
      args = params.arguments as Record<string, unknown>;
    }

    let payload: Record<string, unknown>;
    try {
      if (!name) {
        throw new DomainError("Falta el nombre de la tool.", "VALIDATION_FAILED", 400);
      }
      const result = await this.executeTool(name, args);
      payload = {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: false,
      };
    } catch (error) {
      const message =
        error instanceof DomainError
          ? error.message
          : error && typeof error === "object" && "message" in error
            ? String((error as { message: unknown }).message)
            : "Error interno al ejecutar la tool.";
      payload = {
        content: [{ type: "text", text: message }],
        isError: true,
      };
      await AuditService.recordEvent({
        userId: `mcp:${ctx.keyName}`,
        action: "MCP_TOOL_CALL",
        detailsDiff: { tool: name, ok: false, error: message.slice(0, 300) },
        ipAddress: null,
      });
      return { httpStatus: 200, body: { jsonrpc: "2.0", id: request.id ?? null, result: payload } };
    }

    await AuditService.recordEvent({
      userId: `mcp:${ctx.keyName}`,
      action: "MCP_TOOL_CALL",
      detailsDiff: { tool: name, ok: true },
      ipAddress: null,
    });

    return { httpStatus: 200, body: { jsonrpc: "2.0", id: request.id ?? null, result: payload } };
  }

  private static errorResponse(id: unknown, code: number, message: string): Record<string, unknown> {
    return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
  }
}
