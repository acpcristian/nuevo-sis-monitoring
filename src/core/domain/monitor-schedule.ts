import type { GlobalServerStatus } from "./server.types";

/** Intervalo mínimo aceptado para no saturar la red con sondeos. */
export const MIN_MONITOR_INTERVAL_MS = 15_000;
/** Intervalo máximo: una hora. */
export const MAX_MONITOR_INTERVAL_MS = 3_600_000;
/** Valor por defecto si el entorno no define `MONITOR_INTERVAL_MS`. */
export const DEFAULT_MONITOR_INTERVAL_MS = 60_000;

export interface MonitorRunInput {
  servers: ReadonlyArray<{ globalStatus: GlobalServerStatus }>;
  errors: ReadonlyArray<unknown>;
}

export interface MonitorRunSummary {
  total: number;
  online: number;
  warning: number;
  offline: number;
  pending: number;
  errors: number;
  durationMs: number;
}

/**
 * Normaliza el intervalo configurado. Un valor fuera de rango se recorta en vez
 * de romper el arranque: un scheduler demasiado agresivo degradaría la red y uno
 * con `0` se desactivaría silenciosamente.
 */
export function resolveMonitorIntervalMs(raw: number | undefined): number {
  if (!raw || !Number.isFinite(raw) || raw <= 0) return DEFAULT_MONITOR_INTERVAL_MS;
  return Math.min(Math.max(Math.trunc(raw), MIN_MONITOR_INTERVAL_MS), MAX_MONITOR_INTERVAL_MS);
}

/** Resumen de una pasada, pensado para el log del scheduler. */
export function summarizeMonitorRun(
  result: MonitorRunInput,
  durationMs: number
): MonitorRunSummary {
  const summary: MonitorRunSummary = {
    total: result.servers.length,
    online: 0,
    warning: 0,
    offline: 0,
    pending: 0,
    errors: result.errors.length,
    durationMs: Math.max(0, Math.trunc(durationMs)),
  };

  for (const server of result.servers) {
    switch (server.globalStatus) {
      case "ONLINE":
        summary.online += 1;
        break;
      case "WARNING":
        summary.warning += 1;
        break;
      case "OFFLINE":
        summary.offline += 1;
        break;
      case "PENDING":
        summary.pending += 1;
        break;
    }
  }

  return summary;
}
