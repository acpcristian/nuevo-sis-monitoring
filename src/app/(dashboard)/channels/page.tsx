"use client";

import React, { useEffect, useState, FormEvent } from "react";
import { Bell, Plus, Loader2, AlertCircle, Send, Trash2, RefreshCw, CheckCircle2, XCircle, FileText, Activity, Shield, TrendingUp, Mail, MessageSquare, Zap, Cloud } from "lucide-react";

type ChannelType = "EMAIL" | "SLACK" | "WEBHOOK" | "PAGERDUTY";

interface Channel {
  id: string;
  type: ChannelType;
  name: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  configSummary: Record<string, unknown> | null;
  lastTestAt: string | null;
  lastTestStatus: string | null;
  lastTestDetail: string | null;
  failureCount: number;
  lastFailureAt: string | null;
}

interface Delivery {
  id: string;
  channelName: string;
  title: string;
  severity: string;
  status: "SENT" | "FAILED" | "RETRYING";
  attempts: number;
  error: string | null;
  deliveredAt: string | null;
  lastAttemptAt: string;
}

const TYPE_LABEL: Record<ChannelType, string> = {
  EMAIL: "Correo SMTP",
  SLACK: "Slack",
  WEBHOOK: "Webhook HTTP",
  PAGERDUTY: "PagerDuty",
};

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    type: "SLACK" as ChannelType,
    name: "",
    description: "",
    webhookUrl: "",
    routingKey: "",
    smtpHost: "",
    smtpPort: "587",
    smtpUser: "",
    smtpPassword: "",
    fromAddress: "",
    toAddresses: "",
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, d] = await Promise.all([
        fetch("/api/v1/channels").then((r) => (r.ok ? r.json() : Promise.reject(new Error("Error al cargar canales")))),
        fetch("/api/v1/notifications?limit=30").then((r) => (r.ok ? r.json() : Promise.reject(new Error("Error al cargar entregas")))),
      ]);
      setChannels(c.items || []);
      setDeliveries(d.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => setForm((f) => ({
    ...f, name: "", description: "", webhookUrl: "", routingKey: "",
    smtpHost: "", smtpPort: "587", smtpUser: "", smtpPassword: "", fromAddress: "", toAddresses: "",
  }));

  const buildConfig = (t: ChannelType): Record<string, unknown> | null => {
    if (t === "SLACK" || t === "WEBHOOK") {
      if (!form.webhookUrl.trim()) return null;
      return { webhookUrl: form.webhookUrl.trim() };
    }
    if (t === "PAGERDUTY") {
      if (!form.routingKey.trim()) return null;
      return { routingKey: form.routingKey.trim() };
    }
    if (t === "EMAIL") {
      if (!form.smtpHost.trim() || !form.toAddresses.trim()) return null;
      return {
        smtpHost: form.smtpHost.trim(),
        smtpPort: Number(form.smtpPort) || 587,
        smtpUser: form.smtpUser.trim() || undefined,
        smtpPassword: form.smtpPassword || undefined,
        fromAddress: form.fromAddress.trim() || undefined,
        toAddresses: form.toAddresses.split(",").map((s) => s.trim()).filter(Boolean),
      };
    }
    return null;
  };

  const submitChannel = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBanner(null);
    const config = buildConfig(form.type);
    if (!config) {
      setError("Completa la configuración requerida para el tipo de canal seleccionado.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/v1/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: form.type, name: form.name.trim(), description: form.description.trim() || undefined, config }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Error al crear el canal.");
        return;
      }
      setBanner("Canal creado. La configuración quedó cifrada en reposo (AES-256-GCM).");
      setShowForm(false);
      resetForm();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const testChannel = async (id: string) => {
    setBusyId(id);
    setError(null);
    setBanner(null);
    try {
      const res = await fetch(`/api/v1/channels/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const data = await res.json().catch(() => ({}));
      setBanner(data?.detail ?? (res.ok ? "Envío de prueba correcto." : "La prueba falló. Revisa el detalle."));
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const deleteChannel = async (id: string) => {
    setBusyId(id);
    try {
      await fetch(`/api/v1/channels/${id}`, { method: "DELETE" });
      setBanner("Canal eliminado.");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const toggleStatus = async (c: Channel) => {
    setBusyId(c.id);
    try {
      await fetch(`/api/v1/channels/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: c.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const fmt = (s: string | null) => (s ? new Date(s).toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" }) : "—");

  const metrics = {
    total: channels.length,
    active: channels.filter(c => c.status === 'ACTIVE').length,
    failures: channels.reduce((acc, c) => acc + c.failureCount, 0),
    deliveries: deliveries.length,
  };

  const metricCards = [
    { label: "Canales Totales", value: metrics.total, icon: Bell, color: "indigo" as const },
    { label: "Canales Activos", value: metrics.active, icon: CheckCircle2, color: "emerald" as const },
    { label: "Fallos Globales", value: metrics.failures, icon: AlertCircle, color: "rose" as const },
    { label: "Entregas Totales", value: metrics.deliveries, icon: Send, color: "blue" as const },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-600 rounded-xl shadow-medium">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Notificaciones</h1>
            </div>
            <p className="text-sm text-slate-600 ml-[52px]">
              Canales de alertamiento con credenciales cifradas y reintentos automáticos.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
            </button>
            <button
              onClick={() => setShowForm((v) => !v)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition shadow-medium hover:shadow-large"
            >
              <Plus className="w-4 h-4" /> Nuevo Canal
            </button>
          </div>
        </div>

        {/* Métricas KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metricCards.map((metric) => {
            const Icon = metric.icon;
            return (
              <div key={metric.label} className="relative overflow-hidden bg-white rounded-2xl shadow-soft border border-slate-200 p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{metric.label}</p>
                    <p className="text-3xl font-bold text-slate-900 mt-2">{metric.value}</p>
                  </div>
                  <div className={`p-3 rounded-xl bg-${metric.color}-50`}>
                    <Icon className={`w-5 h-5 text-${metric.color}-600`} />
                  </div>
                </div>
              </div>
            );
          })}
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
        <form onSubmit={submitChannel} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4 max-w-3xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo *</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ChannelType }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="SLACK">Slack (webhook entrante)</option>
                <option value="WEBHOOK">Webhook HTTP</option>
                <option value="EMAIL">Correo SMTP</option>
                <option value="PAGERDUTY">PagerDuty (Events API v2)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Alarmas mesa de ayuda"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {(form.type === "SLACK" || form.type === "WEBHOOK") && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">URL del webhook *</label>
              <input
                value={form.webhookUrl}
                onChange={(e) => setForm((f) => ({ ...f, webhookUrl: e.target.value }))}
                placeholder="https://hooks.slack.com/services/..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          )}

          {form.type === "PAGERDUTY" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Routing key *</label>
              <input
                value={form.routingKey}
                onChange={(e) => setForm((f) => ({ ...f, routingKey: e.target.value }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          )}

          {form.type === "EMAIL" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Servidor SMTP *</label>
                <input value={form.smtpHost} onChange={(e) => setForm((f) => ({ ...f, smtpHost: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Puerto</label>
                <input type="number" value={form.smtpPort} onChange={(e) => setForm((f) => ({ ...f, smtpPort: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Usuario SMTP</label>
                <input value={form.smtpUser} onChange={(e) => setForm((f) => ({ ...f, smtpUser: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña SMTP</label>
                <input type="password" value={form.smtpPassword} onChange={(e) => setForm((f) => ({ ...f, smtpPassword: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Remitente</label>
                <input value={form.fromAddress} onChange={(e) => setForm((f) => ({ ...f, fromAddress: e.target.value }))} placeholder="monitoreo@elalto.gob.bo" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Destinatarios (separados por coma) *</label>
                <input value={form.toAddresses} onChange={(e) => setForm((f) => ({ ...f, toAddresses: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>
            </div>
          )}

          <p className="text-xs text-slate-400">
            Las credenciales se almacenan cifradas y jamás se devuelven por la API; solo se muestra un resumen sin secretos.
          </p>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setShowForm(false); resetForm(); }} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar canal
            </button>
          </div>
        </form>
      )}

      {/* Canales */}
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">Cargando…</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          {channels.length === 0 ? (
            <div className="py-14 text-center">
              <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Aún no hay canales configurados.</p>
            </div>
          ) : (
            channels.map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-900">{c.name}</span>
                    <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600">{TYPE_LABEL[c.type]}</span>
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${c.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                      {c.status === "ACTIVE" ? "ACTIVO" : "INACTIVO"}
                    </span>
                    {c.failureCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-100 text-red-700">
                        {c.failureCount} fallo(s)
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 truncate">
                    {c.description || "—"} · {JSON.stringify(c.configSummary ?? {})}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Última prueba: {fmt(c.lastTestAt)}
                    {c.lastTestStatus ? ` · ${c.lastTestStatus}` : ""}
                    {c.lastTestDetail ? ` · ${c.lastTestDetail}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => testChannel(c.id)} disabled={busyId === c.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50">
                    {busyId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    Probar
                  </button>
                  <button onClick={() => toggleStatus(c)} disabled={busyId === c.id} className="px-3 py-1.5 rounded-lg text-sm border border-slate-300 hover:bg-slate-50 disabled:opacity-50">
                    {c.status === "ACTIVE" ? "Desactivar" : "Activar"}
                  </button>
                  <button onClick={() => deleteChannel(c.id)} disabled={busyId === c.id} title="Eliminar canal" className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Historial de entregas */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 text-sm mb-4">Historial de entregas (últimas 30)</h2>
        {deliveries.length === 0 ? (
          <p className="text-sm text-slate-500">Sin entregas registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="py-2 pr-4">Estado</th>
                  <th className="py-2 pr-4">Canal</th>
                  <th className="py-2 pr-4">Título</th>
                  <th className="py-2 pr-4">Severidad</th>
                  <th className="py-2 pr-4">Intentos</th>
                  <th className="py-2 pr-4">Último intento</th>
                  <th className="py-2 pr-4">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {deliveries.map((d) => (
                  <tr key={d.id}>
                    <td className="py-2 pr-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                        d.status === "SENT" ? "bg-green-100 text-green-700" :
                        d.status === "RETRYING" ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"}`}>
                        {d.status === "SENT" ? <CheckCircle2 className="w-3 h-3" /> : d.status === "RETRYING" ? <RefreshCw className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {d.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{d.channelName}</td>
                    <td className="py-2 pr-4 text-slate-900 max-w-[280px] truncate">{d.title}</td>
                    <td className="py-2 pr-4 text-slate-600">{d.severity}</td>
                    <td className="py-2 pr-4 text-slate-600">{d.attempts}</td>
                    <td className="py-2 pr-4 text-slate-400 text-xs">{fmt(d.lastAttemptAt)}</td>
                    <td className="py-2 pr-4 text-red-600 text-xs max-w-[240px] truncate">{d.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
  </div>
    </div>
  );
}
