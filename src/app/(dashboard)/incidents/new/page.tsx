"use client";

import React, { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Siren, Loader2, AlertCircle } from "lucide-react";

interface ServerOption {
  id: string;
  name: string;
}

export default function NewIncidentPage() {
  const router = useRouter();
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "INCIDENT_CRITICAL",
    priority: "HIGH",
    serverId: "",
    eventId: "",
    alertId: "",
    assignedTo: "",
    slaTimeoutMin: "",
  });

  useEffect(() => {
    fetch("/api/v1/servers?limit=100")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("No se pudo cargar el inventario"))))
      .then((d) => setServers(d.items || []))
      .catch(() => setServers([]));

    const params = new URLSearchParams(window.location.search);
    const alertId = params.get("alert_id") ?? "";
    const eventId = params.get("event_id") ?? "";
    const serverId = params.get("server_id") ?? "";
    if (alertId || eventId || serverId) {
      setForm((f) => ({
        ...f,
        alertId: alertId,
        eventId: eventId,
        serverId: serverId,
        priority: alertId ? "CRITICAL" : f.priority,
      }));
    }
  }, []);

  const set = (k: keyof typeof form) => ((
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [k]: e.target.value })));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        category: form.category,
        priority: form.priority,
      };
      if (form.serverId) payload.serverId = form.serverId;
      if (form.eventId) payload.eventId = form.eventId;
      if (form.alertId) payload.alertId = form.alertId;
      if (form.assignedTo.trim()) payload.assignedTo = form.assignedTo.trim();
      if (form.slaTimeoutMin) payload.slaTimeoutMin = Number(form.slaTimeoutMin);

      const res = await fetch("/api/v1/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? `Error ${res.status} al crear el incidente.`);
        return;
      }
      const created = await res.json();
      router.push(`/incidents/${created.id}`);
    } catch {
      setError("Error de red al crear el incidente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6">
      <div className="flex items-center gap-2 mb-6">
        <Siren className="w-6 h-6 text-red-600" />
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Nuevo Incidente</h1>
      </div>

      {form.alertId || form.eventId ? (
        <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          Registro pre-vinculado desde {form.alertId ? "una alerta" : "un evento de log"} — el
          incidente quedará trazado con esa evidencia.
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Título *</label>
          <input
            required
            value={form.title}
            onChange={set("title")}
            placeholder="Ej: Kernel panic reportado en servidor de aplicaciones"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Descripción *</label>
          <textarea
            required
            rows={4}
            value={form.description}
            onChange={set("description")}
            placeholder="Síntomas, impacto observado y evidencia inicial..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Categoría *</label>
            <select value={form.category} onChange={set("category")} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="INCIDENT_CRITICAL">Crítico (SLA 30 min)</option>
              <option value="INCIDENT_MAJOR">Mayor (SLA 2 h)</option>
              <option value="INCIDENT_MINOR">Menor (SLA 8 h)</option>
              <option value="INCIDENT_MAINTENANCE">Mantenimiento (SLA 8 h)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Prioridad *</label>
            <select value={form.priority} onChange={set("priority")} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="CRITICAL">Crítica</option>
              <option value="HIGH">Alta</option>
              <option value="MEDIUM">Media</option>
              <option value="LOW">Baja</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">SLA (minutos)</label>
            <input
              type="number"
              min={5}
              max={2880}
              value={form.slaTimeoutMin}
              onChange={set("slaTimeoutMin")}
              placeholder="Por defecto según categoría"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Servidor</label>
            <select value={form.serverId} onChange={set("serverId")} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="">— Ninguno —</option>
              {servers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {form.serverId && (
              <input type="hidden" name="serverId" value={form.serverId} />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ID de evento (opcional)</label>
            <input
              value={form.eventId}
              onChange={set("eventId")}
              placeholder="UUID del LogEvent"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ID de alerta (opcional)</label>
            <input
              value={form.alertId}
              onChange={set("alertId")}
              placeholder="UUID de la LogAlert"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="sm:w-1/2">
          <label className="block text-sm font-medium text-slate-700 mb-1">Asignar a (opcional)</label>
          <input
            value={form.assignedTo}
            onChange={set("assignedTo")}
            placeholder="Nombre de usuario del responsable"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition shadow-sm"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            Crear incidente
          </button>
        </div>
      </form>
    </div>
  );
}
