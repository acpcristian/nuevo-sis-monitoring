"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Siren, Plus, AlertTriangle, ChevronRight, Timer, Clock } from "lucide-react";

type Status = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type Priority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

interface IncidentListItem {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: Priority;
  status: Status;
  assignedTo: string | null;
  slaDueAt: string | null;
  slaBreached: boolean;
  escalationLevel: number;
  createdAt: string;
  server?: { id: string; name: string } | null;
}

const STATUS_BADGE: Record<Status, string> = {
  OPEN: "bg-red-100 text-red-700",
  ASSIGNED: "bg-amber-100 text-amber-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-slate-200 text-slate-600",
};

const STATUS_LABEL: Record<Status, string> = {
  OPEN: "ABIERTO",
  ASSIGNED: "ASIGNADO",
  IN_PROGRESS: "EN PROGRESO",
  RESOLVED: "RESUELTO",
  CLOSED: "CERRADO",
};

const PRIORITY_BADGE: Record<Priority, string> = {
  CRITICAL: "bg-red-600 text-white",
  HIGH: "bg-orange-500 text-white",
  MEDIUM: "bg-yellow-400 text-yellow-900",
  LOW: "bg-slate-400 text-white",
};

const PRIORITY_LABEL: Record<Priority, string> = {
  CRITICAL: "CRITO",
  HIGH: "ALTA",
  MEDIUM: "MEDIA",
  LOW: "BAJA",
};

const CATEGORY_LABEL: Record<string, string> = {
  INCIDENT_CRITICAL: "Crítico",
  INCIDENT_MAJOR: "Mayor",
  INCIDENT_MINOR: "Menor",
  INCIDENT_MAINTENANCE: "Mantenimiento",
};

function fmtDate(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" });
}

export default function IncidentsPage() {
  const [items, setItems] = useState<IncidentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [breached, setBreached] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchIncidents = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (priority) params.set("priority", priority);
      if (breached) params.set("breached", "true");
      if (search.trim()) params.set("search", search.trim());
      params.set("page", String(page));
      params.set("limit", "25");
      const res = await fetch(`/api/v1/incidents?${params.toString()}`);
      if (!res.ok) throw new Error("No se pudo cargar la lista de incidentes");
      const data = await res.json();
      setItems(data.items || []);
      setPages(data.pages || 1);
      setTotal(data.total || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, priority, breached, page]);

  const now = Date.now();

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Siren className="w-6 h-6 text-red-600" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Incidentes</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Ciclo de vida completo con SLA, escalado y trazabilidad de auditoría.
          </p>
        </div>
        <Link
          href="/incidents/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition shadow-sm w-fit"
        >
          <Plus className="w-4 h-4" />
          Nuevo Incidente
        </Link>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Estado</label>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todos</option>
            <option value="OPEN">Abierto</option>
            <option value="ASSIGNED">Asignado</option>
            <option value="IN_PROGRESS">En progreso</option>
            <option value="RESOLVED">Resuelto</option>
            <option value="CLOSED">Cerrado</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Prioridad</label>
          <select
            value={priority}
            onChange={(e) => { setPriority(e.target.value); setPage(1); }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todas</option>
            <option value="CRITICAL">Crítica</option>
            <option value="HIGH">Alta</option>
            <option value="MEDIUM">Media</option>
            <option value="LOW">Baja</option>
          </select>
        </div>
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={breached}
            onChange={(e) => { setBreached(e.target.checked); setPage(1); }}
            className="rounded"
          />
          <AlertTriangle className="w-4 h-4" />
          Solo SLA vencidos
        </label>
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs font-medium text-slate-500 mb-1">Buscar</label>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (setPage(1), fetchIncidents())}
            placeholder="Título o descripción..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500 py-12 text-center">Cargando incidentes…</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm py-16 text-center">
          <Siren className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No hay incidentes con estos filtros.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          {items.map((inc) => {
            const slaLeft = inc.slaDueAt ? new Date(inc.slaDueAt).getTime() - now : null;
            const slaCritical = slaLeft !== null && slaLeft < 0 && !["RESOLVED", "CLOSED"].includes(inc.status);
            return (
              <Link
                key={inc.id}
                href={`/incidents/${inc.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition"
              >
                <div className="flex flex-col items-start gap-1.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${PRIORITY_BADGE[inc.priority]}`}>
                      {PRIORITY_LABEL[inc.priority]}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${STATUS_BADGE[inc.status]}`}>
                      {STATUS_LABEL[inc.status]}
                    </span>
                    {slaCritical && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-50 text-red-600 border border-red-200">
                        <Timer className="w-3 h-3" /> SLA VENCIDO
                      </span>
                    )}
                    {inc.escalationLevel > 0 && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-purple-100 text-purple-700">
                        ESCALADO ×{inc.escalationLevel}
                      </span>
                    )}
                  </div>
                  <div className="font-medium text-slate-900 truncate">{inc.title}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {CATEGORY_LABEL[inc.category] ?? inc.category}
                    {inc.server ? ` · ${inc.server.name}` : ""}
                    {inc.assignedTo ? ` · asignado a ${inc.assignedTo}` : " · sin asignar"}
                  </div>
                </div>
                <div className="text-right hidden sm:flex flex-col items-end gap-0.5 w-44">
                  <div className={`inline-flex items-center gap-1 text-xs ${slaCritical ? "text-red-600 font-semibold" : "text-slate-500"}`}>
                    <Clock className="w-3 h-3" />
                    {inc.slaDueAt
                      ? slaCritical
                        ? `Vencido ${fmtDate(inc.slaDueAt)}`
                        : `Vence ${fmtDate(inc.slaDueAt)}`
                      : "Sin SLA"}
                  </div>
                  <div className="text-[11px] text-slate-400">Creado {fmtDate(inc.createdAt)}</div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
              </Link>
            );
          })}
        </div>
      )}

      {items.length > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>{total} incidente(s) — página {page} de {pages}</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              disabled={page >= pages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
