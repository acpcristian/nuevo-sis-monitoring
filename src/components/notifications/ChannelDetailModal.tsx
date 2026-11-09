"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Send,
  Loader2,
  Trash2,
  Power,
  Pencil,
  Mail,
  MessageSquare,
  Zap,
  Cloud,
  Layers,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import {
  CHANNEL_TYPE_LABELS,
  formatDate,
  type Channel,
  type Delivery,
  type NotificationCategory,
} from "./types";

const TYPE_ICON: Record<string, React.ReactNode> = {
  EMAIL: <Mail className="w-3 h-3" />,
  SLACK: <MessageSquare className="w-3 h-3" />,
  WEBHOOK: <Zap className="w-3 h-3" />,
  PAGERDUTY: <Cloud className="w-3 h-3" />,
};

/**
 * Detalle completo de un canal: información general, suscripciones por
 * categoría del sistema, entregas recientes y las acciones pertinentes
 * (probar, activar/desactivar, editar, eliminar) en un solo lugar.
 */
interface ChannelDetailModalProps {
  channel: Channel;
  categories: NotificationCategory[];
  deliveries: Delivery[];
  onClose: () => void;
  onTest: (id: string) => void;
  onToggleStatus: (channel: Channel) => void;
  onEdit: (channel: Channel) => void;
  onDelete: (id: string) => void;
  busyId: string | null;
}

