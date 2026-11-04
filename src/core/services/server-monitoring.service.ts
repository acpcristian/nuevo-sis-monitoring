import type { HealthStatus, Prisma, ServiceStatus } from "@prisma/client";
import { prisma } from "@/infrastructure/db/prisma";
import { HttpProbe } from "@/infrastructure/network/http-probe";
import { TcpProbe } from "@/infrastructure/network/tcp-probe";
import { NotFoundError } from "@/shared/errors/domain-errors";
import { deriveGlobalStatus, type GlobalServerStatus } from "@/core/domain/server.types";

/** Timeout duro por comprobación. El request nunca espera más que esto por sonda. */
const HOST_TIMEOUT_MS = 3000;
const SERVICE_TIMEOUT_MS = 3000;

/** Límites de concurrencia: evitan agotar sockets y mantienen el event loop libre. */
const SERVER_CONCURRENCY = 12;
const SERVICE_CONCURRENCY = 10;

/**
 * Ventana mínima entre sondeos automáticos por servidor. Dos pestañas abiertas
 * o dos polls solapados comparten el resultado en lugar de duplicar tráfico.
 */
const MIN_INTERVAL_MS = 5000;

/** Límite de servidores por lote (coincide con el máximo del endpoint manual). */
const MONITOR_BATCH_SIZE = 100;

type ServerWithServices = Prisma.ServerGetPayload<{ include: { services: true } }>;
type ServiceRecord = ServerWithServices["services"][number];

export interface MonitoredServiceSnapshot {
  id: string;
  serverId: string;
  name: string;
  description: string | null;
  status: ServiceStatus;
  port: number | null;
  endpoint: string | null;
  processName: string | null;
  lastCheckedAt: Date | null;
  lastResult: string | null;
  updatedAt: Date;
}

export interface ServerMonitorSnapshot {
  serverId: string;
  name: string;
  ipAddress: string;
  hostname: string | null;
  lifecycleState: string;
  healthStatus: HealthStatus;
  globalStatus: GlobalServerStatus;
  /** true si el host o al menos uno de sus servicios respondió. */
  reachable: boolean;
  /** null cuando el servidor no está en ciclo ACTIVE y no se sondeó. */
  checkedAt: Date | null;
  durationMs: number;
  services: MonitoredServiceSnapshot[];
}

export interface MonitorServersResult {
  servers: ServerMonitorSnapshot[];
  errors: Array<{ serverId: string; message: string }>;
}

interface ServiceProbeOutcome {
  id: string;
  status: ServiceStatus;
  lastResult: string;
  /** Un HTTP no-2xx también prueba que el host está vivo. */
  reachable: boolean;
}

/**
 * Reparte trabajo en un número fijo de workers. Se usa para no lanzar cientos
 * de sockets simultáneos cuando el dashboard monitorea todos los servidores.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= items.length) return;

      const item = items[index];
      if (item === undefined) continue;
      results[index] = await worker(item);
    }
  };

  const workers = Array.from(
    { length: Math.min(Math.max(limit, 1), items.length) },
    () => runWorker()
  );

  await Promise.all(workers);
  return results;
}

/**
 * Motor de monitoreo centralizado.
 *
 * - Consulta el estado real de hosts y servicios desde el backend.
 * - Nunca expone credenciales: los sondeos de disponibilidad no usan SSH.
 * - Tolera timeouts y caídas sin bloquear el request principal.
 * - Persiste `lastCheckedAt`, `lastResult` y el estado agregado del servidor.
 *
 * Nota de despliegue: la coalescencia es en memoria y asume una sola instancia
 * (el contenedor actual). Con varias réplicas cada una mantendría su ventana;
 * el resultado seguiría siendo correcto, solo se repetirían algunos sondeos.
 */
export class ServerMonitoringService {
  private static inFlight = new Map<string, Promise<ServerMonitorSnapshot>>();
  private static lastCompletedAt = new Map<string, number>();

