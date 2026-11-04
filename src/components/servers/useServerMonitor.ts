"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type LiveServiceStatus = "RUNNING" | "STOPPED" | "ERROR" | "UNKNOWN";

export interface LiveService {
  id: string;
  serverId: string;
  name: string;
  description: string | null;
  status: LiveServiceStatus;
  port: number | null;
  endpoint: string | null;
  processName: string | null;
  lastCheckedAt: string | null;
  lastResult: string | null;
  updatedAt: string;
}

export interface LiveServerSnapshot {
  serverId: string;
  name: string;
  ipAddress: string;
  hostname: string | null;
  lifecycleState: string;
  healthStatus: string;
  globalStatus: "ONLINE" | "WARNING" | "OFFLINE" | "PENDING";
  reachable: boolean;
  checkedAt: string | null;
  durationMs: number;
  services: LiveService[];
}

interface MonitorResponse {
  generatedAt?: string;
  servers?: LiveServerSnapshot[];
  errors?: Array<{ serverId: string; message: string }>;
}

const DEFAULT_INTERVAL_MS = 15000;

/**
 * Polling optimizado del estado real de servidores y servicios.
 *
 * - No solapa peticiones: cancela la anterior con AbortController.
 * - Se pausa cuando la pestaña no está visible y refresca al volver.
 * - Aplica backoff exponencial (máx. 60 s) si el backend falla.
 * - La coalescencia de sondeos reales vive en el backend.
 */
export function useServerMonitor(
  serverIds: string[],
  options: { intervalMs?: number; enabled?: boolean } = {}
) {
  const { intervalMs = DEFAULT_INTERVAL_MS, enabled = true } = options;

  const [snapshots, setSnapshots] = useState<Record<string, LiveServerSnapshot>>({});
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inFlight = useRef<AbortController | null>(null);
  const idsRef = useRef<string[]>(serverIds);
  idsRef.current = serverIds;
  const idsKey = serverIds.join(",");

  const refresh = useCallback(
    async (force = false): Promise<boolean> => {
      if (!enabled || idsRef.current.length === 0) return true;

      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;
      setIsRefreshing(true);

      try {
        const response = await fetch("/api/v1/servers/monitor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: idsRef.current, force }),
          signal: controller.signal,
          cache: "no-store",
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { message?: string } | null;
          throw new Error(payload?.message ?? `Error ${response.status} al monitorear servidores.`);
        }

        const data = (await response.json()) as MonitorResponse;

        if (!controller.signal.aborted) {
          const incoming = Array.isArray(data.servers) ? data.servers : [];
          setSnapshots((previous) => {
            const next = { ...previous };
            for (const snapshot of incoming) {
              next[snapshot.serverId] = snapshot;
            }
            return next;
          });
          setLastUpdatedAt(data.generatedAt ? new Date(data.generatedAt) : new Date());
          setError(null);
        }

        return true;
      } catch (caught: unknown) {
        // Un abort es el resultado esperado de un refresco más reciente.
        if (controller.signal.aborted) return true;
        setError(caught instanceof Error ? caught.message : String(caught));
        return false;
      } finally {
        if (inFlight.current === controller) {
          inFlight.current = null;
          setIsRefreshing(false);
        }
      }
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled || idsRef.current.length === 0) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;

    const schedule = (delay: number) => {
      if (cancelled) return;
      timer = setTimeout(run, delay);
    };

    const run = async () => {
      if (cancelled) return;

      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        schedule(intervalMs);
        return;
      }

      const ok = await refresh();
      if (cancelled) return;

      failures = ok ? 0 : Math.min(failures + 1, 4);
      schedule(ok ? intervalMs : Math.min(intervalMs * 2 ** failures, 60000));
    };

    const onVisibilityChange = () => {
      if (cancelled || document.visibilityState !== "visible") return;
      if (timer) clearTimeout(timer);
      void run();
    };

    void run();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      inFlight.current?.abort();
    };
    // idsKey reinicia el ciclo cuando cambia el conjunto de servidores visible.
  }, [enabled, intervalMs, refresh, idsKey]);

  return { snapshots, lastUpdatedAt, isRefreshing, error, refresh };
}
