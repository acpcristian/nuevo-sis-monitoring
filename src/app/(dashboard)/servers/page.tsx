"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Server, AlertTriangle, Activity, Shield, Database, Cloud } from "lucide-react";
import { ServerTable, ServerListItem } from "@/components/servers/ServerTable";

export default function ServersPage() {
  const [servers, setServers] = useState<ServerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/servers?limit=100", {});
      if (!res.ok) {
        throw new Error("No se pudo cargar el catálogo de servidores");
      }
      const data = await res.json();
      setServers(data.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  // Métricas calculadas
  const metrics = {
    total: servers.length,
    online: servers.filter(s => s.healthStatus === 'ONLINE').length,
    degraded: servers.filter(s => s.healthStatus === 'DEGRADED').length,
    unreachable: servers.filter(s => s.healthStatus === 'UNREACHABLE' || s.healthStatus === 'AUTH_FAILED').length,
    prod: servers.filter(s => s.environment === 'PROD').length,
  };

  const metricCards = [
    {
      label: "Total de Servidores",
      value: metrics.total,
      icon: Server,
      color: "indigo" as const,
      change: null,
    },
    {
      label: "En Línea",
      value: metrics.online,
      icon: Activity,
      color: "emerald" as const,
      change: `${Math.round((metrics.online / Math.max(metrics.total, 1)) * 100)}%`,
    },
    {
      label: "Degradados",
      value: metrics.degraded,
      icon: AlertTriangle,
      color: "amber" as const,
      change: null,
    },
    {
      label: "Sin Conexión",
      value: metrics.unreachable,
      icon: Shield,
      color: "rose" as const,
      change: null,
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
                <Server className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Inventario de Servidores</h1>
            </div>
            <p className="text-sm text-slate-600 ml-[52px]">
              Supervisión centralizada de infraestructura, conectividad y estado operativo de nodos.
            </p>
          </div>

          <Link
            href="/servers/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition shadow-medium hover:shadow-large w-fit group"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
            Registrar Servidor
          </Link>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-sm shadow-soft">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Error al cargar datos</p>
              <p className="text-rose-700 mt-0.5">{error}</p>
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
                      {metric.change && (
                        <p className="text-xs text-slate-500 mt-1">{metric.change} del total</p>
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

        {/* Distribución por entorno */}
        <div className="bg-white rounded-2xl shadow-soft border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-slate-600" />
              Distribución por Entorno
            </h2>
            <span className="text-sm text-slate-500">{metrics.prod} servidores en Producción</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Producción", value: servers.filter(s => s.environment === 'PROD').length, color: "rose" },
              { label: "Staging", value: servers.filter(s => s.environment === 'STAGING').length, color: "amber" },
              { label: "Desarrollo", value: servers.filter(s => s.environment === 'DEV').length, color: "blue" },
              { label: "QA", value: servers.filter(s => s.environment === 'QA').length, color: "violet" },
            ].map((env) => (
              <div key={env.label} className="text-center p-4 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-2xl font-bold text-slate-900">{env.value}</p>
                <p className="text-xs font-medium text-slate-600 mt-1">{env.label}</p>
                <div className={`w-full h-1.5 rounded-full bg-${env.color}-100 mt-3 overflow-hidden`}>
                  <div
                    className={`h-full bg-${env.color}-500 rounded-full transition-all duration-500`}
                    style={{ width: `${Math.max((env.value / Math.max(metrics.total, 1)) * 100, 5)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabla interactiva */}
        <div className="bg-white rounded-2xl shadow-soft border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Cloud className="w-5 h-5 text-slate-600" />
                Catálogo de Servidores
              </h2>
              <span className="text-sm text-slate-500">{servers.length} registrados</span>
            </div>
          </div>
          <ServerTable servers={servers} onRefresh={fetchServers} isLoading={loading} />
        </div>
      </div>
    </div>
  );
}

