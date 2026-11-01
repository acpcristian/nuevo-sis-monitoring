import { prisma } from "@/infrastructure/db/prisma";
import { getEnv } from "@/shared/env";

export interface FreshnessThresholds {
  /** Minutos sin telemetría antes de marcar STALE (default: 5) */
  staleAfterMinutes: number;
  /** Minutos sin respuesta del agente antes de marcar AGENT_DISCONNECTED (default: 15) */
  disconnectedAfterMinutes: number;
}

const DEFAULT_THRESHOLDS: FreshnessThresholds = {
  staleAfterMinutes: 5,
  disconnectedAfterMinutes: 15,
};

export class FreshnessService {
  /**
   * Calcula y actualiza el estado de frescura de un servidor basándose en
   * la última telemetría recibida. Implementa el Principio VIII:
   * la ausencia de telemetría NUNCA se interpreta como salud satisfactoria.
   */
  public static computeFreshness(
    lastTelemetryAt: Date | null,
    now: Date = new Date(),
    thresholds: FreshnessThresholds = DEFAULT_THRESHOLDS
  ): "FRESH" | "STALE" | "AGENT_DISCONNECTED" | "UNREACHABLE" {
    if (!lastTelemetryAt) {
      return "STALE";
    }

    const ageMs = now.getTime() - lastTelemetryAt.getTime();
    const ageMinutes = ageMs / (60 * 1000);

    if (ageMinutes <= thresholds.staleAfterMinutes) {
      return "FRESH";
    }

    if (ageMinutes <= thresholds.disconnectedAfterMinutes) {
      return "STALE";
    }

    return "AGENT_DISCONNECTED";
  }

  /**
   * Devuelve los estados de frescura de todos los servidores con telemetría.
   * Los servidores sin registro de frescura se devuelven como STALE.
   */
  public static async listFreshnessStates(params?: {
    serverId?: string;
    state?: "FRESH" | "STALE" | "AGENT_DISCONNECTED" | "UNREACHABLE";
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
        server: { select: { id: true, name: true, ipAddress: true, healthStatus: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
    });

    return items.map((item) => ({
      id: item.id,
      serverId: item.serverId,
      serverName: item.server?.name ?? null,
      serverIp: item.server?.ipAddress ?? null,
      serverHealth: item.server?.healthStatus ?? null,
      freshnessState: item.freshnessState as
        | "FRESH"
        | "STALE"
        | "AGENT_DISCONNECTED"
        | "UNREACHABLE",
      lastTelemetryAt: item.lastTelemetryAt,
      updatedAt: item.updatedAt,
    }));
  }

  /**
   * Marca un servidor como UNREACHABLE cuando falla la conectividad de red.
   */
  public static async markUnreachable(serverId: string) {
    return prisma.dataFreshnessState.upsert({
      where: { serverId },
      update: {
        freshnessState: "UNREACHABLE",
        lastTelemetryAt: null,
        updatedAt: new Date(),
      },
      create: {
        serverId,
        freshnessState: "UNREACHABLE",
        lastTelemetryAt: null,
      },
    });
  }

  /**
   * Actualiza el estado de frescura de todos los servidores según la última telemetría.
   * Se ejecuta periódicamente (ej. cada minuto) para detectar datos caducos.
   */
  public static async refreshAllFreshness(
    thresholds: FreshnessThresholds = DEFAULT_THRESHOLDS
  ): Promise<number> {
    const now = new Date();
    const staleThreshold = new Date(
      now.getTime() - thresholds.staleAfterMinutes * 60 * 1000
    );
    const disconnectedThreshold = new Date(
      now.getTime() - thresholds.disconnectedAfterMinutes * 60 * 1000
    );

    // Servidores que están FRESH pero ya no reciben telemetría → STALE
    const toStale = await prisma.dataFreshnessState.updateMany({
      where: {
        freshnessState: "FRESH",
        lastTelemetryAt: { lt: staleThreshold },
      },
      data: { freshnessState: "STALE", updatedAt: now },
    });

    // Servidores que están STALE y llevan mucho sin telemetría → AGENT_DISCONNECTED
    const toDisconnected = await prisma.dataFreshnessState.updateMany({
      where: {
        freshnessState: "STALE",
        lastTelemetryAt: { lt: disconnectedThreshold },
      },
      data: { freshnessState: "AGENT_DISCONNECTED", updatedAt: now },
    });

    return toStale.count + toDisconnected.count;
  }
}