"use client";

import React, { useEffect, useState } from "react";
import {
  Bell,
  Plus,
  Loader2,
  AlertCircle,
  Send,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Mail,
  MessageSquare,
  Zap,
  Cloud,
  Server,
  Wrench,
  ScrollText,
  ShieldAlert,
  FileWarning,
  HardDrive,
  Radar,
  Puzzle,
  Settings2,
  Eye,
} from "lucide-react";
import { ChannelFormModal } from "@/components/notifications/ChannelFormModal";
import { ChannelDetailModal, CategoryDetailModal } from "@/components/notifications/ChannelDetailModal";
import {
  CHANNEL_TYPE_LABELS,
  formatDate,
  type Channel,
  type ChannelType,
  type Delivery,
  type NotificationCategory,
} from "@/components/notifications/types";

const TYPE_ICON: Record<ChannelType, React.ReactNode> = {
  EMAIL: <Mail className="w-3 h-3" />,
  SLACK: <MessageSquare className="w-3 h-3" />,
  WEBHOOK: <Zap className="w-3 h-3" />,
  PAGERDUTY: <Cloud className="w-3 h-3" />,
};

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  SERVER_OFFLINE: <Server className="w-4 h-4" />,
  SERVICE_HEALTH: <Wrench className="w-4 h-4" />,
  LOG_ALERT: <ScrollText className="w-4 h-4" />,
  SECURITY_ALERT: <ShieldAlert className="w-4 h-4" />,
  INCIDENT: <FileWarning className="w-4 h-4" />,
  BACKUP: <HardDrive className="w-4 h-4" />,
  AGENT_FRESHNESS: <Radar className="w-4 h-4" />,
  default: <Puzzle className="w-4 h-4" />,
};

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-rose-100 text-rose-800",
  ERROR: "bg-rose-50 text-rose-700",
  MAJOR: "bg-orange-100 text-orange-800",
  HIGH: "bg-orange-50 text-orange-700",
  MEDIUM: "bg-amber-100 text-amber-800",
  MINOR: "bg-amber-50 text-amber-700",
  WARN: "bg-yellow-50 text-yellow-700",
  LOW: "bg-slate-100 text-slate-600",
  INFO: "bg-emerald-50 text-emerald-700",
};