export function ChannelDetailModal({
  channel,
  categories,
  deliveries,
  onClose,
  onTest,
  onToggleStatus,
  onEdit,
  onDelete,
  busyId,
}: ChannelDetailModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const channelDeliveries = deliveries.filter((d) => d.channelId === channel.id).slice(0, 8);
  const busy = busyId === channel.id;

  const subscribedLabels = channel.categories.length
    ? channel.categories.map((code) => categories.find((c) => c.code === code)?.name ?? code)
    : ["Todas las categorías"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-large border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Encabezado */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4 bg-gradient-to-r from-slate-50 to-white rounded-t-2xl">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-600">
                {TYPE_ICON[channel.type]} {CHANNEL_TYPE_LABELS[channel.type]}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${channel.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-slate-200 text-slate-500"}`}>
                {channel.status === "ACTIVE" ? "ACTIVO" : "INACTIVO"}
              </span>
              {channel.failureCount > 0 && (
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-red-100 text-red-700">
                  {channel.failureCount} fallo(s) · última: {formatDate(channel.lastFailureAt)}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900">{channel.name}</h2>
            <p className="text-sm text-slate-500">{channel.description || "Sin descripción."}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {/* Suscripciones */}
          <section className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              Suscripción a categorías del sistema
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {subscribedLabels.map((label) => (
                <span key={label} className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-medium">
                  {label}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Las categorías se gestionan desde «Editar canal» o desde la tarjeta de cada categoría.
            </p>
          </section>

          {/* Info general */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Destino configurado</h3>
              <div className="font-mono text-xs text-slate-700 break-all">
                {JSON.stringify(channel.configSummary ?? {}, null, 1)}
              </div>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Estado del canal</h3>
              <div className="space-y-1 text-xs text-slate-600">
                <div>Última prueba: {formatDate(channel.lastTestAt)}</div>
                {channel.lastTestStatus && (
                  <div className="flex items-center gap-1.5">
                    {channel.lastTestStatus === "SENT"
                      ? <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      : <AlertCircle className="w-3 h-3 text-red-500" />}
                    {channel.lastTestStatus}: {channel.lastTestDetail ?? "—"}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Entregas del canal */}
          <section className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Entregas recientes</h3>
            {channelDeliveries.length === 0 ? (
              <p className="text-xs text-slate-500">Sin entregas registradas para este canal.</p>
            ) : (
              <ul className="space-y-1.5">
                {channelDeliveries.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded font-semibold ${
                      d.status === "SENT" ? "bg-green-100 text-green-700" :
                      d.status === "RETRYING" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                    }`}>{d.status}</span>
                    <span className="text-slate-800 truncate flex-1">{d.title}</span>
                    <span className="text-slate-400">{formatDate(d.lastAttemptAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Acciones */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50 rounded-b-2xl">
          {confirmDelete ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-red-700 font-medium">¿Eliminar canal y su historial?</span>
              <button
                onClick={() => { setConfirmDelete(false); onDelete(channel.id); }}
                disabled={busy}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                Confirmar
              </button>
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded-lg text-xs border border-slate-300 bg-white hover:bg-slate-50">
                Cancelar
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" /> Eliminar canal
            </button>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(channel)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
            <button
              onClick={() => onToggleStatus(channel)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50"
            >
              <Power className="w-3.5 h-3.5" /> {channel.status === "ACTIVE" ? "Desactivar" : "Activar"}
            </button>
            <button
              onClick={() => onTest(channel.id)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Probar envío
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * CRUD del detalle de una categoría del sistema: revisa qué dispara la alerta,
 * acciones recomendadas y suscripción de canales (checkboxes).
 */
export function CategoryDetailModal({
  category,
  channels,
  onClose,
  onSaved,
}: {
  category: NotificationCategory;
  channels: Channel[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState({
    name: category.name,
    description: category.description ?? "",
    triggerInfo: category.triggerInfo ?? "",
    defaultSeverity: category.defaultSeverity,
    recommendedActions: category.recommendedActions ?? "",
  });
  const [subs, setSubs] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const ch of channels) initial[ch.id] = ch.categories.includes(category.code);
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // 1. Actualizar el contenido curado de la categoría (metadata письма).
      const res = await fetch(`/api/v1/notification-categories/${category.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Error al guardar la categoría.");
        return;
      }

      // 2. Aplicar las suscripciones cambiadas a cada canal implicado.
      const changed = channels.filter(
        (ch) => subs[ch.id] !== ch.categories.includes(category.code)
      );
      for (const ch of changed) {
        const next = subs[ch.id]
          ? Array.from(new Set([...ch.categories, category.code]))
          : ch.categories.filter((c) => c !== category.code);
        const patch = await fetch(`/api/v1/channels/${ch.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categories: next }),
        });
        if (!patch.ok) {
          setError("La categoría se guardó, pero hubo un error actualizando las suscripciones de algún canal.");
          return;
        }
      }

      onSaved("Categoría actualizada: contenido y suscripciones aplicados.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="relative bg-white rounded-2xl shadow-large border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{category.section}</p>
            <h2 className="text-lg font-bold text-slate-900">{category.name}</h2>
            <p className="text-[11px] font-mono text-slate-400">{category.code}</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Severidad por defecto</label>
            <input value={form.defaultSeverity} onChange={(e) => setForm((f) => ({ ...f, defaultSeverity: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">¿Qué es esta alerta?</label>
          <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">¿Cuándo se dispara?</label>
          <textarea value={form.triggerInfo} onChange={(e) => setForm((f) => ({ ...f, triggerInfo: e.target.value }))} rows={2} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Acciones recomendadas (una por línea)</label>
          <textarea value={form.recommendedActions} onChange={(e) => setForm((f) => ({ ...f, recommendedActions: e.target.value }))} rows={4} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Canales suscritos ({Object.values(subs).filter(Boolean).length} de {channels.length})
          </label>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            {channels.length === 0 ? (
              <p className="text-xs text-slate-500">No hay canales configurados todavía.</p>
            ) : (
              channels.map((ch) => (
                <label key={ch.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(subs[ch.id])}
                    onChange={(e) => setSubs((s) => ({ ...s, [ch.id]: e.target.checked }))}
                  />
                  <span className="font-medium">{ch.name}</span>
                  <span className="text-[11px] text-slate-400">{CHANNEL_TYPE_LABELS[ch.type]} · {ch.status === "ACTIVE" ? "activo" : "inactivo"}</span>
                </label>
              ))
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
            Guardar categoría
          </button>
        </div>
      </form>
    </div>
  );
}
