"use client";

import React, { useState } from "react";
import { Wrench, AlertCircle, Loader2 } from "lucide-react";

interface MaintenanceModalProps {
  serverId: string;
  serverName: string;
  currentState: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function MaintenanceModal({
  serverId,
  serverName,
  currentState,
  isOpen,
  onClose,
  onSuccess,
}: MaintenanceModalProps) {
  const [reason, setReason] = useState("");
  const [targetState, setTargetState] = useState<"MAINTENANCE" | "ACTIVE" | "DISABLED">(
    currentState === "MAINTENANCE" ? "ACTIVE" : "MAINTENANCE"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/servers/${serverId}/lifecycle`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer TOKEN_SUPERADMIN",
        },
        body: JSON.stringify({
          newState: targetState,
          reason: reason || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Error al actualizar ciclo de vida");
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Gestión de Ciclo de Vida</h3>
            <p className="text-xs text-slate-500">{serverName}</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Estado de Destino</label>
            <select
              value={targetState}
              onChange={(e) => setTargetState(e.target.value as "MAINTENANCE" | "ACTIVE" | "DISABLED")}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              <option value="MAINTENANCE">Mantenimiento Programado (Silenciar Alertas)</option>
              <option value="ACTIVE">Activo (Reanudar Monitoreo Normal)</option>
              <option value="DISABLED">Deshabilitado Administrativamente</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Motivo del Cambio {targetState === "MAINTENANCE" && "*"}
            </label>
            <textarea
              required={targetState === "MAINTENANCE"}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Parcheo de seguridad, actualización de kernel o intervención física..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {loading ? "Aplicando..." : "Confirmar Cambio"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

