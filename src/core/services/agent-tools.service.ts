import { prisma } from "@/infrastructure/db/prisma";
import { DomainError } from "@/shared/errors/domain-errors";
import { OrgTaxonomyService } from "@/core/services/org-taxonomy.service";
import { ServerQueryService } from "@/core/services/server-query.service";
import {
  buildOrgUnitIndex,
  normalizedSecretariaKey,
} from "@/core/domain/org-taxonomy";

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
      "Lista los servidores registrados con su IP, ambiente, estado de salud, ciclo de vida, unidad organizacional, categoría, etiquetas y el detalle de sus servicios (nombre, estado, puerto, verificación). Opcionalmente filtra por ambiente, salud, categoría de entidad ('despacho' o 'secretarias') o etiqueta. Úsala para listar servidores individuales y auditar sus servicios; para un resumen agregado por categoría usa reporte_por_categoria.",
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
        categoria: {
          type: "string",
          description:
            "Filtrar por categoría de entidad (nombre o slug), p. ej. 'despacho' (Despacho Municipal), 'secretarias' (Secretarías Municipales), 'subalcaldias', etc.",
        },
        etiqueta: {
          type: "string",
          description: "Filtrar por etiqueta de la unidad, p. ej. 'Alcaldía', 'Gabinete', 'Finanzas' o 'Salud'",
        },
      },
    },
  },
  {
    name: "consultar_organizacion",
    description:
      "Estructura organizacional completa: categorías de entidad (Despacho Municipal, Secretarías Municipales, Subalcaldías…), unidades de cada categoría, sus etiquetas y cantidad de servidores. Úsala para distinguir categorías y etiquetas antes de responder o filtrar el inventario, y para saber qué categorías existen (incluyendo Despacho Municipal).",
    parameters: {
      type: "object",
      properties: {
        categoria: {
          type: "string",
          description: "Filtrar por categoría de entidad (nombre o slug, opcional)",
        },
        etiqueta: {
          type: "string",
          description: "Filtrar por etiqueta exacta de unidad (opcional)",
        },
      },
    },
  },
  {
    name: "reporte_por_categoria",
    description:
      "Genera un reporte agregado de servidores agrupado por categoría de entidad (Despacho Municipal, Secretarías Municipales, Subalcaldías, Empresas Públicas, Direcciones y Unidades). Devuelve el total de servidores, operativos, con advertencias y sin conexión por categoría y por unidad. Úsalo cuando te pidan un reporte de estado por categoría o por secretaría/despacho.",
    parameters: {
      type: "object",
      properties: {
        categoria: {
          type: "string",
          description: "Filtrar solo por una categoría específica (nombre o slug, opcional). Si se omite, se reportan todas las categorías.",
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
      case "consultar_organizacion":
        return this.consultarOrganizacion(args);
      case "reporte_por_categoria":
        return this.reportePorCategoria(args);
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
    const categoryFilter =
      typeof args.categoria === "string" && args.categoria.trim()
        ? normalizedSecretariaKey(args.categoria)
        : undefined;
    const tagFilter =
      typeof args.etiqueta === "string" && args.etiqueta.trim()
        ? normalizedSecretariaKey(args.etiqueta)
        : undefined;

    const [servers, units] = await Promise.all([
      prisma.server.findMany({
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
          services: { select: { name: true, status: true, port: true, endpoint: true, description: true, lastResult: true } },
          tags: { select: { tag: { select: { key: true, value: true } } } },
          _count: { select: { incidents: true } },
        },
        orderBy: { name: "asc" },
      }),
      OrgTaxonomyService.listUnits(),
    ]);

    const unitIndex = buildOrgUnitIndex(units);

    const classified = servers.map((server) => {
      const rawUnit =
        server.tags.find(
          (entry) =>
            entry.tag.key.trim().toLowerCase().replace(/í/g, "i") === "secretaria" &&
            entry.tag.value.trim().length > 0
        )?.tag.value.trim() ?? null;
      const unit = rawUnit ? (unitIndex.get(normalizedSecretariaKey(rawUnit)) ?? null) : null;

      return {
        nombre: server.name,
        ip: server.ipAddress,
        ambiente: server.environment,
        salud: server.healthStatus,
        ciclo: server.lifecycleState,
        so: server.osType,
        unidad: unit?.name ?? rawUnit,
        categoria: unit?.category?.name ?? null,
        categoria_slug: unit?.category?.slug ?? null,
        etiquetas: unit?.tags ?? [],
        frescura: server.dataFreshness?.freshnessState ?? null,
        ultima_conexion: server.lastSeenAt?.toISOString() ?? null,
        servicios: server.services.map((service) => ({
          nombre: service.name,
          estado: service.status,
          puerto: service.port ?? null,
          endpoint: service.endpoint ?? null,
          descripcion: service.description ?? null,
          ultima_verificacion: service.lastResult ?? null,
        })),
        incidentes_abiertos_count: server._count.incidents,
        _categoria_key: unit?.category?.slug ?? null,
      };
    });

    const filtered = classified.filter((server) => {
      if (categoryFilter) {
        const nameKey = server.categoria ? normalizedSecretariaKey(server.categoria) : "";
        const slugKey = (server._categoria_key ?? "").toLowerCase();
        const matchesCategory =
          nameKey === categoryFilter ||
          slugKey === categoryFilter.toLowerCase() ||
          nameKey.includes(categoryFilter) ||
          categoryFilter.includes(nameKey) ||
          slugKey.includes(categoryFilter.toLowerCase()) ||
          categoryFilter.toLowerCase().includes(slugKey);
        if (!matchesCategory) return false;
      }
      if (tagFilter) {
        const tags = server.etiquetas.map((tag) => normalizedSecretariaKey(tag));
        if (!tags.includes(tagFilter)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      return {
        total: 0,
        mensaje:
          categoryFilter || tagFilter
            ? "No hay servidores que coincidan con esa categoría o etiqueta. Usa consultar_organizacion para ver las categorías y etiquetas disponibles."
            : "No hay servidores que coincidan con el filtro.",
      };
    }

    return {
      total: filtered.length,
      servidores: filtered.map(({ _categoria_key: _ignored, ...server }) => server),
    };
  }

  /** Estructura de categorías + unidades + etiquetas, con conteos de servidores. */
  private static async consultarOrganizacion(args: Record<string, unknown>): Promise<unknown> {
    const categoryFilter =
      typeof args.categoria === "string" && args.categoria.trim()
        ? normalizedSecretariaKey(args.categoria)
        : undefined;
    const tagFilter =
      typeof args.etiqueta === "string" && args.etiqueta.trim()
        ? normalizedSecretariaKey(args.etiqueta)
        : undefined;

    const [groups, categories, tagVocabulary] = await Promise.all([
      ServerQueryService.listSecretariaGroups(),
      OrgTaxonomyService.listCategories(),
      OrgTaxonomyService.listTagVocabulary(),
    ]);

    const buckets = new Map<
      string,
      {
        nombre: string;
        slug: string | null;
        descripcion: string | null;
        unidades: Array<{
          unidad: string;
          categoria: string | null;
          etiquetas: string[];
          servidores: { total: number; operativos: number; advertencias: number; sin_conexion: number };
        }>;
      }
    >();

    for (const category of categories) {
      buckets.set(category.id, {
        nombre: category.name,
        slug: category.slug,
        descripcion: category.description,
        unidades: [],
      });
    }

    for (const group of groups) {
      if (group.unitId === null && group.id === "_sin_secretaria") continue;
      const bucketKey = group.category?.id ?? "sin-categoria";
      let bucket = buckets.get(bucketKey);
      if (!bucket) {
        bucket = {
          nombre: "Sin categoría",
          slug: null,
          descripcion: "Unidades detectadas por etiqueta que aún no están en el catálogo.",
          unidades: [],
        };
        buckets.set(bucketKey, bucket);
      }
      bucket.unidades.push({
        unidad: group.name,
        categoria: group.category?.name ?? null,
        etiquetas: group.tags,
        servidores: {
          total: group.total,
          operativos: group.ok,
          advertencias: group.warn,
          sin_conexion: group.down,
        },
      });
    }

    const result = Array.from(buckets.values())
      .filter((bucket) => {
        if (!categoryFilter) return true;
        return (
          normalizedSecretariaKey(bucket.nombre) === categoryFilter ||
          (bucket.slug ?? "") === categoryFilter.toLowerCase()
        );
      })
      .map((bucket) => ({
        ...bucket,
        unidades: bucket.unidades.filter((unit) => {
          if (!tagFilter) return true;
          return unit.etiquetas.some((tag) => normalizedSecretariaKey(tag) === tagFilter);
        }),
      }))
      .filter((bucket) => bucket.unidades.length > 0 || !categoryFilter);

    if (!result.length) {
      return {
        total_categorias: 0,
        mensaje: "No hay categorías ni etiquetas que coincidan con el filtro.",
      };
    }

    return {
      total_categorias: result.length,
      categorias: result.map((bucket) => ({
        ...bucket,
        total_unidades: bucket.unidades.length,
        total_servidores: bucket.unidades.reduce((sum, unit) => sum + unit.servidores.total, 0),
      })),
      etiquetas: tagVocabulary,
    };
  }

  /** Reporte agregado de servidores por categoría de entidad (para reportes por Despacho/Secretarías). */
  private static async reportePorCategoria(args: Record<string, unknown>): Promise<unknown> {
    const categoryFilter =
      typeof args.categoria === "string" && args.categoria.trim()
        ? normalizedSecretariaKey(args.categoria)
        : undefined;

    const [groups, categories] = await Promise.all([
      ServerQueryService.listSecretariaGroups(),
      OrgTaxonomyService.listCategories(),
    ]);

    // Construir mapa de categoría id -> datos de categoría
    const categoryById = new Map<string, { nombre: string; slug: string | null; color: string }>();
    for (const category of categories) {
      categoryById.set(category.id, {
        nombre: category.name,
        slug: category.slug,
        color: category.color,
      });
    }

    // Agrupar grupos por categoría
    const buckets = new Map<
      string,
      {
        categoria_id: string | null;
        nombre_categoria: string;
        slug_categoria: string | null;
        unidades: Array<{
          unidad: string;
          etiquetas: string[];
          servidores: { total: number; operativos: number; advertencias: number; sin_conexion: number };
        }>;
        totales: { total: number; operativos: number; advertencias: number; sin_conexion: number };
      }
    >();

    for (const group of groups) {
      if (group.unitId === null && group.id === "_sin_secretaria") continue;
      const catId = group.category?.id ?? null;
      if (categoryFilter && catId) {
        const cat = categoryById.get(catId);
        const catNameKey = cat ? normalizedSecretariaKey(cat.nombre) : "";
        const catSlug = (cat?.slug ?? "").toLowerCase();
        const matchesCat =
          catNameKey === categoryFilter ||
          catSlug === categoryFilter.toLowerCase() ||
          catNameKey.includes(categoryFilter) ||
          categoryFilter.includes(catNameKey) ||
          catSlug.includes(categoryFilter.toLowerCase()) ||
          categoryFilter.toLowerCase().includes(catSlug);
        if (!matchesCat) {
          continue;
        }
      }
      if (categoryFilter && !catId) continue;

      let bucket = buckets.get(catId ?? "sin-categoria");
      if (!bucket) {
        const cat = catId ? categoryById.get(catId) : null;
        bucket = {
          categoria_id: catId,
          nombre_categoria: cat?.nombre ?? "Sin categoría",
          slug_categoria: cat?.slug ?? null,
          unidades: [],
          totales: { total: 0, operativos: 0, advertencias: 0, sin_conexion: 0 },
        };
        buckets.set(catId ?? "sin-categoria", bucket);
      }

      bucket.unidades.push({
        unidad: group.name,
        etiquetas: group.tags,
        servidores: {
          total: group.total,
          operativos: group.ok,
          advertencias: group.warn,
          sin_conexion: group.down,
        },
      });
      bucket.totales.total += group.total;
      bucket.totales.operativos += group.ok;
      bucket.totales.advertencias += group.warn;
      bucket.totales.sin_conexion += group.down;
    }

    const result = Array.from(buckets.values()).map((bucket) => ({
      categoria: bucket.nombre_categoria,
      categoria_slug: bucket.slug_categoria,
      total_servidores: bucket.totales.total,
      operativos: bucket.totales.operativos,
      advertencias: bucket.totales.advertencias,
      sin_conexion: bucket.totales.sin_conexion,
      unidades: bucket.unidades.map((u) => ({
        nombre: u.unidad,
        etiquetas: u.etiquetas,
        total: u.servidores.total,
        operativos: u.servidores.operativos,
        advertencias: u.servidores.advertencias,
        sin_conexion: u.servidores.sin_conexion,
      })),
    }));

    if (!result.length) {
      return {
        total: 0,
        mensaje: categoryFilter
          ? `No hay servidores ni unidades en la categoría "${categoryFilter}". Usa consultar_organizacion para ver las categorías disponibles.`
          : "No hay servidores agrupados por categoría.",
      };
    }

    const granTotal = result.reduce((sum, r) => sum + r.total_servidores, 0);
    const granOperativos = result.reduce((sum, r) => sum + r.operativos, 0);
    const granAdvertencias = result.reduce((sum, r) => sum + r.advertencias, 0);
    const granSinConexion = result.reduce((sum, r) => sum + r.sin_conexion, 0);

    return {
      total_categorias: result.length,
      gran_total: granTotal,
      gran_operativos: granOperativos,
      gran_advertencias: granAdvertencias,
      gran_sin_conexion: granSinConexion,
      categorias: result,
    };
  }

  private static async detalleServidor(args: Record<string, unknown>): Promise<unknown> {
    const nombre = typeof args.nombre === "string" ? args.nombre.trim() : "";
    if (!nombre) return { error: "El parámetro 'nombre' es requerido." };

    const [server, units] = await Promise.all([
      prisma.server.findFirst({
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
          tags: { select: { tag: { select: { key: true, value: true } } } },
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
      }),
      OrgTaxonomyService.listUnits(),
    ]);

    if (!server) return { error: `No existe un servidor cuyo nombre contenga "${nombre}".` };

    const unitIndex = buildOrgUnitIndex(units);
    const rawUnit =
      server.tags.find(
        (entry) =>
          entry.tag.key.trim().toLowerCase().replace(/í/g, "i") === "secretaria" &&
          entry.tag.value.trim().length > 0
      )?.tag.value.trim() ?? null;
    const unit = rawUnit ? (unitIndex.get(normalizedSecretariaKey(rawUnit)) ?? null) : null;

    return {
      ...server,
      unidad: unit?.name ?? rawUnit,
      categoria: unit?.category
        ? {
            nombre: unit.category.name,
            slug: unit.category.slug,
          }
        : null,
      etiquetas: unit?.tags ?? [],
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
