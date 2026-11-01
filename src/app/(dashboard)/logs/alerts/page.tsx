"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, AlertTriangle, Server, Search, Filter } from "lucide-react";
import { AlertTable } from "@/components/alerts/AlertTable";

export interface AlertListItem {
  id: string;
  serverId: string | null;
  serverName: string | null;
  category: string | null;
  categoryName: string | null;
  patternType: string;
  eventCount: number;
  windowStart: string;
  windowEnd: string;
  severity: string;
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
}

export default function AlertsPage() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<AlertListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/alerts?limit=100", {
      });
      if (!res.ok) {
        throw new Error("No se pudo cargar las alertas");
      }
      const data = await res.json();
      setAlerts(data.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge" }),
      });
      if (!res.ok) throw new Error("Error al reconocer alerta");
      fetchAlerts();
    } catch (err: unknown) {
      console.error("Error acknowledging alert:", err);
    }
  };

  const handleResolve = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve" }),
      });
      if (!res.ok) throw new Error("Error al resolver alerta");
      fetchAlerts();
    } catch (err: unknown) {
      console.error("Error resolving alert:", err);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Gestión de Alertas
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Alertas deduplicadas por patrones anómalos (tormentas de eventos, errores repetidos).
          </p>
        </div>

        <button
          onClick={fetchAlerts}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refrescar
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-3 text-rose-700 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <AlertTable
        alerts={alerts}
        onRefresh={fetchAlerts}
        isLoading={loading}
        canMutate={true}
        onAcknowledge={handleAcknowledge}
        onResolve={handleResolve}
        onCreateIncident={(alert) => {
          const params = new URLSearchParams({
            alert_id: alert.id,
            ...(alert.serverId ? { server_id: alert.serverId } : {}),
          });
          router.push(`/incidents/new?${params.toString()}`);
        }}
      />
    </div>
  );
}