"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Cloud,
  Database,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  RefreshCw,
  Server,
  Shield,
} from "lucide-react";
import { ServerGrid } from "@/components/servers/ServerGrid";
import { ServerTable } from "@/components/servers/ServerTable";
import {
  ServerFilters,
  filterServers,
  INITIAL_SERVER_FILTERS,
  type ServerFiltersState,
} from "@/components/servers/ServerFilters";
import { useServerMonitor } from "@/components/servers/useServerMonitor";
import { onCatalogChange } from "@/lib/catalog-events";
import type { ServerListItem } from "@/components/servers/server-list-item";

export default function ServersPage() {
  const [servers, setServers] = useState<ServerListItem[]>([]);
  const [filters, setFilters] = useState<ServerFiltersState>(INITIAL_SERVER_FILTERS);
  const [view, setView] = useState<"grid" | "table">("grid");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServers = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/servers?limit=100", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("No se pudo cargar el catálogo de servidores");
      }
      const data = await response.json();
      setServers(Array.isArray(data.items) ? data.items : []);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchServers(true);

    // Refresco automático cuando otra vista (alta, retire, ciclo de vida)
    // notifica un cambio en el catálogo.
    const unsubscribe = onCatalogChange(() => {
      void fetchServers();
      void refresh(true);
    });
    return unsubscribe;
  }, [fetchServers]);

  const serverIds = useMemo(() => servers.map((server) => server.id), [servers]);
  const {
    snapshots,
    lastUpdatedAt,
    isRefreshing,
    error: monitorError,
    refresh,
  } = useServerMonitor(serverIds, {
    intervalMs: 15000,
    enabled: serverIds.length > 0,
  });

  /**
   * Combina la lista persistida con el último sondeo real. El sondeo manda sobre
   * `healthStatus`, conteos y `lastCheckedAt` para que la tarjeta refleje el
   * estado vivo sin esperar a recargar la página.
   */
  const liveServers = useMemo<ServerListItem[]>(() => {
    return servers.map((server) => {
      const snapshot = snapshots[server.id];
      if (!snapshot) return server;

      const servicesRunning = snapshot.services.filter((service) => service.status === "RUNNING").length;
      const servicesDown = snapshot.services.filter(
        (service) => service.status === "STOPPED" || service.status === "ERROR"
      ).length;
      const servicesUnknown = snapshot.services.filter((service) => service.status === "UNKNOWN").length;

      return {
        ...server,
        healthStatus: snapshot.healthStatus,
        globalStatus: snapshot.globalStatus,
        serviceCount: snapshot.services.length,
        servicesRunning,
        servicesDown,
        servicesUnknown,
        lastCheckedAt: snapshot.checkedAt ?? server.lastCheckedAt,
      };
    });
  }, [servers, snapshots]);

  const filteredServers = useMemo(
    () => filterServers(liveServers, filters),
    [liveServers, filters]
  );

  const totalVisibleServers = useMemo(() => {
    // Para métricas mostramos solo los no retirados, salvo que el usuario pida ver retirados
    const base = filters.showRetired ? liveServers : liveServers.filter(s => s.lifecycleState !== "RETIRED");
    return base.length;
  }, [liveServers, filters.showRetired]);

  const metrics = useMemo(() => {
    const base = filters.showRetired ? liveServers : liveServers.filter(s => s.lifecycleState !== "RETIRED");
    return {
      total: base.length,
      online: base.filter((server) => server.globalStatus === "ONLINE").length,
      warning: base.filter((server) => server.globalStatus === "WARNING").length,
      offline: base.filter((server) => server.globalStatus === "OFFLINE").length,
      prod: base.filter((server) => server.environment === "PROD").length,
    };
  }, [liveServers, filters.showRetired]);

  const metricCards = [
    {
      label: "Total de Servidores",
      value: metrics.total,
      icon: Server,
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-600",
      detail: null,
    },
    {
      label: "En Línea",
      value: metrics.online,
      icon: Activity,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      detail: `${Math.round((metrics.online / Math.max(metrics.total, 1)) * 100)}% del total`,
    },
    {
      label: "Warnings",
      value: metrics.warning,
      icon: AlertTriangle,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      detail: "Servicios caídos o degradados",
    },
    {
      label: "Sin Conexión",
      value: metrics.offline,
      icon: Shield,
      iconBg: "bg-rose-50",
      iconColor: "text-rose-600",
      detail: "Fallos de red o timeout",
    },
  ];

  const handleRefresh = async () => {
    await Promise.all([fetchServers(), refresh(true)]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-indigo-600 p-2.5 shadow-medium">
                <Server className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Panel de Servidores
              </h1>
            </div>
            <p className="ml-[52px] text-sm text-slate-600">
              Monitoreo centralizado en tiempo real de infraestructura, conectividad y servicios.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-soft">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500" />
              </span>
              {lastUpdatedAt
                ? `Actualizado ${lastUpdatedAt.toLocaleTimeString("es-ES")}`
                : "Esperando primer sondeo"}
              {isRefreshing && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />}
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-soft transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Actualizar
            </button>

            <Link
              href="/servers/new"
              className="group inline-flex w-fit items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-medium transition hover:bg-indigo-700 hover:shadow-large"
            >
              <Plus className="h-4 w-4 transition-transform duration-200 group-hover:rotate-90" />
              Registrar Servidor
            </Link>
          </div>
        </div>

        {(error || monitorError) && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 shadow-soft">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Error de monitoreo</p>
              <p className="mt-0.5 text-rose-700">{error ?? monitorError}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {metricCards.map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-soft transition-shadow duration-200 hover:shadow-medium"
              >
                <div className="relative flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                      {metric.label}
                    </p>
                    <p className="mt-2 text-3xl font-bold text-slate-900">{metric.value}</p>
                    {metric.detail && <p className="mt-1 text-xs text-slate-500">{metric.detail}</p>}
                  </div>
                  <div className={`rounded-xl p-3 ${metric.iconBg}`}>
                    <Icon className={`h-5 w-5 ${metric.iconColor}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-soft">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <Database className="h-5 w-5 text-slate-600" />
              Distribución por Entorno
            </h2>
            <span className="text-sm text-slate-500">{metrics.prod} servidores en Producción</span>
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: "Producción", value: liveServers.filter((s) => s.environment === "PROD").length, bar: "bg-rose-500", track: "bg-rose-100" },
              { label: "Staging", value: liveServers.filter((s) => s.environment === "STAGING").length, bar: "bg-amber-500", track: "bg-amber-100" },
              { label: "Desarrollo", value: liveServers.filter((s) => s.environment === "DEV").length, bar: "bg-sky-500", track: "bg-sky-100" },
              { label: "QA", value: liveServers.filter((s) => s.environment === "QA").length, bar: "bg-violet-500", track: "bg-violet-100" },
            ].map((environment) => (
              <div
                key={environment.label}
                className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center"
              >
                <p className="text-2xl font-bold text-slate-900">{environment.value}</p>
                <p className="mt-1 text-xs font-medium text-slate-600">{environment.label}</p>
                <div className={`mt-3 h-1.5 w-full overflow-hidden rounded-full ${environment.track}`}>
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${environment.bar}`}
                    style={{
                      width: `${Math.max(
                        (environment.value / Math.max(metrics.total, 1)) * 100,
                        5
                      )}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white p-6 sm:flex-row sm:items-center">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
                <Cloud className="h-5 w-5 text-slate-600" />
                Catálogo de Servidores
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                El estado se actualiza automáticamente cada 15 segundos con sondeos reales.
              </p>
            </div>

            <div className="inline-flex rounded-xl border border-slate-300 bg-white p-1 shadow-soft">
              <button
                onClick={() => setView("grid")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  view === "grid"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Tarjetas
              </button>
              <button
                onClick={() => setView("table")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  view === "table"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <List className="h-3.5 w-3.5" />
                Tabla
              </button>
            </div>
          </div>

          <ServerFilters
            filters={filters}
            onChange={setFilters}
            onRefresh={handleRefresh}
            isLoading={isRefreshing || loading}
            resultCount={filteredServers.length}
            totalCount={liveServers.length}
          />

          <div className="p-6">
            {loading && liveServers.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              </div>
            ) : view === "grid" ? (
              <ServerGrid servers={filteredServers} />
            ) : (
              <ServerTable servers={filteredServers} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
