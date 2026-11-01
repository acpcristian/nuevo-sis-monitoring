"use client";

import React, { useState } from "react";
import { AlertTriangle, Trash2, Loader2 } from "lucide-react";

interface DecommissionDialogProps {
  serverId: string;
  serverName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function DecommissionDialog({
  serverId,
  serverName,
  isOpen,
  onClose,
  onSuccess,
}: DecommissionDialogProps) {
  const [confirmationInput, setConfirmationInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isMatched = confirmationInput.trim() === serverName;

  const handleDecommission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMatched) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/servers/${serverId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer TOKEN_SUPERADMIN",
        },
        body: JSON.stringify({
          confirmationName: confirmationInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Error al desincorporar servidor");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl border border-rose-200 max-w-md w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-100 text-rose-600 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">Retiro Permanente de Servidor</h3>
            <p className="text-xs text-rose-600 font-medium">Acción destructiva de credenciales</p>
          </div>
        </div>

        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
          <p>
            Al retirar este servidor, <strong>todas las claves privadas y contraseñas asociadas serán purgadas físicamente</strong> en reposo.
          </p>
          <p>El histórico de auditoría e incidentes pasados se preservará de forma inmutable.</p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700">
            {error}
          </div>
        )}

        <form onSubmit={handleDecommission} className="space-y-4 text-sm">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Escribe el nombre del servidor <span className="font-mono font-semibold text-rose-700">"{serverName}"</span> para confirmar:
            </label>
            <input
              type="text"
              required
              value={confirmationInput}
              onChange={(e) => setConfirmationInput(e.target.value)}
              placeholder={serverName}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono"
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
              disabled={!isMatched || loading}
              className="px-4 py-1.5 text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition flex items-center gap-1.5 disabled:opacity-40"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {loading ? "Retirando..." : "Desincorporar Servidor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

