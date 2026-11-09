"use client";

import React, { useState, FormEvent } from "react";
import { X, Loader2, Save, Bell } from "lucide-react";
import { CHANNEL_TYPE_LABELS, type ChannelType, type Channel, type NotificationCategory } from "./types";

/**
 * Modal unificado de creación/edición de canal (CRUD), con suscripción a
 * categorías del sistema. Único punto donde se configura un canal.
 */
interface ChannelFormModalProps {
  channel: Channel | null; // null = creación
  categories: NotificationCategory[];
  onClose: () => void;
  onSaved: () => void;
}

const EMPTY_FORM = {
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
};

export function ChannelFormModal({ channel, categories, onClose, onSaved }: ChannelFormModalProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [subscriptions, setSubscriptions] = useState<string[]>(channel?.categories ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(channel);

  // Al abrir en modo edición, precargar la config known a partir del summary.
  React.useEffect(() => {
    if (!channel) return;
    const summary = channel.configSummary ?? {};
    setForm((f) => ({
      ...f,
      type: channel.type,
      name: channel.name,
      description: channel.description ?? "",
      smtpHost: typeof summary.smtpHost === "string" ? summary.smtpHost : "",
      toAddresses: Array.isArray(summary.toAddresses) ? summary.toAddresses.join(", ") : "",
      fromAddress: typeof summary.fromAddress === "string" ? summary.fromAddress : "",
    }));
  }, [channel]);

  const buildConfig = (): Record<string, unknown> | null | { keepExisting: true } => {
    if (form.type === "SLACK" || form.type === "WEBHOOK") {
      if (!form.webhookUrl.trim()) return isEdit && !form.webhookUrl.trim() ? { keepExisting: true } : null;
      return { webhookUrl: form.webhookUrl.trim() };
    }
    if (form.type === "PAGERDUTY") {
      if (!form.routingKey.trim()) return isEdit ? { keepExisting: true } : null;
      return { routingKey: form.routingKey.trim() };
    }
    if (form.type === "EMAIL") {
      if (!form.smtpHost.trim() || !form.toAddresses.trim()) return isEdit ? { keepExisting: true } : null;
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const config = buildConfig();
    if (config === null || ("keepExisting" in config && !isEdit)) {
      setError("Completa la configuración requerida para el tipo de canal seleccionado.");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { name: form.name.trim(), description: form.description.trim() || undefined, categories: subscriptions };
      if (!("keepExisting" in config)) payload.config = config;
      if (!isEdit) payload.type = form.type;

      const res = await fetch(isEdit ? `/api/v1/channels/${channel!.id}` : "/api/v1/channels", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Error al guardar el canal.");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={submit}
        className="relative bg-white rounded-2xl shadow-large border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl">
              <Bell className="w-5 h-5 text-amber-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">
              {isEdit ? "Editar canal" : "Nuevo canal de notificación"}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo *</label>
            <select
              value={form.type}
              disabled={isEdit}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ChannelType }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-500"
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

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Suscribir a categorías del sistema
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={subscriptions.length === 0}
                onChange={(e) => setSubscriptions(e.target.checked ? [] : categories.map((c) => c.code))}
                disabled={categories.length === 0}
              />
              <span className="font-medium">Todas las categorías</span>
            </label>
            {categories.map((cat) => (
              <label
                key={cat.code}
                className="flex items-center gap-2 text-sm text-slate-700"
                title={`${cat.description ?? ""} · Se dispara cuando: ${cat.triggerInfo ?? "—"}`}
              >
                <input
                  type="checkbox"
                  checked={subscriptions.includes(cat.code)}
                  onChange={(e) =>
                    setSubscriptions(
                      e.target.checked ? [...subscriptions, cat.code] : subscriptions.filter((c) => c !== cat.code)
                    )
                  }
                />
                {cat.name}
              </label>
            ))}
            <p className="sm:col-span-2 text-[11px] text-slate-500">
              Si dejas sin marcar ninguna categoría individual (y desmarcas &quot;Todas&quot;), el canal recibirá todo.
            </p>
          </div>
        </div>

        {(form.type === "SLACK" || form.type === "WEBHOOK") && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              URL del webhook {isEdit ? "(dejar vacío mantiene la actual)" : "*"}
            </label>
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
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Routing key {isEdit ? "(dejar vacío mantiene la actual)" : "*"}
            </label>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Servidor SMTP*</label>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña SMTP (si se deja vacía, se conserva)</label>
              <input type="password" value={form.smtpPassword} onChange={(e) => setForm((f) => ({ ...f, smtpPassword: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Remitente</label>
              <input value={form.fromAddress} onChange={(e) => setForm((f) => ({ ...f, fromAddress: e.target.value }))} placeholder="monitoreo@elalto.gob.bo" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Destinatarios (separados por coma)*</label>
              <input value={form.toAddresses} onChange={(e) => setForm((f) => ({ ...f, toAddresses: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
        )}

        <p className="text-xs text-slate-400">
          Las credenciales se almacenan cifradas (AES-256-GCM) y nunca se devuelven por la API; solo se muestra un resumen sin secretos.
        </p>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar canal
          </button>
        </div>
      </form>
    </div>
  );
}

export { CHANNEL_TYPE_LABELS };
