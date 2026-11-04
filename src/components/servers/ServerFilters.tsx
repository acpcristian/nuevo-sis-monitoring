"use client";

import React from "react";
import { Activity, Filter, Layers, RefreshCw, Search } from "lucide-react";
import type { ServerListItem } from "./server-list-item";

export interface ServerFiltersState {
  search: string;
  environment: string;
  osType: string;
  status: string;
  showRetired: boolean;
}

export const INITIAL_SERVER_FILTERS: ServerFiltersState = {
  search: "",
  environment: "ALL",
  osType: "ALL",
  status: "ALL",
  showRetired: false,
};

/** Filtrado reactivo en memoria compartido por la grilla y la tabla. */
export function filterServers(
  servers: ServerListItem[],
  filters: ServerFiltersState
): ServerListItem[] {
  const term = filters.search.trim().toLowerCase();

  return servers.filter((server) => {
    // Excluir retirados por defecto
    if (!filters.showRetired && server.lifecycleState === "RETIRED") {
      return false;
    }

    const matchesSearch =
      term.length === 0 ||
      server.name.toLowerCase().includes(term) ||
      server.ipAddress.toLowerCase().includes(term) ||
      (server.hostname ?? "").toLowerCase().includes(term);

    const matchesEnvironment =
      filters.environment === "ALL" || server.environment === filters.environment;
    const matchesOs = filters.osType === "ALL" || server.osType === filters.osType;
    const matchesStatus =
      filters.status === "ALL" ||
      server.healthStatus === filters.status ||
      server.lifecycleState === filters.status ||
      server.globalStatus === filters.status;

    return matchesSearch && matchesEnvironment && matchesOs && matchesStatus;
  });
}

interface ServerFiltersProps {
  filters: ServerFiltersState;
  onChange: (filters: ServerFiltersState) => void;
  onRefresh: () => void;
  isLoading?: boolean;
  resultCount: number;
  totalCount: number;
}

export function ServerFilters({
  filters,
  onChange,
  onRefresh,
  isLoading,
  resultCount,
  totalCount,
}: ServerFiltersProps) {
  return (
    <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white p-5">
      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-center">
        <div className="relative w-full lg:w-96">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={filters.search}
            onChange={(event) => onChange({ ...filters, search: event.target.value })}
            placeholder="Buscar por nombre, IP o hostname..."
            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm shadow-soft transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex w-full flex-wrap items-center gap-3 lg:w-auto">
          <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm shadow-soft">
            <Filter className="h-4 w-4 text-slate-500" />
            <select
              value={filters.environment}
              onChange={(event) => onChange({ ...filters, environment: event.target.value })}
              className="cursor-pointer bg-transparent font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">Todos los entornos</option>
              <option value="PROD">Producción</option>
              <option value="STAGING">Staging</option>
              <option value="DEV">Desarrollo</option>
              <option value="QA">QA</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs">
            <Layers className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={filters.osType}
              onChange={(event) => onChange({ ...filters, osType: event.target.value })}
              className="cursor-pointer bg-transparent font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">Todos los SO</option>
              <option value="LINUX">Linux</option>
              <option value="WINDOWS">Windows Server</option>
              <option value="OTHER">Otros</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs">
            <Activity className="h-3.5 w-3.5 text-slate-500" />
            <select
              value={filters.status}
              onChange={(event) => onChange({ ...filters, status: event.target.value })}
              className="cursor-pointer bg-transparent font-medium text-slate-700 focus:outline-none"
            >
              <option value="ALL">Cualquier Estado</option>
              <option value="ONLINE">En Línea</option>
              <option value="WARNING">Warning</option>
              <option value="OFFLINE">Offline</option>
              <option value="DEGRADED">Degradado</option>
              <option value="UNREACHABLE">Inalcanzable</option>
              <option value="AUTH_FAILED">Error de Auth</option>
              <option value="MAINTENANCE">Mantenimiento</option>
              <option value="DISABLED">Deshabilitado</option>
              <option value="RETIRED">Retirado</option>
            </select>
          </div>

          <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 shadow-soft">
            <input
              type="checkbox"
              checked={filters.showRetired}
              onChange={(e) => onChange({ ...filters, showRetired: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Mostrar retirados
          </label>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            title="Refrescar y volver a monitorear"
            className="rounded-lg border border-slate-300 bg-white p-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Mostrando <span className="font-semibold text-slate-900">{resultCount}</span> de{" "}
        <span className="font-semibold text-slate-900">{totalCount}</span> servidores registrados
      </p>
    </div>
  );
}