  public static async monitorServers(
    ids?: string[],
    options: { force?: boolean } = {}
  ): Promise<MonitorServersResult> {
    const requestedIds = ids?.filter((id) => id.trim().length > 0);
    const servers = await prisma.server.findMany({
      where:
        requestedIds && requestedIds.length > 0
          ? { id: { in: requestedIds.slice(0, 100) } }
          : { lifecycleState: "ACTIVE" },
      select: { id: true },
      orderBy: { name: "asc" },
      take: 100,
    });

    const outcomes = await mapWithConcurrency(servers, SERVER_CONCURRENCY, async (server) => {
      try {
        return { ok: true as const, snapshot: await this.monitorServer(server.id, options) };
      } catch (error: unknown) {
        return {
          ok: false as const,
          serverId: server.id,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    });

    const snapshots: ServerMonitorSnapshot[] = [];
    const errors: Array<{ serverId: string; message: string }> = [];

    for (const outcome of outcomes) {
      if (!outcome) continue;
      if (outcome.ok) {
        snapshots.push(outcome.snapshot);
      } else {
        errors.push({ serverId: outcome.serverId, message: outcome.message });
      }
    }

    return { servers: snapshots, errors };
  }

  /**
   * Pasada completa para el scheduler: recorre **todos** los servidores ACTIVE
   * en lotes de 100. Así un inventario grande no queda limitado siempre a los
   * mismos primeros 100 por orden alfabético.
   */
  public static async monitorAllActiveServers(): Promise<MonitorServersResult> {
    const active = await prisma.server.findMany({
      where: { lifecycleState: "ACTIVE" },
      select: { id: true },
      orderBy: { name: "asc" },
    });

    const servers: ServerMonitorSnapshot[] = [];
    const errors: Array<{ serverId: string; message: string }> = [];

    for (let index = 0; index < active.length; index += MONITOR_BATCH_SIZE) {
      const batchIds = active
        .slice(index, index + MONITOR_BATCH_SIZE)
        .map((server) => server.id);

      const partial = await this.monitorServers(batchIds);
      servers.push(...partial.servers);
      errors.push(...partial.errors);
    }

    return { servers, errors };
  }

  public static async monitorServer(
    serverId: string,
    options: { force?: boolean } = {}
  ): Promise<ServerMonitorSnapshot> {
    const pending = this.inFlight.get(serverId);
    if (pending) return pending;

    const lastCompleted = this.lastCompletedAt.get(serverId);
    if (!options.force && lastCompleted && Date.now() - lastCompleted < MIN_INTERVAL_MS) {
      return this.loadSnapshot(serverId);
    }

    const promise = this.runMonitor(serverId)
      .then((snapshot) => {
        this.lastCompletedAt.set(serverId, Date.now());
        return snapshot;
      })
      .finally(() => {
        this.inFlight.delete(serverId);
      });

    this.inFlight.set(serverId, promise);
    return promise;
  }

  /**
   * Devuelve el último estado persistido sin generar tráfico de red.
   * Se usa cuando el servidor fue sondeado hace muy poco.
   */
  private static async loadSnapshot(serverId: string): Promise<ServerMonitorSnapshot> {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
      include: { services: { orderBy: { name: "asc" } } },
    });

    if (!server) throw new NotFoundError("Servidor");

    return this.toSnapshot(server, server.services, {
      healthStatus: server.healthStatus,
      checkedAt: server.lastCheckedAt,
      reachable: server.healthStatus === "ONLINE" || server.healthStatus === "DEGRADED",
      durationMs: 0,
    });
  }

