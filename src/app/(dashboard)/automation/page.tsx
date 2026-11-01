"use client";

import React, { useEffect, useState, FormEvent } from "react";
import { Workflow, Plus, Play, Loader2, AlertCircle, CheckCircle2, XCircle, Shield } from "lucide-react";

type ActionKind = "RESTART_SERVICE" | "APPLY_CONFIG" | "RUN_COMMAND" | "NOTIFY_TEAM" | "CHECK_STATE" | "WAIT_SECONDS";

interface StepLog {
  step: number;
  kind: ActionKind;
  status: "OK" | "SKIPPED_APPROVAL" | "FAILED";
  detail: string;
  durationMs: number;
}

interface Playbook {
  id: string;
  name: string;
  description: string | null;
  status: "ACTIVE" | "DISABLED";
  steps: StepLike[];
  createdBy: string;
  lastRunAt: string | null;
  executions?: { id: string; status: string; startedAt: string; stepsLog: StepLog[] }[];
}

interface StepLike {
  kind: ActionKind;
  params: Record<string, unknown>;
}

const KIND_LABEL: Record<ActionKind, string> = {
  CHECK_STATE: "Verificar estado (seguro)",
  WAIT_SECONDS: "Esperar N segundos (seguro)",
  NOTIFY_TEAM: "Notificar al equipo (seguro)",
  RESTART_SERVICE: "Reiniciar servicio (requiere aprobación)",
  APPLY_CONFIG: "Aplicar configuración (requiere aprobación)",
  RUN_COMMAND: "Ejecutar comando (requiere aprobación)",
};

