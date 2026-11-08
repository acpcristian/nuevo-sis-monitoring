"use client";

import React, { useState, useEffect } from "react";
import { Loader2, Globe, Cpu, Hash, AlignLeft, Tag } from "lucide-react";
import type { ServiceItem } from "./ServiceCard";

interface EditServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  serverId: string;
  serverHost: string;
  service: ServiceItem | null;
}

export function EditServiceModal({
  isOpen,
  onClose,
  onSuccess,
  serverId,
  serverHost,
  service,
}: EditServiceModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    port: "",
    endpoint: "",
    processName: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (service) {
      setFormData({
        name: service.name || "",
        description: service.description || "",
        port: service.port ? String(service.port) : "",
        endpoint: service.endpoint || "",
        processName: service.processName || "",
      });
      setError(null);
    }
  }, [service]);

  if (!isOpen || !service) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("El nombre del servicio es obligatorio.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const parsedPort = formData.port.trim() ? parseInt(formData.port.trim(), 10) : null;
      if (parsedPort !== null && (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535)) {
        throw new Error("El puerto debe ser un número entero entre 1 y 65535.");
      }

      const res = await fetch(`/api/v1/servers/${serverId}/services`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId: service.id,
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          port: parsedPort,
          endpoint: formData.endpoint.trim() || null,
          processName: formData.processName.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Error al actualizar el servicio.");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleSuggestEndpoint = () => {
    const port = formData.port.trim();
    if (port) {
      const scheme = port === "443" ? "https" : "http";
      setFormData((prev) => ({
        ...prev,
        endpoint: `${scheme}://${serverHost}:${port}/`,
      }));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Editar Servicio</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configura los parámetros de monitoreo para <span className="font-semibold text-slate-700">{service.name}</span>
            </p>
          </div>
          <span
            className={`px-2.5 py-1 text-[11px] font-bold rounded-full ${
              service.status === "RUNNING"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-slate-100 text-slate-600 border border-slate-200"
            }`}
          >
            {service.status}
          </span>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              Nombre del Servicio *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              placeholder="nginx.service, minio-server, etc."
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                Puerto TCP (Opcional)
              </label>
              <input
                type="number"
                min="1"
                max="65535"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: e.target.value })}
                placeholder="Ej: 80, 443, 9000"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">Habilita sondeo TCP recurrente.</p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-slate-400" />
                Proceso / Imagen
              </label>
              <input
                type="text"
                value={formData.processName}
                onChange={(e) => setFormData({ ...formData, processName: e.target.value })}
                placeholder="minio/minio:latest"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">Proceso local o imagen contenedor.</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-slate-400" />
                IP / Endpoint HTTP (Opcional)
              </label>
              {formData.port && (
                <button
                  type="button"
                  onClick={handleSuggestEndpoint}
                  className="text-[11px] text-amber-600 hover:text-amber-700 font-medium"
                >
                  Sugerir endpoint
                </button>
              )}
            </div>
            <input
              type="url"
              value={formData.endpoint}
              onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
              placeholder={`http://${serverHost}:8080/health`}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              URL completa para comprobación HTTP/HTTPS. Si está vacío y tiene puerto, se usa <span className="font-mono">{serverHost}:puerto</span>.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1.5">
              <AlignLeft className="w-3.5 h-3.5 text-slate-400" />
              Descripción
            </label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detalle o rol de este servicio en la infraestructura..."
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !formData.name.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-medium hover:shadow-large transition"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Guardar Cambios
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
