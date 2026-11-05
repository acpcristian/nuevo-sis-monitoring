"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  Server,
  Shield,
} from "lucide-react";
import { ServerStatusBadge } from "@/components/servers/ServerStatusBadge";
import { ServerForm } from "@/components/servers/ServerForm";
import { useServerMonitor } from "@/components/servers/useServerMonitor";
import { onCatalogChange } from "@/lib/catalog-events";
import type { ServerListItem } from "@/components/servers/server-list-item";

/**
 * Inventario institucional de servidores organizado por Secretarías
 * municipales. Las secretarías se derivan de la etiqueta `secretaria` del
 * catálogo (sin cambios de esquema); la vista general muestra los
 * contenedores y la vista interna la tabla de servidores de cada uno.
 */

/** Grupo de secretaría tal como lo entrega GET /api/v1/secretarias. */
interface SecretariaGroup {
  id: string; // valor del tag `secretaria` o "_sin_secretaria"
  name: string;
  /** Valores de etiqueta que pertenecen al grupo (oficial + históricos). */
  names?: string[];
  total: number;
  ok: number;
  warn: number;
  down: number;
  serverIds: string[];
}

type StatusFilter = "ALL" | "OK" | "WARN" | "DOWN";

interface FiltersState {
  search: string;
  secretaria: string; // id del contenedor (valor del tag) o "ALL"
  status: StatusFilter;
  showRetired: boolean;
}

const INITIAL_FILTERS: FiltersState = {
  search: "",
  secretaria: "ALL",
  status: "ALL",
  showRetired: false,
};

const SECRETARIA_TAG = "secretaria";
const UNTAGGED_LABEL = "Sin secretaría asignada";
/** Identificador del grupo de servidores sin etiqueta de secretaría. */
const UNTAGGED_ID = "_sin_secretaria";

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "Todos" },
  { value: "OK", label: "Operativo" },
  { value: "WARN", label: "Con advertencia" },
  { value: "DOWN", label: "Sin conexión" },
];

function normalizedTagKey(key: string): string {
  return key.trim().toLowerCase().replace(/í/g, "i");
}

/** Clave de comparación de nombres de secretaría: mayúsculas, sin acentos. */
function normalizedGroupKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function secretariaOf(server: ServerListItem): string {
  const tag = server.tags?.find((tag) => normalizedTagKey(tag.key) === SECRETARIA_TAG);
  return tag?.value?.trim() ?? UNTAGGED_LABEL;
}

function statusOf(server: ServerListItem): "OK" | "WARN" | "DOWN" | "PENDING" {
  switch (server.globalStatus) {
    case "ONLINE":
      return "OK";
    case "WARNING":
      return "WARN";
    case "OFFLINE":
      return "DOWN";
    default:
      return "PENDING";
  }
}

function matchesStatus(server: ServerListItem, status: StatusFilter): boolean {
  if (status === "ALL") return true;
  const serverStatus = statusOf(server);
  if (serverStatus === "PENDING") return false;
  return serverStatus === status;
}

function matchesSearch(server: ServerListItem, term: string): boolean {
  return (
    term.length === 0 ||
    server.name.toLowerCase().includes(term) ||
    server.ipAddress.toLowerCase().includes(term) ||
    (server.hostname ?? "").toLowerCase().includes(term) ||
    secretariaOf(server).toLowerCase().includes(term)
  );
}

interface StatCard {
  label: string;
  value: number;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
}

const ENV_LABEL: Record<string, string> = {
  PROD: "Producción",
  STAGING: "Staging",
  DEV: "Desarrollo",
  QA: "QA",
};

/** Servicio principal declarado en la etiqueta `servicio` (si existe). */
function servicioOf(server: ServerListItem): string | null {
  const tag = server.tags?.find((tag) => normalizedTagKey(tag.key) === "servicio");
  return tag?.value?.trim() ?? null;
}

const OS_LABEL: Record<string, string> = {
  WINDOWS: "Windows Server",
  LINUX: "Linux",
  OTHER: "Otro",
};

