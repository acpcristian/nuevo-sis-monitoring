"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Siren, ArrowLeft, Timer, ArrowUp, ChevronRight, Loader2, Server, FileText, ShieldCheck, CheckCircle2, XCircle,
} from "lucide-react";

type Status = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

interface AuditEntry {
  id: string;
  userId: string;
  fromStatus: string | null;
  toStatus: string;
  action: string;
  details: unknown;
  createdAt: string;
}

interface IncidentDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: Status;
  assignedTo: string | null;
  slaTimeoutMin: number | null;
  slaDueAt: string | null;
  slaBreached: boolean;
  escalationLevel: number;
  rootCause: string | null;
  correctiveActions: string | null;
  eventId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  closedBy: string | null;
  server?: { id: string; name: string; healthStatus: string } | null;
  auditTrail: AuditEntry[];
}

const VALID_TRANSITIONS: Record<Status, Status[]> = {
  OPEN: ["ASSIGNED", "CLOSED"],
  ASSIGNED: ["IN_PROGRESS", "OPEN", "CLOSED"],
  IN_PROGRESS: ["RESOLVED", "ASSIGNED", "OPEN"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

const TRANSITION_LABEL: Record<string, string> = {
  ASSIGN: "Asignar",
  IN_PROGRESS: "Empezar a trabajar",
  RESOLVED: "Marcar resuelto",
  CLOSED: "Cerrar",
};

function fmt(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("es-BO", { dateStyle: "short", timeStyle: "medium" });
}

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [incident, setIncident] = useState<IncidentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  // Formularios de acción
  const [assignedTo, setAssignedTo] = useState("");
  const [rootCause, setRootCause] = useState("");
  const [correctiveActions, setCorrectiveActions] = useState("");
  const [escalReason, setEscalReason] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/incidents/${id}`);
      if (!res.ok) throw new Error("No se pudo cargar el incidente");
      setIncident(await res.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const doAction = async (body: Record<string, unknown>, okMessage: string) => {
    setActionBusy(true);
    setError(null);
    setBanner(null);
    try {
      const res = await fetch(`/api/v1/incidents/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.message ?? `Error ${res.status}`);
      }
      setBanner(okMessage);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionBusy(false);
    }
  };

  const doTransition = async (next: Status) => {
    await doAction(
      {
        status: next,
        ...(next === "ASSIGNED" && assignedTo.trim() ? { assignedTo: assignedTo.trim() } : {}),
        ...(next === "RESOLVED" ? { rootCause: rootCause.trim() || undefined, correctiveActions: correctiveActions.trim() || undefined } : {}),
      },
      `Incidente actualizado a ${next}.`
    );
  };

  const doClose = async () => {
    if (!rootCause.trim()) {
      setError("Para cerrar el incidente se requiere documentar la causa raíz.");
      return;
    }
    await doAction(
      { action: "close", rootCause: rootCause.trim(), correctiveActions: correctiveActions.trim() || undefined },
      "Incidente cerrado con trazabilidad completa."
    );
  };

  const doEscalate = async () => {
    if (!escalReason.trim()) {
      setError("Se requiere un motivo para escalar el incidente.");
      return;
    }
    await doAction(
      { action: "escalate", reason: escalReason.trim(), ...(assignedTo.trim() ? { assignedTo: assignedTo.trim() } : {}) },
      `Incidente escalado a nivel ${(incident?.escalationLevel ?? 0) + 1}.`
    );
  };

  const requiresRootCause = (next: Status) => next === "RESOLVED" || next === "CLOSED";

  if (error && !incident) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4">
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">{error}</div>
        <Link href="/incidents" className="mt-4 inline-flex items-center gap-1 text-sm text-indigo-600">
          <ArrowLeft className="w-4 h-4" /> Volver a incidentes
        </Link>
      </div>
    );
  }

  if (!incident) {
    return <div className="py-16 text-center text-sm text-slate-500">Cargando incidente…</div>;
  }

  const allowed = VALID_TRANSITIONS[incident.status] ?? [];
  const serviceClosed = incident.status === "CLOSED";

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <Link href="/incidents" className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700">
        <ArrowLeft className="w-4 h-4" /> Volver a incidentes
      </Link>

      {banner && (
        <div className="rounded-lg bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {banner}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <XCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {/* Encabezado */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Siren className="w-5 h-5 text-red-600" />
              <h1 className="text-xl font-bold text-slate-900">{incident.title}</h1>
            </div>
            <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{incident.description}</p>
            <div className="flex items-center gap-2 mt-3 text-xs text-slate-500 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-slate-100">{incident.category}</span>
              <span className={`px-2 py-0.5 rounded font-semibold ${
                incident.priority === "CRITICAL" ? "bg-red-100 text-red-700" :
                incident.priority === "HIGH" ? "bg-orange-100 text-orange-700" :
                "bg-slate-100 text-slate-600"}`}>
                {incident.priority}
              </span>
              {incident.server && (
                <Link href={`/servers/${incident.server.id}`} className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                  <Server className="w-3.5 h-3.5" /> {incident.server.name}
                </Link>
              )}
              {incident.eventId && (
                <Link href={`/logs/${incident.eventId}`} className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                  <FileText className="w-3.5 h-3.5" /> Evidencia del log
                </Link>
              )}
            </div>
          </div>

          <div className="text-right space-y-1 shrink-0">
            <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold ${
              incident.status === "CLOSED" ? "bg-slate-200 text-slate-600" :
              incident.status === "RESOLVED" ? "bg-green-100 text-green-700" :
              incident.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" :
              incident.status === "ASSIGNED" ? "bg-amber-100 text-amber-700" :
              "bg-red-100 text-red-700"}`}>
              {incident.status}
            </span>
            {incident.slaDueAt && !["RESOLVED", "CLOSED"].includes(incident.status) && (
              <div className={`text-xs flex items-center gap-1 justify-end ${incident.slaBreached ? "text-red-600 font-semibold" : "text-slate-500"}`}>
                <Timer className="w-3.5 h-3.5" />
                {incident.slaBreached ? "SLA VENCIDO" : `Vence ${fmt(incident.slaDueAt)}`}
              </div>
            )}
            {incident.escalationLevel > 0 && (
              <div className="text-xs text-purple-700 font-semibold inline-flex items-center gap-1 justify-end">
                <ArrowUp className="w-3.5 h-3.5" /> Escalado ×{incident.escalationLevel}
              </div>
            )}
            <div className="text-[11px] text-slate-400">Creado {fmt(incident.createdAt)}</div>
          </div>
        </div>

        {(incident.rootCause || incident.correctiveActions) && (
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            {incident.rootCause && (
              <div className="text-sm">
                <span className="font-medium text-slate-700">Causa raíz documentada: </span>
                <span className="text-slate-600">{incident.rootCause}</span>
              </div>
            )}
            {incident.correctiveActions && (
              <div className="text-sm">
                <span className="font-medium text-slate-700">Acciones correctivas: </span>
                <span className="text-slate-600">{incident.correctiveActions}</span>
              </div>
            )}
            {incident.closedBy && (
              <div className="text-xs text-slate-400">Cerrado por {incident.closedBy} · {fmt(incident.closedAt)}</div>
            )}
          </div>
        )}
      </div>

      {!serviceClosed && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Transiciones */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-slate-900 text-sm">Transiciones de ciclo de vida</h2>
            {allowed.length === 0 ? (
              <p className="text-sm text-slate-500">El estado actual no admite transiciones.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allowed.map((next) => (
                  <button
                    key={next}
                    disabled={actionBusy}
                    onClick={() => doTransition(next)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition shadow-sm disabled:opacity-60 ${
                      requiresRootCause(next)
                        ? "bg-green-600 hover:bg-green-700 text-white"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    }`}
                  >
                    {actionBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {TRANSITION_LABEL[next] ?? next}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            )}
            {allowed.includes("ASSIGNED") && (
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Round-robin / asignación manual</label>
                <input
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  placeholder="Responsable (vacío = mantener actual)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            )}
            {(allowed.includes("RESOLVED")) && (
              <div className="space-y-3 border-t border-slate-100 pt-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Causa raíz (documentación obligatoria)</label>
                  <textarea
                    rows={3}
                    value={rootCause}
                    onChange={(e) => setRootCause(e.target.value)}
                    placeholder="Diagnóstico final del incidente..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Acciones correctivas</label>
                  <textarea
                    rows={2}
                    value={correctiveActions}
                    onChange={(e) => setCorrectiveActions(e.target.value)}
                    placeholder="Qué se hizo para prevenir recurrencia..."
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Cierre formal + escalado */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-slate-900 text-sm">Cierre formal con trazabilidad</h2>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Causa raíz para cierre *</label>
              <textarea
                rows={2}
                value={rootCause}
                onChange={(e) => setRootCause(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              disabled={actionBusy}
              onClick={doClose}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition"
            >
              {actionBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <ShieldCheck className="w-4 h-4" />
              Cerrar incidente (documentado)
            </button>

            <div className="border-t border-slate-100 pt-4 space-y-2">
              <h2 className="font-semibold text-slate-900 text-sm">Escalado</h2>
              <textarea
                rows={2}
                value={escalReason}
                onChange={(e) => setEscalReason(e.target.value)}
                placeholder="Motivo del escalado (SLA vencido, severidad incrementada...)"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                disabled={actionBusy}
                onClick={doEscalate}
                className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition"
              >
                <ArrowUp className="w-4 h-4" />
                Escalar incidente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline append-only */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 text-sm mb-4">
          Registro de auditoría (append-only)
        </h2>
        {incident.auditTrail.length === 0 ? (
          <p className="text-sm text-slate-500">Sin entradas registradas.</p>
        ) : (
          <ol className="space-y-3">
            {incident.auditTrail.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 text-sm">
                <span className="mt-1 w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                <div>
                  <div className="text-slate-800">
                    <span className="font-medium">{entry.action}</span>
                    {entry.fromStatus && entry.toStatus && entry.fromStatus !== entry.toStatus
                      ? ` · ${entry.fromStatus} → ${entry.toStatus}`
                      : ""}
                    {entry.toStatus && !entry.fromStatus ? ` · estado ${entry.toStatus}` : ""}
                  </div>
                  <div className="text-xs text-slate-400">
                    {fmt(entry.createdAt)} · por {entry.userId}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