function severityClass(severity: string): string {
  return SEVERITY_STYLES[severity] ?? "bg-slate-100 text-slate-600";
}

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [categories, setCategories] = useState<NotificationCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // CRUD: un único modal abierto a la vez (sin saturar la vista).
  const [formChannel, setFormChannel] = useState<Channel | "new" | null>(null);
  const [detailChannel, setDetailChannel] = useState<Channel | null>(null);
  const [detailCategory, setDetailCategory] = useState<NotificationCategory | null>(null);
  const [processingRetries, setProcessingRetries] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, d, cats] = await Promise.all([
        fetch("/api/v1/channels").then((r) => (r.ok ? r.json() : Promise.reject(new Error("Error al cargar canales")))),
        fetch("/api/v1/notifications?limit=30").then((r) => (r.ok ? r.json() : Promise.reject(new Error("Error al cargar entregas")))),
        fetch("/api/v1/notification-categories").then((r) => (r.ok ? r.json() : Promise.reject(new Error("Error al cargar categorías")))),
      ]);
      setChannels(c.items || []);
      setDeliveries(
        (d.items || []).map((item: Record<string, unknown>) => ({
          id: String(item.id),
          channelId: (item.channel as { id?: string } | null)?.id ?? "",
          channelName: (item.channel as { name?: string } | null)?.name ?? "—",
          title: String(item.title ?? ""),
          severity: String(item.severity ?? ""),
          category: (item.category as string | null) ?? null,
          status: item.status as Delivery["status"],
          attempts: Number(item.attempts ?? 1),
          error: (item.error as string | null) ?? null,
          deliveredAt: (item.deliveredAt as string | null) ?? null,
          lastAttemptAt: String(item.lastAttemptAt ?? ""),
        }))
      );
      setCategories(cats.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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
      if (res.ok) setBanner(data?.detail ?? "Envío de prueba correcto.");
      else setError(data?.detail ?? data?.message ?? "La prueba falló. Revisa el detalle.");
      if (detailChannel?.id === id) setDetailChannel(null);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const deleteChannel = async (id: string) => {
    setBusyId(id);
    setError(null);
    setBanner(null);
    try {
      const res = await fetch(`/api/v1/channels/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "No se pudo eliminar el canal.");
        return;
      }
      setDetailChannel(null);
      setBanner("Canal eliminado junto con su historial de entregas.");
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const toggleStatus = async (c: Channel) => {
    setBusyId(c.id);
    setError(null);
    setBanner(null);
    try {
      const res = await fetch(`/api/v1/channels/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: c.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "No se pudo cambiar el estado del canal.");
        return;
      }
      setBanner(`Canal ${c.status === "ACTIVE" ? "desactivado" : "activado"}.`);
      setDetailChannel(null);
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const processRetries = async () => {
    setProcessingRetries(true);
    setError(null);
    setBanner(null);
    try {
      const res = await fetch("/api/v1/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "process-retries" }),
      });
      const data = await res.json().catch(() => ({}));
      setBanner(
        res.ok
          ? `Reintentos procesados: ${data?.processed ?? 0} entrega(s) evaluadas.`
          : (data?.message ?? "Error al procesar reintentos.")
      );
      await load();
    } finally {
      setProcessingRetries(false);
    }
  };

  // ============================================================ Métricas
  const deliveriesByStatus = {
    sent: { count: deliveries.filter((d) => d.status === "SENT").length, total: Math.max(deliveries.length, 1) },
    retrying: { count: deliveries.filter((d) => d.status === "RETRYING").length, total: Math.max(deliveries.length, 1) },
    failed: { count: deliveries.filter((d) => d.status === "FAILED").length, total: Math.max(deliveries.length, 1) },
  };

  const failingChannels = channels.filter((c) => c.failureCount > 0);
  const metrics: Array<{
    label: string;
    value: number;
    icon: React.ReactNode;
    accent: string;
    detail: () => string;
  }> = [
    {
      label: "Canales totales",
      value: channels.length,
      icon: <Bell className="w-5 h-5 text-amber-600" />,
      accent: "bg-amber-50",
      detail: () =>
        `${Object.entries(
          channels.reduce<Record<string, number>>((acc, c) => ({ ...acc, [c.type]: (acc[c.type] ?? 0) + 1 }), {})
        )
          .map(([type, n]) => `${n} ${CHANNEL_TYPE_LABELS[type as ChannelType] ?? type}`)
          .join(" · ") || "Sin canales"}`,
    },
    {
      label: "Canales activos",
      value: channels.filter((c) => c.status === "ACTIVE").length,
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
      accent: "bg-emerald-50",
      detail: () =>
        `${channels.filter((c) => c.status === "ACTIVE" && c.categories.length > 0).length} con categoría(s) asignada(s) · ${channels.filter((c) => c.status === "ACTIVE" && c.categories.length === 0).length} reciben todo`,
    },
    {
      label: "Fallos globales",
      value: failingChannels.reduce((acc, c) => acc + c.failureCount, 0),
      icon: <AlertCircle className="w-5 h-5 text-rose-600" />,
      accent: "bg-rose-50",
      detail: () =>
        failingChannels.length === 0
          ? "Sin canal con fallas registradas"
          : `En: ${failingChannels.map((c) => c.name).join(", ")}`,
    },
    {
      label: "Entregas (últ. 30)",
      value: deliveries.length,
      icon: <Send className="w-5 h-5 text-blue-600" />,
      accent: "bg-blue-50",
      detail: () =>
        `${deliveriesByStatus.sent.count} entregadas · ${deliveriesByStatus.retrying.count} en reintento · ${deliveriesByStatus.failed.count} fallidas`,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-600 rounded-xl shadow-medium">
                <Bell className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Notificaciones</h1>
            </div>
            <p className="text-sm text-slate-600 ml-[52px]">
              Canales de alertamiento por categoría del sistema, con credenciales cifradas y reintentos automáticos.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={load} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
            </button>
            <button
              onClick={processRetries}
              disabled={processingRetries}
              title="Reintenta las entregas pendientes cuyo backoff ya venció"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 transition"
            >
              {processingRetries ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Procesar reintentos
            </button>
            <button
              onClick={() => setFormChannel("new")}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition shadow-medium hover:shadow-large"
            >
              <Plus className="w-4 h-4" /> Nuevo Canal
            </button>
          </div>
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

        {/* Tarjetas KPI con desglose de la información general */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="bg-white rounded-2xl shadow-soft border border-slate-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{metric.label}</p>
                  <p className="text-3xl font-bold text-slate-900 mt-1.5">{metric.value}</p>
                </div>
                <div className={`p-3 rounded-xl ${metric.accent}`}>{metric.icon}</div>
              </div>
              <p className="text-[11px] text-slate-500 mt-3 border-t border-slate-100 pt-2 truncate" title={metric.detail()}>
                {metric.detail()}
              </p>
            </div>
          ))}
        </div>

        {/* Categorías del sistema (sección por sección) */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-slate-600" /> Categorías de alertamiento del sistema
              </h2>
              <p className="text-sm text-slate-500">
                Revisa qué dispara cada alerta, sus acciones recomendadas y qué canales la reciben.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {loading ? (
              <div className="col-span-full py-10 text-center text-sm text-slate-500">Cargando…</div>
            ) : categories.length === 0 ? (
              <div className="col-span-full bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
                <Puzzle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-slate-500">Sin categorías configuradas.</p>
              </div>
            ) : (
              categories.map((cat) => (
                <div key={cat.id} className="bg-white rounded-2xl shadow-soft border border-slate-200 p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                      {CATEGORY_ICON[cat.code] ?? CATEGORY_ICON.default}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${severityClass(cat.defaultSeverity)}`}>
                      {cat.defaultSeverity}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mt-3">{cat.section}</p>
                  <h3 className="text-sm font-bold text-slate-900">{cat.name}</h3>
                  <p className="text-xs text-slate-600 mt-1.5 leading-relaxed line-clamp-3">{cat.description || "Sin descripción."}</p>
                  <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                      <Bell className="w-3 h-3" /> {cat.channelCount} canal(es) suscrito(s)
                    </span>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                    <button
                      onClick={() => setDetailCategory(cat)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition"
                    >
                      <Eye className="w-3.5 h-3.5" /> Revisar categoría
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Canales */}
        <div>
          <h2 className="text-lg font-semibold text-slate-900 mb-3">Canales configurados</h2>
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500 bg-white rounded-xl border border-slate-200">Cargando…</div>
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
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600">
                          {TYPE_ICON[c.type]} {CHANNEL_TYPE_LABELS[c.type]}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${c.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"}`}>
                          {c.status === "ACTIVE" ? "ACTIVO" : "INACTIVO"}
                        </span>
                        {c.failureCount > 0 && (
                          <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-100 text-red-700">
                            {c.failureCount} fallo(s)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 truncate">
                        {c.description || "—"} ·{" "}
                        {c.categories.length === 0
                          ? "recibe todas las categorías"
                          : `categorías: ${c.categories.map((code) => categories.find((cat) => cat.code === code)?.name ?? code).join(", ")}`}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Última prueba: {formatDate(c.lastTestAt)}
                        {c.lastTestStatus ? ` · ${c.lastTestStatus}` : ""}
                      </div>
                    </div>
                    {/* Acción única por fila: el resto vive en el detalle */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setDetailChannel(c)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition"
                      >
                        <Eye className="w-3.5 h-3.5" /> Ver / Gestionar
                      </button>
                      <button
                        onClick={() => testChannel(c.id)}
                        disabled={busyId === c.id}
                        title="Enviar prueba"
                        className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-50"
                      >
                        {busyId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => deleteChannel(c.id)}
                        disabled={busyId === c.id}
                        title="Eliminar"
                        className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

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
                    <th className="py-2 pr-4">Categoría</th>
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
                      <td className="py-2 pr-4">
                        {d.category ? (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-medium">
                            {categories.find((c) => c.code === d.category)?.name ?? d.category}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-slate-900 max-w-[280px] truncate">{d.title}</td>
                      <td className="py-2 pr-4">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${severityClass(d.severity)}`}>{d.severity}</span>
                      </td>
                      <td className="py-2 pr-4 text-slate-600">{d.attempts}</td>
                      <td className="py-2 pr-4 text-slate-400 text-xs">{formatDate(d.lastAttemptAt)}</td>
                      <td className="py-2 pr-4 text-red-600 text-xs max-w-[240px] truncate">{d.error ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modales CRUD: uno a la vez */}
      {formChannel === "new" && (
        <ChannelFormModal
          channel={null}
          categories={categories}
          onClose={() => setFormChannel(null)}
          onSaved={() => {
            setFormChannel(null);
            setBanner("Canal creado. La configuración quedó cifrada en reposo (AES-256-GCM).");
            load();
          }}
        />
      )}
      {typeof formChannel === "object" && formChannel !== null && (
        <ChannelFormModal
          channel={formChannel}
          categories={categories}
          onClose={() => setFormChannel(null)}
          onSaved={() => {
            setFormChannel(null);
            setBanner("Canal actualizado.");
            load();
          }}
        />
      )}
      {detailChannel && (
        <ChannelDetailModal
          channel={detailChannel}
          categories={categories}
          deliveries={deliveries}
          busyId={busyId}
          onClose={() => setDetailChannel(null)}
          onTest={testChannel}
          onToggleStatus={toggleStatus}
          onEdit={(c) => {
            setDetailChannel(null);
            setFormChannel(c);
          }}
          onDelete={deleteChannel}
        />
      )}
      {detailCategory && (
        <CategoryDetailModal
          category={detailCategory}
          channels={channels}
          onClose={() => setDetailCategory(null)}
          onSaved={(msg) => {
            setDetailCategory(null);
            setBanner(msg);
            load();
          }}
        />
      )}
    </div>
  );
}
