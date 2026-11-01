"use client";

import React, { useEffect, useState } from "react";
import { RefreshCw, Server, Search, Filter } from "lucide-react";
import { LogTable } from "@/components/logs/LogTable";

export interface LogListItem {
  id: string;
  serverId: string | null;
  serverName: string | null;
  category: string;
  categoryName: string;
  eventTimestamp: string;
  ingestionTimestamp: string;
  severity: string;
  sanitizedMessage: string;
  isUntrusted: boolean;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/logs?limit=100", {
      });
      if (!res.ok) {
        throw new Error("No se pudo cargar los eventos de log");
      }
      const data = await res.json();
      setLogs(data.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Server className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Análisis de Logs
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Consulta y filtrado de registros de logs de servidores supervisados.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refrescar
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-3 text-rose-700 text-sm">
          <Search className="w-5 h-5 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      <LogTable logs={logs} onRefresh={fetchLogs} isLoading={loading} />
    </div>
  );
}
