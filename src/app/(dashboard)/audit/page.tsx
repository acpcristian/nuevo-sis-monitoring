"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  History, RefreshCw, Loader2, AlertCircle, ChevronDown, ChevronRight,
  Shield, User, Server, Siren, Bell, Workflow, FileSpreadsheet, KeyRound, Download,
} from "lucide-react";
import { AUDIT_ACTION_GROUPS } from "@/core/domain/audit-actions";

interface AuditItem {
  id: string;
  timestamp: string;
  userId: string;
  actorUsername: string | null;
  action: string;
  targetServerId: string | null;
  detailsDiff: unknown;
  ipAddress: string | null;
}

interface AuditResponse {
  items: AuditItem[];
  total: number;
  limit: number;
  offset: number;
}

interface UserOption {
  id: string;
  username: string;
}

const LIMIT = 25;

const ACTION_LABEL = new Map<string, string>(
  AUDIT_ACTION_GROUPS.flatMap((group) =>
    group.actions.map((action) => [action.value, action.label] as [string, string])
  )
);

function actionTone(action: string): string {
  if (action.startsWith("LOGIN_FAILED") || action === "UNAUTHORIZED_ATTEMPT" || action === "NOTIFICATION_FAILED" || action === "PLAYBOOK_FAILED") {
    return "bg-rose-50 text-rose-700 ring-rose-100";
  }
  if (action.startsWith("USER_") || action.startsWith("LOGIN_")) {
    return "bg-indigo-50 text-indigo-700 ring-indigo-100";
  }
  if (action.startsWith("INCIDENT_")) return "bg-amber-50 text-amber-700 ring-amber-100";
  if (action.startsWith("SERVER_") || action.startsWith("METADATA") || action.startsWith("STATUS_")) {
    return "bg-sky-50 text-sky-700 ring-sky-100";
  }
  if (action.startsWith("CHANNEL_") || action.startsWith("NOTIFICATION_")) {
    return "bg-emerald-50 text-emerald-700 ring-emerald-100";
  }
  if (action.startsWith("PLAYBOOK_")) return "bg-violet-50 text-violet-700 ring-violet-100";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function actionIcon(action: string) {
  if (action.startsWith("USER_") || action.startsWith("LOGIN_") || action === "UNAUTHORIZED_ATTEMPT") return KeyRound;
  if (action.startsWith("SERVER_") || action.startsWith("METADATA") || action.startsWith("STATUS_")) return Server;
  if (action.startsWith("INCIDENT_")) return Siren;
  if (action.startsWith("CHANNEL_") || action.startsWith("NOTIFICATION_")) return Bell;
  if (action.startsWith("PLAYBOOK_")) return Workflow;
  if (action === "REPORT_EXPORTED") return FileSpreadsheet;
  return Shield;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("es-BO", { dateStyle: "short", timeStyle: "medium" });
}

export default function AuditPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [offset, setOffset] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filters, setFilters] = useState({ action: "", userId: "", from: "", to: "" });

  const buildFilterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.action) params.set("action", filters.action);
    if (filters.userId) params.set("userId", filters.userId);
    if (filters.from) params.set("from", new Date(`${filters.from}T00:00:00`).toISOString());
    if (filters.to) params.set("to", new Date(`${filters.to}T23:59:59`).toISOString());
    return params;
  }, [filters]);

  const buildQuery = useCallback(
    (nextOffset: number) => {
      const params = buildFilterParams();
      params.set("limit", String(LIMIT));
      params.set("offset", String(nextOffset));
      return params.toString();
    },
    [buildFilterParams]
  );

  const exportHref = useMemo(() => {
    const params = buildFilterParams();
    params.set("format", "csv");
    return `/api/v1/audit/export?${params.toString()}`;
  }, [buildFilterParams]);

  const load = useCallback(
    async (nextOffset: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/audit?${buildQuery(nextOffset)}`);
        if (res.status === 403) {
          setForbidden(true);
          return;
        }
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.message ?? "No se pudo cargar la auditoría.");
        setForbidden(false);
        setData(body as AuditResponse);
        setOffset(nextOffset);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    },
    [buildQuery]
  );

  useEffect(() => {
    load(0);
  }, [load]);

  useEffect(() => {
    fetch("/api/v1/users")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((body) => setUsers(body.items ?? []))
      .catch(() => setUsers([]));
  }, []);

  const range = useMemo(() => {
    if (!data || data.total === 0) return "0 de 0";
    const from = offset + 1;
    const to = Math.min(offset + LIMIT, data.total);
    return `${from}–${to} de ${data.total}`;
  }, [data, offset]);

  if (forbidden) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Shield className="w-5 h-5" /> Acceso restringido
          </h1>
          <p className="mt-2 text-sm">
            El registro de auditoría está reservado al rol SUPERADMIN.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Auditoría</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Registro inmutable de acciones: quién hizo qué, cuándo y desde qué IP. Los secretos
            se enmascaran antes de persistirse.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start">
          <a
            href={exportHref}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
            title="Descarga los eventos con los filtros activos en CSV"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </a>
          <button
            onClick={() => load(offset)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refrescar
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Acción</label>
            <select
              value={filters.action}
              onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todas las acciones</option>
              {AUDIT_ACTION_GROUPS.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.actions.map((action) => (
                    <option key={action.value} value={action.value}>
                      {action.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Actor</label>
            <select
              value={filters.userId}
              onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Todos</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Desde</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Hasta</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            onClick={() => setFilters({ action: "", userId: "", from: "", to: "" })}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            Limpiar filtros
          </button>
          <button
            onClick={() => load(0)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            Aplicar
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Eventos registrados</h2>
          <span className="text-xs text-slate-400">{range}</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Consultando auditoría…
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">
            No hay eventos para los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium w-8"></th>
                  <th className="px-3 py-2.5 text-left font-medium">Fecha</th>
                  <th className="px-3 py-2.5 text-left font-medium">Actor</th>
                  <th className="px-3 py-2.5 text-left font-medium">Acción</th>
                  <th className="px-3 py-2.5 text-left font-medium">Objetivo</th>
                  <th className="px-3 py-2.5 text-left font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((item) => {
                  const Icon = actionIcon(item.action);
                  const isOpen = expanded === item.id;
                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : item.id)}
                        className="hover:bg-slate-50/70 cursor-pointer"
                      >
                        <td className="px-3 py-2.5 text-slate-400">
                          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap">{formatDate(item.timestamp)}</td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center gap-1 text-slate-700">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {item.actorUsername ?? item.userId}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${actionTone(item.action)}`}>
                            <Icon className="w-3 h-3" />
                            {ACTION_LABEL.get(item.action) ?? item.action}
                          </span>
                          <span className="ml-2 font-mono text-[10px] text-slate-400">{item.action}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-500 font-mono">
                          {item.targetServerId ? `${item.targetServerId.slice(0, 8)}…` : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-500 font-mono">{item.ipAddress ?? "—"}</td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-slate-50/60">
                          <td></td>
                          <td colSpan={5} className="px-3 py-3">
                            <pre className="max-h-72 overflow-auto rounded-lg bg-slate-900 text-slate-100 text-xs p-3">
{JSON.stringify(item.detailsDiff, null, 2)}
                            </pre>
                            <p className="mt-2 text-[11px] text-slate-400 font-mono">
                              id: {item.id}
                              {item.targetServerId ? ` · servidor: ${item.targetServerId}` : ""}
                            </p>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100">
          <span className="text-xs text-slate-400">{range}</span>
          <div className="flex gap-2">
            <button
              onClick={() => load(Math.max(0, offset - LIMIT))}
              disabled={offset === 0 || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              onClick={() => load(offset + LIMIT)}
              disabled={!data || offset + LIMIT >= data.total || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