export default function AutomationPage() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    description: "",
  });
  const [steps, setSteps] = useState<StepLike[]>([{ kind: "CHECK_STATE", params: {} }]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/playbooks");
      if (!res.ok) throw new Error("No se pudo cargar los playbooks");
      const data = await res.json();
      setPlaybooks(data.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const addStep = () => setSteps((s) => [...s, { kind: "WAIT_SECONDS", params: { seconds: 5 } }]);
  const removeStep = (idx: number) => setSteps((s) => s.filter((_, i) => i !== idx));
  const updateStepKind = (idx: number, kind: ActionKind) =>
    setSteps((s) => s.map((st, i) => {
      if (i !== idx) return st;
      const base = { ...st, kind };
      if (kind === "WAIT_SECONDS" && !("seconds" in base.params)) base.params = { seconds: 5 };
      if (kind === "CHECK_STATE" && !("serverId" in base.params)) base.params = { serverId: "" };
      if (kind === "NOTIFY_TEAM" && !("title" in base.params)) base.params = { title: "", message: "", severity: "MAJOR" };
      if (kind === "RUN_COMMAND" && !("command" in base.params)) base.params = { command: "", targetServerId: "" };
      if (kind === "RESTART_SERVICE" && !("serviceName" in base.params)) base.params = { serviceName: "", targetServerId: "" };
      if (kind === "APPLY_CONFIG" && !("configKey" in base.params)) base.params = { configKey: "", configValue: "", targetServerId: "" };
      return base;
    }));
  const updateStepParam = (idx: number, key: string, value: string) =>
    setSteps((s) => s.map((st, i) => (i === idx ? { ...st, params: { ...st.params, [key]: value } } : st)));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/playbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), description: form.description.trim() || undefined, steps }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Error al crear el playbook.");
        return;
      }
      setBanner("Playbook creado en estado DISABLED — actívalo conscientemente antes de ejecutar.");
      setShowForm(false);
      setForm({ name: "", description: "" });
      setSteps([{ kind: "CHECK_STATE", params: {} }]);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const activate = async (p: Playbook) => {
    setBusyId(p.id);
    try {
      await fetch(`/api/v1/playbooks/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: p.status === "ACTIVE" ? "DISABLED" : "ACTIVE" }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const execute = async (id: string) => {
    setBusyId(id);
    setError(null);
    setBanner(null);
    try {
      const res = await fetch(`/api/v1/playbooks/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "execute" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? "Error al ejecutar el playbook.");
        return;
      }
      const logs: StepLog[] = data.stepsLog ?? [];
      const skipped = logs.filter((l) => l.status === "SKIPPED_APPROVAL").length;
      setBanner(
        data.status === "SUCCESS"
          ? `Ejecución completada (${logs.length} paso(s)${skipped ? `, ${skipped} pendientes de aprobación manual` : ""}).`
          : `Ejecución FALLO — revisa los pasos registrados en la tabla.`
      );
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    setBusyId(id);
    try {
      await fetch(`/api/v1/playbooks/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" }) : "—");

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Workflow className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Automatización</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Playbooks de respuesta: read-only-first, fail-fast y con human-in-the-loop para acciones mutantes.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition shadow-sm"
        >
          <Plus className="w-4 h-4" /> Nuevo playbook
        </button>
      </div>

      {banner && (
        <div className="rounded-lg bg-green-50 border border-green-100 px-4 py-3 text-sm text-green-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> {banner}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={submit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 max-w-3xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
              <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
              <input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-slate-700">Pasos ({steps.length})</label>
              <button type="button" onClick={addStep} className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                + Agregar paso
              </button>
            </div>
            {steps.map((st, idx) => (
              <div key={idx} className="rounded-lg border border-slate-200 p-3 space-y-2 bg-slate-50/60">
                <div className="flex items-center gap-2 justify-between">
                  <span className="text-xs font-semibold text-slate-500">Paso {idx + 1}</span>
                  <button type="button" onClick={() => removeStep(idx)} className="text-xs text-red-600 hover:text-red-700">
                    Quitar
                  </button>
                </div>
                <select value={st.kind} onChange={(e) => updateStepKind(idx, e.target.value as ActionKind)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  {Object.entries(KIND_LABEL).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
                {st.kind === "WAIT_SECONDS" && (
                  <input type="number" min={1} max={120} value={String(st.params.seconds ?? "")} onChange={(e) => updateStepParam(idx, "seconds", e.target.value)} placeholder="Segundos" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm w-40" />
                )}
                {st.kind === "CHECK_STATE" && (
                  <input value={String(st.params.serverId ?? "")} onChange={(e) => updateStepParam(idx, "serverId", e.target.value)} placeholder="ID del servidor (opcional — vacío verifica pasivo global)" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
                )}
                {st.kind === "NOTIFY_TEAM" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input value={String(st.params.title ?? "")} onChange={(e) => updateStepParam(idx, "title", e.target.value)} placeholder="Título" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
                    <input value={String(st.params.message ?? "")} onChange={(e) => updateStepParam(idx, "message", e.target.value)} placeholder="Mensaje" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
                    <select value={String(st.params.severity ?? "MAJOR")} onChange={(e) => updateStepParam(idx, "severity", e.target.value)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">
                      <option value="CRITICAL">CRITICAL</option>
                      <option value="MAJOR">MAJOR</option>
                      <option value="MINOR">MINOR</option>
                    </select>
                  </div>
                )}
                {["RESTART_SERVICE", "APPLY_CONFIG", "RUN_COMMAND"].includes(st.kind) && (
                  <div className="rounded-md bg-purple-50 border border-purple-100 px-3 py-2 text-xs text-purple-800 flex items-center gap-2">
                    <Shield className="w-4 h-4 shrink-0" />
                    Acción mutante: se registará como PENDIENTE DE APROBACIÓN manual del operador en la ejecución.
                  </div>
                )}
                {st.kind === "RUN_COMMAND" && (
                  <input value={String(st.params.command ?? "")} onChange={(e) => updateStepParam(idx, "command", e.target.value)} placeholder="Comando pre-aprobado (solo documentación del playbook)" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono" />
                )}
                {st.kind === "RESTART_SERVICE" && (
                  <input value={String(st.params.serviceName ?? "")} onChange={(e) => updateStepParam(idx, "serviceName", e.target.value)} placeholder="Servicio a reiniciar (documentación)" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
                )}
                {st.kind === "APPLY_CONFIG" && (
                  <input value={String(st.params.configKey ?? "")} onChange={(e) => updateStepParam(idx, "configKey", e.target.value)} placeholder="Clave de configuración (documentación)" className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Crear playbook
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Cargando…</div>
      ) : (
        <div className="space-y-4">
          {playbooks.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm py-14 text-center">
              <Workflow className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Sin playbooks aún. Crea el primero para responder de forma reproducible.</p>
            </div>
          )}
          {playbooks.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-3">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900">{p.name}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${p.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {p.status === "ACTIVE" ? "ACTIVO" : "DESHABILITADO"}
                    </span>
                    <span className="text-[11px] text-slate-400">creado por {p.createdBy} · última ejecución {fmt(p.lastRunAt)}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{p.description || "—"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => activate(p)} disabled={busyId === p.id} className="px-3 py-1.5 rounded-lg text-sm border border-slate-300 hover:bg-slate-50 disabled:opacity-50">
                    {p.status === "ACTIVE" ? "Deshabilitar" : "Activar"}
                  </button>
                  <button onClick={() => execute(p.id)} disabled={busyId === p.id || p.status !== "ACTIVE"} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50">
                    {busyId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                    Ejecutar
                  </button>
                  <button onClick={() => remove(p.id)} disabled={busyId === p.id} title="Eliminar" className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50">
                    <XCircle className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Pasos del playbook */}
              <div className="flex items-center gap-2 flex-wrap text-xs text-slate-600">
                {(p.steps ?? []).map((s, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-50 border border-slate-200">
                    <span className="font-semibold text-slate-400">{i + 1}.</span>
                    {s.kind}
                  </span>
                ))}
              </div>

              {/* Últimas ejecuciones con registro de pasos */}
              {(p.executions ?? []).length > 0 && (
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  {(p.executions ?? []).slice(0, 3).map((ex) => (
                    <div key={ex.id} className="text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ex.status === "SUCCESS" ? "bg-green-100 text-green-700" : ex.status === "FAILED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                          {ex.status}
                        </span>
                        <span className="text-slate-400">{fmt(ex.startedAt)}</span>
                      </div>
                      {(ex.stepsLog ?? []).length > 0 && (
                        <ul className="mt-1 space-y-0.5 ml-4 text-slate-600">
                          {ex.stepsLog.map((log, li) => (
                            <li key={li} className={log.status === "FAILED" ? "text-red-600" : log.status === "SKIPPED_APPROVAL" ? "text-purple-600" : ""}>
                              {log.step}. {log.kind} — {log.status}{log.detail ? `: ${log.detail}` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
