import { getEnv } from "@/shared/env";
import {
  resolveMonitorIntervalMs,
  summarizeMonitorRun,
  type MonitorRunSummary,
} from "@/core/domain/monitor-schedule";
import { ServerMonitoringService } from "./server-monitoring.service";

/**
 * Clave en `globalThis`: sobrevive al HMR de `next dev` y evita registrar dos
 * intervalos si el módulo se evalúa más de una vez.
 */
const SCHEDULER_STATE_KEY = Symbol.for("nuevo-sis.server-monitor-scheduler");

interface SchedulerState {
  timer: ReturnType<typeof setInterval> | null;
  running: boolean;
  intervalMs: number;
  startedAt: Date | null;
  lastRunAt: Date | null;
  lastSummary: MonitorRunSummary | null;
  lastError: string | null;
}

export interface SchedulerStatus {
  enabled: boolean;
  active: boolean;
  intervalMs: number;
  running: boolean;
  startedAt: Date | null;
  lastRunAt: Date | null;
  lastSummary: MonitorRunSummary | null;
  lastError: string | null;
}

function getState(): SchedulerState {
  const globalRef = globalThis as typeof globalThis & Record<symbol, unknown>;
  const existing = globalRef[SCHEDULER_STATE_KEY] as SchedulerState | undefined;
  if (existing) return existing;

  const state: SchedulerState = {
    timer: null,
    running: false,
    intervalMs: 0,
    startedAt: null,
    lastRunAt: null,
    lastSummary: null,
    lastError: null,
  };
  globalRef[SCHEDULER_STATE_KEY] = state;
  return state;
}

function buildStatus(state: SchedulerState, enabled: boolean): SchedulerStatus {
  return {
    enabled,
    active: state.timer !== null,
    intervalMs: state.intervalMs,
    running: state.running,
    startedAt: state.startedAt,
    lastRunAt: state.lastRunAt,
    lastSummary: state.lastSummary,
    lastError: state.lastError,
  };
}

function isEnabled(): boolean {
  return getEnv().MONITOR_SCHEDULER_ENABLED === "true";
}

/**
 * Arranca el sondeo periódico en segundo plano.
 *
 * Pensado para desplegamientos con proceso persistente (`next start` /
 * standalone). El primer tick corre de inmediato para que los estados no
 * esperen al primer intervalo; los siguientes se solapan con seguridad porque
 * una pasada en curso hace que la siguiente se omita.
 */
export function startServerMonitorScheduler(): SchedulerStatus {
  const state = getState();
  const enabled = isEnabled();

  if (!enabled) {
    return buildStatus(state, enabled);
  }

  if (state.timer) {
    return buildStatus(state, enabled);
  }

  const intervalMs = resolveMonitorIntervalMs(getEnv().MONITOR_INTERVAL_MS);
  state.intervalMs = intervalMs;
  state.startedAt = new Date();

  const timer = setInterval(() => {
    void runMonitorTick();
  }, intervalMs);
  // No mantener vivo el proceso solo por el intervalo (relevante en tests/CI).
  timer.unref?.();
  state.timer = timer;

  console.info(`[monitor] scheduler activo: una pasada cada ${intervalMs} ms`);
  void runMonitorTick();

  return buildStatus(state, enabled);
}

export function stopServerMonitorScheduler(): SchedulerStatus {
  const state = getState();
  if (state.timer) {
    clearInterval(state.timer);
    state.timer = null;
  }
  state.startedAt = null;
  return buildStatus(state, isEnabled());
}

export function getServerMonitorSchedulerStatus(): SchedulerStatus {
  return buildStatus(getState(), isEnabled());
}

/**
 * Una pasada completa. Nunca propaga errores: un fallo de red o de base de
 * datos debe registrarse y dejar que el siguiente intervalo lo reintente.
 */
async function runMonitorTick(): Promise<void> {
  const state = getState();
  if (state.running) return;

  state.running = true;
  const startedAt = Date.now();

  try {
    const result = await ServerMonitoringService.monitorAllActiveServers();
    const summary = summarizeMonitorRun(result, Date.now() - startedAt);

    state.lastRunAt = new Date();
    state.lastSummary = summary;
    state.lastError = null;

    console.info(
      `[monitor] ${summary.total} servidores · ${summary.online} online · ${summary.warning} warning · ` +
        `${summary.offline} offline · ${summary.pending} pendientes · ${summary.errors} errores · ` +
        `${summary.durationMs} ms`
    );
  } catch (error: unknown) {
    state.lastError = error instanceof Error ? error.message : String(error);
    state.lastRunAt = new Date();
    console.error("[monitor] pasada fallida:", error);
  } finally {
    state.running = false;
  }
}
