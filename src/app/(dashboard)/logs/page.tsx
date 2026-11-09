"use client";

import React, { useEffect, useState } from "react";
import { RefreshCw, Server, AlertTriangle, FileText, Shield, Activity, TrendingUp } from "lucide-react";
import { LogTable, type LogListItem } from "@/components/logs/LogTable";

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

  // Métricas calculadas
  const metrics = {
    total: logs.length,
    critical: logs.filter(l => l.severity === 'CRITICAL').length,
    errors: logs.filter(l => l.severity === 'ERROR').length,
    warnings: logs.filter(l => l.severity === 'WARN').length,
    untrusted: logs.filter(l => l.isUntrusted).length,
  };

  const metricCards = [
    {
      label: "Total de Eventos",
      value: metrics.total,
      icon: FileText,
      color: "indigo" as const,
      sublabel: "Últimas 24 horas",
    },
    {
      label: "Críticos",
      value: metrics.critical,
      icon: AlertTriangle,
      color: "rose" as const,
      sublabel: metrics.critical > 0 ? "requiere atención" : "sin incidentes",
    },
    {
      label: "Errores",
      value: metrics.errors,
      icon: Shield,
      color: "amber" as const,
      sublabel: `${Math.round((metrics.errors / Math.max(metrics.total, 1)) * 100)}% del total`,
    },
    {
      label: "Advertencias",
      value: metrics.warnings,
      icon: Activity,
      color: "blue" as const,
      sublabel: null,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 rounded-xl shadow-medium">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Análisis de Logs</h1>
            </div>
            <p className="text-sm text-slate-600 ml-[52px]">
              Consulta y filtrado de registros de logs de servidores supervisados en tiempo real.
            </p>
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition shadow-medium hover:shadow-large disabled:opacity-50 w-fit group"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""} group-hover:rotate-180 transition-transform duration-300`} />
            Refrescar Datos
          </button>
        </div>

        {error && (
          <div className="p-5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 shadow-soft">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Error al cargar datos</p>
              <p className="text-rose-700 mt-0.5 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Métricas KPI */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metricCards.map((metric) => {
            const Icon = metric.icon;
            return (
              <div
                key={metric.label}
                className="relative overflow-hidden bg-white rounded-2xl shadow-soft border border-slate-200 p-6 group hover:shadow-medium transition-shadow duration-200"
              >
                <div className="absolute top-0 right-0 w-32 h-32 opacity-5 group-hover:opacity-10 transition-opacity">
                  <div className={`w-full h-full bg-${metric.color}-500 rounded-full blur-3xl`} />
                </div>
                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{metric.label}</p>
                      <p className="text-3xl font-bold text-slate-900 mt-2">{metric.value}</p>
                      {metric.sublabel && (
                        <p className="text-xs text-slate-500 mt-1">{metric.sublabel}</p>
                      )}
                    </div>
                    <div className={`p-3 rounded-xl bg-${metric.color}-50`}>
                      <Icon className={`w-5 h-5 text-${metric.color}-600`} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Distribución por severidad */}
        <div className="bg-white rounded-2xl shadow-soft border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-slate-600" />
              Distribución por Severidad
            </h2>
            {metrics.untrusted > 0 && (
              <span className="text-sm text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200 font-medium">
                {metrics.untrusted} eventos no confiables
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "INFO", value: logs.filter(l => l.severity === 'INFO').length, color: "emerald" },
              { label: "ADVERTENCIA", value: logs.filter(l => l.severity === 'WARN').length, color: "amber" },
              { label: "ERROR", value: metrics.errors, color: "rose" },
              { label: "CRÍTICO", value: metrics.critical, color: "red" },
            ].map((sev) => (
              <div key={sev.label} className="text-center p-5 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
                <p className="text-3xl font-bold text-slate-900">{sev.value}</p>
                <p className="text-xs font-semibold text-slate-600 mt-2 uppercase tracking-wide">{sev.label}</p>
                <div className={`w-full h-2 rounded-full bg-${sev.color}-100 mt-3 overflow-hidden`}>
                  <div
                    className={`h-full bg-${sev.color}-500 rounded-full transition-all duration-500`}
                    style={{ width: `${Math.max((sev.value / Math.max(metrics.total, 1)) * 100, 5)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabla de logs */}
        <div className="bg-white rounded-2xl shadow-soft border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Eventos de Log</h2>
              <span className="text-sm text-slate-500">{logs.length} registros</span>
            </div>
          </div>
          <LogTable logs={logs} onRefresh={fetchLogs} isLoading={loading} />
        </div>
      </div>
    </div>
  );
}
