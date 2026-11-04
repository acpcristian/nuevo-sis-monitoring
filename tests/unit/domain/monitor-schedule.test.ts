import { describe, it, expect } from "vitest";
import {
  DEFAULT_MONITOR_INTERVAL_MS,
  MAX_MONITOR_INTERVAL_MS,
  MIN_MONITOR_INTERVAL_MS,
  resolveMonitorIntervalMs,
  summarizeMonitorRun,
} from "@/core/domain/monitor-schedule";

describe("Programación del monitoreo periódico", () => {
  it("usa el intervalo por defecto cuando no hay configuración válida", () => {
    expect(resolveMonitorIntervalMs(undefined)).toBe(DEFAULT_MONITOR_INTERVAL_MS);
    expect(resolveMonitorIntervalMs(0)).toBe(DEFAULT_MONITOR_INTERVAL_MS);
    expect(resolveMonitorIntervalMs(Number.NaN)).toBe(DEFAULT_MONITOR_INTERVAL_MS);
  });

  it("recorta el intervalo al rango seguro en lugar de romper el arranque", () => {
    expect(resolveMonitorIntervalMs(1_000)).toBe(MIN_MONITOR_INTERVAL_MS);
    expect(resolveMonitorIntervalMs(MAX_MONITOR_INTERVAL_MS * 4)).toBe(MAX_MONITOR_INTERVAL_MS);
    expect(resolveMonitorIntervalMs(30_000)).toBe(30_000);
  });

  it("resume una pasada contando cada estado global y los errores", () => {
    const summary = summarizeMonitorRun(
      {
        servers: [
          { globalStatus: "ONLINE" },
          { globalStatus: "ONLINE" },
          { globalStatus: "WARNING" },
          { globalStatus: "OFFLINE" },
          { globalStatus: "PENDING" },
        ],
        errors: [{ serverId: "srv-1", message: "fallo" }],
      },
      1234.9
    );

    expect(summary).toEqual({
      total: 5,
      online: 2,
      warning: 1,
      offline: 1,
      pending: 1,
      errors: 1,
      durationMs: 1234,
    });
  });

  it("resume una pasada vacía sin inventar estados", () => {
    expect(summarizeMonitorRun({ servers: [], errors: [] }, -5)).toEqual({
      total: 0,
      online: 0,
      warning: 0,
      offline: 0,
      pending: 0,
      errors: 0,
      durationMs: 0,
    });
  });
});