  private static async runMonitor(serverId: string): Promise<ServerMonitorSnapshot> {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
      include: { services: { orderBy: { name: "asc" } } },
    });

    if (!server) throw new NotFoundError("Servidor");

    // Mantenimiento, deshabilitado o retirado: no se genera tráfico de red ni se
    // sobrescribe el último estado conocido. La UI muestra el badge de ciclo de vida.
    if (server.lifecycleState !== "ACTIVE") {
      return this.toSnapshot(server, server.services, {
        healthStatus: server.healthStatus,
        checkedAt: server.lastCheckedAt,
        reachable: false,
        durationMs: 0,
      });
    }

    const startedAt = Date.now();

    // Host y servicios se comprueban en paralelo: un puerto SSH cerrado no debe
    // impedir que un health endpoint del servicio demuestre que el host está vivo.
    const [hostProbe, serviceOutcomes] = await Promise.all([
      TcpProbe.probe({
        host: server.ipAddress,
        port: server.connectionPort,
        timeoutMs: HOST_TIMEOUT_MS,
      }),
      mapWithConcurrency(server.services, SERVICE_CONCURRENCY, (service) =>
        this.probeService(server, service)
      ),
    ]);

    const checkedAt = new Date();
    const reachable =
      hostProbe.status === "SUCCESS" || serviceOutcomes.some((outcome) => outcome.reachable);

    let healthStatus: HealthStatus;
    if (!reachable) {
      healthStatus = "UNREACHABLE";
    } else if (serviceOutcomes.some((outcome) => outcome.status !== "RUNNING")) {
      healthStatus = "DEGRADED";
    } else {
      healthStatus = "ONLINE";
    }

    // Persistencia en paralelo. No se crea un ConnectivityCheck por cada poll:
    // a 15 s por servidor la tabla crecería sin límite. El historial queda para
    // las pruebas manuales de conectividad.
    await Promise.all([
      ...serviceOutcomes.map((outcome) =>
        prisma.serverService.update({
          where: { id: outcome.id },
          data: {
            status: outcome.status,
            lastCheckedAt: checkedAt,
            lastResult: outcome.lastResult,
          },
        })
      ),
      prisma.server.update({
        where: { id: server.id },
        data: {
          healthStatus,
          lastCheckedAt: checkedAt,
          lastSeenAt: reachable ? checkedAt : undefined,
        },
      }),
    ]);

    const outcomeById = new Map(serviceOutcomes.map((outcome) => [outcome.id, outcome]));
    const updatedServices = server.services.map((service) => {
      const outcome = outcomeById.get(service.id);
      if (!outcome) return service;
      return {
        ...service,
        status: outcome.status,
        lastCheckedAt: checkedAt,
        lastResult: outcome.lastResult,
      };
    });

    return this.toSnapshot(server, updatedServices, {
      healthStatus,
      checkedAt,
      reachable,
      durationMs: Date.now() - startedAt,
    });
  }

  /**
   * Determina el estado real de un servicio:
   * - Con endpoint: health check HTTP(S), priorizando el resultado del endpoint.
   * - Con puerto: handshake TCP.
   * - Sin puerto ni endpoint: UNKNOWN explícito (no se inventa un estado).
   */
  private static async probeService(
    server: ServerWithServices,
    service: ServiceRecord
  ): Promise<ServiceProbeOutcome> {
    if (service.endpoint) {
      const result = await HttpProbe.probe({
        url: service.endpoint,
        allowedHosts: [server.ipAddress, ...(server.hostname ? [server.hostname] : [])],
        timeoutMs: SERVICE_TIMEOUT_MS,
      });

      let status: ServiceStatus = "ERROR";
      if (result.status === "SUCCESS") {
        status = "RUNNING";
      } else if (result.status === "REFUSED") {
        status = "STOPPED";
      }

      return {
        id: service.id,
        status,
        lastResult: result.diagnosticSummary,
        // Cualquier respuesta HTTP (incluido 5xx) demuestra que el host está vivo.
        reachable: result.status === "SUCCESS" || result.httpStatus !== undefined,
      };
    }

    if (service.port) {
      const result = await TcpProbe.probe({
        host: server.ipAddress,
        port: service.port,
        timeoutMs: SERVICE_TIMEOUT_MS,
      });

      let status: ServiceStatus = "ERROR";
      if (result.status === "SUCCESS") {
        status = "RUNNING";
      } else if (result.status === "REFUSED") {
        status = "STOPPED";
      }

      return {
        id: service.id,
        status,
        lastResult: result.diagnosticSummary,
        reachable: result.status === "SUCCESS",
      };
    }

    return {
      id: service.id,
      status: "UNKNOWN",
      lastResult:
        "Sin puerto ni endpoint configurado: no es verificable de forma remota sin ejecutar comandos en el servidor.",
      reachable: false,
    };
  }

  private static toSnapshot(
    server: ServerWithServices,
    services: ServiceRecord[],
    state: {
      healthStatus: HealthStatus;
      checkedAt: Date | null;
      reachable: boolean;
      durationMs: number;
    }
  ): ServerMonitorSnapshot {
    return {
      serverId: server.id,
      name: server.name,
      ipAddress: server.ipAddress,
      hostname: server.hostname,
      lifecycleState: server.lifecycleState,
      healthStatus: state.healthStatus,
      globalStatus: deriveGlobalStatus({
        healthStatus: state.healthStatus,
        lifecycleState: server.lifecycleState,
        services,
      }),
      reachable: state.reachable,
      checkedAt: state.checkedAt,
      durationMs: state.durationMs,
      services: services.map((service) => ({
        id: service.id,
        serverId: service.serverId,
        name: service.name,
        description: service.description,
        status: service.status,
        port: service.port,
        endpoint: service.endpoint,
        processName: service.processName,
        lastCheckedAt: service.lastCheckedAt,
        lastResult: service.lastResult,
        updatedAt: service.updatedAt,
      })),
    };
  }
}