export default function ServersPage() {
  const [servers, setServers] = useState<ServerListItem[]>([]);
  const [secretariaGroups, setSecretariaGroups] = useState<SecretariaGroup[] | null>(null);
  const [secretariaError, setSecretariaError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FiltersState>(INITIAL_FILTERS);
  const [selectedSecretaria, setSelectedSecretaria] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
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

  /**
   * Contenedores de secretarías desde el backend (agregado por etiqueta).
   * La lista —y sus conteos de estado— solo proviene de la API.
   */
  const fetchSecretarias = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/secretarias", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("No se pudieron cargar las secretarías municipales");
      }
      const data = await response.json();
      setSecretariaGroups(Array.isArray(data.items) ? data.items : []);
      setSecretariaError(null);
    } catch (caught: unknown) {
      setSecretariaError(caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  useEffect(() => {
    void fetchServers(true);
    void fetchSecretarias();
    // Refresco automático cuando otra vista (alta, retire, ciclo de vida)
    // notifica un cambio en el catálogo.
    const unsubscribe = onCatalogChange(() => {
      void fetchServers();
      void fetchSecretarias();
    });
    return unsubscribe;
  }, [fetchServers, fetchSecretarias]);

  // Sincronización periódica de los agregados de secretarías (60 s).
  useEffect(() => {
    const timer = setInterval(() => void fetchSecretarias(), 60_000);
    return () => clearInterval(timer);
  }, [fetchSecretarias]);

  const serverIds = useMemo(() => servers.map((server) => server.id), [servers]);
  const {
    lastUpdatedAt,
    isRefreshing,
    error: monitorError,
    refresh,
  } = useServerMonitor(serverIds, {
    intervalMs: 15000,
    enabled: serverIds.length > 0,
  });

  /** Base visible (excluye retirados salvo petición explícita). */
  const baseServers = useMemo(
    () =>
      filters.showRetired
        ? servers
        : servers.filter((server) => server.lifecycleState !== "RETIRED"),
    [servers, filters.showRetired]
  );

  /** Filtro combinado: búsqueda + estado (la secretaría se aplica al grid). */
  const searchedServers = useMemo(() => {
    const term = filters.search.trim().toLowerCase();
    return baseServers.filter(
      (server) => matchesSearch(server, term) && matchesStatus(server, filters.status)
    );
  }, [baseServers, filters]);

  const searchedServerIds = useMemo(
    () => new Set(searchedServers.map((server) => server.id)),
    [searchedServers]
  );
  const serverById = useMemo(
    () => new Map(servers.map((server) => [server.id, server])),
    [servers]
  );

  /** ¿El servidor pertenece al contenedor de secretaría indicado? */
  const belongsToGroup = useCallback((server: ServerListItem, groupId: string): boolean => {
    if (groupId === UNTAGGED_ID) return secretariaOf(server) === UNTAGGED_LABEL;
    // El valor del tag puede ser su nombre oficial o un alias histórico:
    // compara por clave normalizada contra los nombres de todo el grupo.
    const tagKey = normalizedGroupKey(secretariaOf(server));
    const group = secretariaGroups?.find((candidate) => candidate.id === groupId);
    const candidates = [groupId, ...(group?.names ?? [])].map((name) => normalizedGroupKey(name));
    return candidates.includes(tagKey);
  }, [secretariaGroups]);

  /** Búsqueda o filtrado por estado activo (el grid intersecta entonces en cliente). */
  const activeFilters = filters.search.trim().length > 0 || filters.status !== "ALL";

  /**
   * Grupos visibles: lista oficial del backend (GET /api/v1/secretarias). Sin
   * filtros se muestran sus conteos; con búsqueda/estado se intersectan los
   * servidores coincidentes contra cada grupo.
   */
  const visibleGroups = useMemo(() => {
    if (!secretariaGroups) return [];
    return secretariaGroups
      .filter((group) => filters.secretaria === "ALL" || group.id === filters.secretaria)
      .flatMap((group) => {
        if (!activeFilters) {
          return [group];
        }
        const matched = group.serverIds
          .filter((id) => searchedServerIds.has(id))
          .map((id) => serverById.get(id))
          .filter((server): server is ServerListItem => Boolean(server));
        if (matched.length === 0) return [];
        return [
          {
            ...group,
            total: matched.length,
            ok: matched.filter((s) => statusOf(s) === "OK").length,
            warn: matched.filter((s) => statusOf(s) === "WARN").length,
            down: matched.filter((s) => statusOf(s) === "DOWN").length,
          },
        ];
      });
  }, [secretariaGroups, filters.secretaria, activeFilters, searchedServerIds, serverById]);

  /** Servidores del ámbito actual (general: todos; interno: la secretaría). */
  const scopeServers = useMemo(
    () =>
      selectedSecretaria
        ? searchedServers.filter((server) => belongsToGroup(server, selectedSecretaria))
        : searchedServers,
    [searchedServers, selectedSecretaria, belongsToGroup]
  );

  const totalVisible = baseServers.length;
  const serversInVisibleGroups = useMemo(
    () => visibleGroups.reduce((sum, group) => sum + group.total, 0),
    [visibleGroups]
  );
  const stats = useMemo(() => {
    const total = scopeServers.length;
    const ok = scopeServers.filter((s) => statusOf(s) === "OK").length;
    const warn = scopeServers.filter((s) => statusOf(s) === "WARN").length;
    const down = scopeServers.filter((s) => statusOf(s) === "DOWN").length;
    return { total, ok, warn, down };
  }, [scopeServers]);

  const statCards: StatCard[] = [
    {
      label: "Total de servidores",
      value: stats.total,
      detail: selectedSecretaria
        ? "En esta secretaría"
        : (() => {
            const conServidores = (secretariaGroups ?? []).filter((group) => group.total > 0).length;
            return `En ${conServidores} secretaría${conServidores === 1 ? "" : "s"}`;
          })(),
      icon: Server,
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-600",
    },
    {
      label: "Operativos",
      value: stats.ok,
      detail: "Funcionando con normalidad",
      icon: Activity,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
    },
    {
      label: "Con advertencias",
      value: stats.warn,
      detail: "Requieren revisión",
      icon: AlertTriangle,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
    },
    {
      label: "Sin conexión",
      value: stats.down,
      detail: "Atención inmediata",
      icon: Shield,
      iconBg: "bg-rose-50",
      iconColor: "text-rose-600",
    },
  ];

  const secretariaOptions = useMemo(() => {
    // Nombres oficiales desde el backend (una opción por contenedor).
    return (secretariaGroups ?? [])
      .filter((group) => group.id !== UNTAGGED_ID)
      .map((group) => group.name);
  }, [secretariaGroups]);

  const handleOpenSecretaria = (groupId: string) => {
    setFilters((current) => ({ ...current, search: "" }));
    setSelectedSecretaria(groupId);
  };

  const handleBack = () => {
    setFilters((current) => ({ ...current, search: "" }));
    setSelectedSecretaria(null);
  };

  const handleClearFilters = () => {
    setFilters(INITIAL_FILTERS);
  };

  const handleServerCreated = () => {
    void fetchServers();
    void fetchSecretarias();
    setModalOpen(false);
    setToast("Servidor registrado correctamente");
  };

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleRefresh = async () => {
    await Promise.all([fetchServers(), fetchSecretarias()]);
    await refresh(true);
  };

  const isInside = selectedSecretaria !== null;

  // Nombre legible del contenedor seleccionado (el id es el valor del tag,
  // "_sin_secretaria" para el grupo de servidores sin secretaría).
  const selectedSecretariaName = useMemo(
    () =>
      secretariaGroups?.find((group) => group.id === selectedSecretaria)?.name ??
      (selectedSecretaria === UNTAGGED_ID ? UNTAGGED_LABEL : selectedSecretaria),
    [secretariaGroups, selectedSecretaria]
  );

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-[110rem] space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {/* Encabezado */}
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="space-y-1.5">
            {isInside ? (
              <button
                type="button"
                onClick={handleBack}
                className="mb-1 inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-2)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--text-2)] shadow-soft transition-colors hover:border-[var(--primary-200)] hover:text-[var(--primary-600)]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver a contenedores
              </button>
            ) : null}
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--primary-600)]">
              Infraestructura
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-1)] sm:text-[28px]">
              {isInside ? selectedSecretariaName : "Servidores"}
            </h1>
            <p className="text-sm text-[var(--text-3)]">
              {isInside
                ? "Servidores asignados a esta secretaría municipal."
                : "Selecciona una secretaría municipal para consultar sus servidores."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden items-center gap-2 rounded-lg border border-[var(--border-2)] bg-white px-3 py-2 text-xs text-[var(--text-3)] shadow-soft sm:inline-flex">
              <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin text-[var(--primary-500)]" />
              {lastUpdatedAt
                ? `Actualizado ${lastUpdatedAt.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}`
                : "Esperando primer sondeo"}
              <button
                type="button"
                onClick={() => void handleRefresh()}
                disabled={isRefreshing || loading}
                aria-label="Actualizar y volver a monitorear"
                className="ml-1 rounded-md p-0.5 text-[var(--text-2)] transition-colors hover:text-[var(--primary-600)] disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary-600)] px-4 py-2.5 text-sm font-semibold text-[var(--primary-contrast)] shadow-medium transition-colors duration-200 hover:bg-[var(--primary-700)]"
            >
              <Plus className="h-4 w-4" />
              Agregar servidor
            </button>
          </div>
        </div>

        {(error || monitorError) && (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Error de monitoreo</p>
              <p className="mt-0.5 text-rose-700">{error ?? monitorError}</p>
            </div>
          </div>
        )}

        {/* Tarjetas de estadísticas */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border-2)] bg-white p-5 shadow-soft"
              >
                <div className="min-w-0">
                  <p className="text-2xl font-bold tabular-nums text-[var(--text-1)]">{card.value}</p>
                  <p className="mt-0.5 truncate text-sm font-medium text-[var(--text-1)]">{card.label}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-3)]">{card.detail}</p>
                </div>
                <span
                  aria-hidden="true"
                  className={`rounded-lg p-2.5 ${card.iconBg} shrink-0`}
                >
                  <Icon className={`h-5 w-5 ${card.iconColor}`} />
                </span>
              </div>
            );
          })}
        </div>

        {/* Búsqueda y filtros */}
        <div className="rounded-xl border border-[var(--border-2)] bg-white shadow-soft">
          <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center">
            <div className="relative w-full lg:max-w-sm">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-4)]"
              />
              <input
                type="text"
                value={filters.search}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                placeholder={
                  isInside ? "Buscar servidor por nombre o IP..." : "Buscar por nombre, IP o secretaría..."
                }
                aria-label="Buscar servidores"
                className="w-full rounded-lg border border-[var(--border-2)] bg-white py-2.5 pl-10 pr-3 text-sm text-[var(--text-1)] transition-colors duration-200 focus:border-[var(--primary-500)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-100)]"
              />
            </div>

            {!isInside && (
              <label className="flex items-center gap-2 rounded-lg border border-[var(--border-2)] bg-white px-3 py-2 text-sm">
                <span className="text-[var(--text-3)]">Secretaría</span>
                <select
                  value={filters.secretaria}
                  onChange={(event) => setFilters({ ...filters, secretaria: event.target.value })}
                  className="cursor-pointer bg-transparent font-medium text-[var(--text-1)] focus:outline-none"
                  aria-label="Filtrar por secretaría"
                >
                  <option value="ALL">Todas</option>
                  {(secretariaGroups ?? []).map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="flex items-center gap-2 rounded-lg border border-[var(--border-2)] bg-white px-3 py-2 text-sm">
              <span className="text-[var(--text-3)]">Estado</span>
              <select
                value={filters.status}
                onChange={(event) =>
                  setFilters({ ...filters, status: event.target.value as StatusFilter })
                }
                className="cursor-pointer bg-transparent font-medium text-[var(--text-1)] focus:outline-none"
                aria-label="Filtrar por estado"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs text-[var(--text-2)]">
              <input
                type="checkbox"
                checked={filters.showRetired}
                onChange={(event) => setFilters({ ...filters, showRetired: event.target.checked })}
                className="h-4 w-4 rounded border-[var(--border-3)] text-[var(--primary-600)] focus:ring-[var(--primary-500)]"
              />
              Mostrar retirados
            </label>

            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-lg border border-[var(--border-2)] px-3.5 py-2 text-sm font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] lg:ml-auto"
            >
              Limpiar
            </button>
          </div>

          <div className="flex flex-col gap-1 border-t border-[var(--border-1)] px-4 py-3 text-xs text-[var(--text-3)] sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <p>
              Mostrando{" "}
              <span className="font-semibold text-[var(--text-1)]">
                {isInside ? scopeServers.length : serversInVisibleGroups}
              </span>{" "}
              de{" "}
              <span className="font-semibold text-[var(--text-1)]">{totalVisible}</span>{" "}
              {isInside ? "servidores de esta secretaría" : "servidores en contenedores"}
            </p>
            <p>Monitoreo automático cada 15 segundos</p>
          </div>
        </div>

        {loading && servers.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--primary-600)]" />
            <span className="sr-only">Cargando catálogo de servidores</span>
          </div>
        ) : isInside ? (
          /* ===== Vista interna: tabla de la secretaría ===== */
          <div className="overflow-hidden rounded-xl border border-[var(--border-2)] bg-white shadow-soft">
            <div className="flex flex-col gap-3 border-b border-[var(--border-1)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-50)]"
                >
                  <Building2 className="h-5 w-5 text-[var(--primary-600)]" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-1)]">
                    Servidores de {selectedSecretariaName}
                  </h2>
                  <p className="text-xs text-[var(--text-3)]">
                    {scopeServers.length} equipo{scopeServers.length === 1 ? "" : "s"} asignado
                    {scopeServers.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <caption className="sr-only">
                  Tabla de servidores de {selectedSecretaria} con estado y ultimo sondeo
                </caption>
                <thead className="border-b border-[var(--border-1)] bg-[var(--surface-2)] text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                  <tr>
                    <th scope="col" className="px-5 py-3">Servidor</th>
                    <th scope="col" className="px-5 py-3">Estado</th>
                    <th scope="col" className="px-5 py-3">Entorno</th>
                    <th scope="col" className="px-5 py-3">Servicios</th>
                    <th scope="col" className="px-5 py-3">Ultima verificación</th>
                    <th scope="col" className="px-5 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-1)]">
                  {scopeServers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-4 text-center text-[var(--text-3)]">
                        Sin servidores que coincidan con los filtros.
                      </td>
                    </tr>
                  ) : (
                    scopeServers.map((server) => (
                      <tr key={server.id} className="transition-colors duration-200 hover:bg-[var(--surface-2)]">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <span
                              aria-hidden="true"
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)]"
                            >
                              <Server className="h-4 w-4 text-[var(--text-2)]" />
                            </span>
                            <div className="leading-tight min-w-0">
                              <Link
                                href={`/servers/${server.id}`}
                                className="block truncate font-semibold text-[var(--text-1)] transition-colors hover:text-[var(--primary-600)]"
                              >
                                {server.name}
                              </Link>
                              <span className="block truncate font-mono text-[11px] text-[var(--text-3)]">
                                {server.ipAddress} · {servicioOf(server) ?? OS_LABEL[server.osType] ?? "Otro"}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <ServerStatusBadge healthStatus={server.healthStatus} lifecycleState={server.lifecycleState} />
                        </td>
                        <td className="px-5 py-3.5 text-[var(--text-2)]">
                          {ENV_LABEL[server.environment] ?? server.environment}
                        </td>
                        <td className="px-5 py-3.5 tabular-nums text-[var(--text-2)]">
                          {typeof server.servicesRunning === "number"
                            ? `${server.servicesRunning}/${server.serviceCount ?? 0}`
                            : "—"}
                        </td>
                        <td className="px-5 py-3.5 text-xs text-[var(--text-3)]">
                          {server.lastCheckedAt
                            ? new Date(server.lastCheckedAt).toLocaleTimeString("es-ES", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Pendiente"}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href={`/servers/${server.id}`}
                            className="inline-flex items-center gap-1 rounded-md border border-[var(--border-2)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-2)] transition-colors hover:border-[var(--primary-200)] hover:text-[var(--primary-600)]"
                          >
                            Ver detalle
                            <ArrowRight className="h-3 w-3" aria-hidden="true" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ===== Vista general: contenedores de secretarías ===== */
          <section aria-labelledby="secretarias-heading">
            <div className="mb-4">
              <h2 id="secretarias-heading" className="text-base font-semibold text-[var(--text-1)]">
                Secretarías municipales
              </h2>
              <p className="text-sm text-[var(--text-3)]">Selecciona un contenedor para ingresar</p>
            </div>

            {!secretariaGroups && !secretariaError ? (
              <div className="flex items-center justify-center rounded-xl border border-[var(--border-2)] bg-white py-16 shadow-soft" role="status">
                <Loader2 aria-hidden="true" className="h-6 w-6 animate-spin text-[var(--primary-600)]" />
                <span className="sr-only">Cargando secretarías municipales</span>
              </div>
            ) : secretariaError ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-rose-200 bg-rose-50 px-6 py-12 text-center">
                <AlertTriangle aria-hidden="true" className="h-8 w-8 text-rose-600" />
                <h3 className="mt-3 text-sm font-semibold text-rose-800">
                  No se pudo cargar las secretarías
                </h3>
                <p className="mt-1 text-sm text-rose-700">{secretariaError}</p>
                <button
                  type="button"
                  onClick={() => void fetchSecretarias()}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Reintentar
                </button>
              </div>
            ) : visibleGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-2)] bg-white px-6 py-16 text-center shadow-soft">
                <SearchX aria-hidden="true" className="h-8 w-8 text-[var(--text-4)]" />
                <h3 className="mt-3 text-sm font-semibold text-[var(--text-1)]">
                  No encontramos contenedores
                </h3>
                <p className="mt-1 text-sm text-[var(--text-3)]">
                  Prueba con otros criterios de búsqueda.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleGroups.map((group) => {
                  const alerts = group.warn + group.down;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => handleOpenSecretaria(group.id)}
                      className="group flex flex-col justify-between rounded-xl border border-[var(--border-2)] bg-white p-5 text-left shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--primary-500)] hover:shadow-large focus-visible:-translate-y-0.5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span
                          aria-hidden="true"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-50)] transition-colors duration-200 group-hover:bg-[var(--primary-100)]"
                        >
                          <Building2 className="h-5 w-5 text-[var(--primary-600)]" />
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary-50)] px-2 py-1 text-xs font-semibold text-[var(--primary-600)] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                          Ingresar
                          <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>

                      <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-[var(--text-4)]">
                        Secretaría municipal
                      </p>
                      <h3 className="mt-0.5 truncate text-[15px] font-semibold text-[var(--text-1)]">
                        {group.name}
                      </h3>

                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-[var(--border-1)] pt-3 text-xs text-[var(--text-3)]">
                        <span className="tabular-nums">
                          <strong className="font-semibold text-[var(--text-1)]">{group.total}</strong>{" "}
                          servidores
                        </span>
                        <span className="tabular-nums">
                          <strong className="font-semibold text-[#1e7c50]">{group.ok}</strong> operativos
                        </span>
                        {alerts > 0 && (
                          <span className="tabular-nums">
                            <strong className="font-semibold text-[#b4432d]">{alerts}</strong>{" "}
                            alerta{alerts === 1 ? "" : "s"}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Modal: registrar servidor */}
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#172033]/55 px-4 backdrop-blur-sm"
        >
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[var(--border-2)] bg-white shadow-large">
            <div className="flex items-center justify-between border-b border-[var(--border-1)] px-5 py-4">
              <div>
                <h2 id="modal-title" className="text-base font-semibold text-[var(--text-1)]">
                  Agregar servidor
                </h2>
                {isInside && (
                  <p className="mt-0.5 text-xs text-[var(--text-3)]">
                    El nuevo equipo se agregará a {selectedSecretariaName}.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Cerrar ventana"
                className="rounded-md p-1.5 text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto px-5 py-5">
              <ServerForm
                embedded
                defaultSecretaria={selectedSecretaria ?? undefined}
                secretariaOptions={secretariaOptions}
                onSuccess={handleServerCreated}
                onCancel={() => setModalOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Toast de confirmación */}
      {toast && (
        <div
          role="status"
          className="nexo-toast fixed bottom-6 right-6 z-[60] inline-flex max-w-[calc(100vw-3rem)] items-center gap-3 rounded-xl border border-[var(--border-2)] border-l-4 border-l-[#2d9b68] bg-white px-4 py-3 text-sm font-medium text-[var(--text-1)] shadow-large"
        >
          <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,#2d9b68_12%,transparent)]">
            <Check className="h-3.5 w-3.5 text-[#2d9b68]" />
          </span>
          {toast}
        </div>
      )}
    </div>
  );
}
