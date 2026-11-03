"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3, RefreshCw, Download, Activity, Siren, ScrollText, Bell,
  Timer, AlertTriangle, TrendingUp, Server, Loader2,
} from "lucide-react";

interface Bucket { label: string; count: number }

interface Overview {
  generatedAt: string;
  servers: { byHealthStatus: Bucket[]; byEnvironment: Bucket[] };
  incidents: {
    byStatus: Bucket[];
    openByPriority: Bucket[];
    openSlaBreached: number;
    slaMetPct7d: number | null;
    mttrMedianMinutes: number | null;
  };
  logs: { ingest24h: number; bySeverity24h: Bucket[]; hourly24h: number[] };
  alerts: { topPatterns: { pattern: string; alerts: number; events: number }[] };
  channels: Bucket[];
}

const HEALTH_COLORS: Record<string, string> = {
  ONLINE: "bg-emerald-500",
  DEGRADED: "bg-amber-500",
  UNREACHABLE: "bg-rose-500",
  AUTH_FAILED: "bg-purple-500",
  PENDING: "bg-slate-400",
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-rose-500",
  ASSIGNED: "bg-amber-500",
  IN_PROGRESS: "bg-blue-500",
  RESOLVED: "bg-emerald-500",
  CLOSED: "bg-slate-400",
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "bg-rose-600",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-yellow-400",
  LOW: "bg-slate-400",
};

const SEVERITY_COLORS: Record<string, string> = {
  INFO: "bg-emerald-500",
  WARN: "bg-amber-500",
  ERROR: "bg-rose-500",
  CRITICAL: "bg-rose-700",
};

function KpiCard({
  icon: Icon, label, value, hint, tone = "slate",
}: {
  icon: React.ElementType; label: string; value: React.ReactNode; hint?: string;
  tone?: "slate" | "rose" | "emerald" | "indigo" | "amber";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600",
    rose: "bg-rose-100 text-rose-600",
    emerald: "bg-emerald-100 text-emerald-600",
    indigo: "bg-indigo-100 text-indigo-600",
    amber: "bg-amber-100 text-amber-600",
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span className={`w-7 h-7 rounded-lg inline-flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-4 h-4" />
        </span>
        {label}
      </div>
      <div className="mt-3 text-2xl font-bold text-slate-900 tabular-nums">{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

function Bars({ data, colors }: { data: Bucket[]; colors: Record<string, string> }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  return (
    <div className="space-y-2">
      {data.length === 0 && <p className="text-sm text-slate-400">Sin datos.</p>}
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-sm">
          <span className="w-28 text-xs text-slate-500 truncate">{d.label}</span>
          <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${colors[d.label] ?? "bg-indigo-500"}`}
              style={{ width: `${Math.max(3, (d.count / total) * 100)}%` }}
            />
          </div>
          <span className="w-8 text-right text-xs font-semibold text-slate-600 tabular-nums">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const w = 560;
  const h = 100;
  const barW = w / Math.max(values.length, 1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24" role="img" aria-label="Eventos por hora (24 h)">
      {values.map((v, i) => {
        const bh = Math.max(1, (v / max) * (h - 6));
        return (
          <rect
            key={i}
            x={i * barW + 1}
            y={h - bh}
            width={Math.max(1, barW - 2)}
            height={bh}
            rx={2}
            className="fill-indigo-500/80 hover:fill-indigo-600 transition-colors"
          >
            <title>{`hace ${23 - i} h: ${v} evento(s)`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

export default function MetricsPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/metrics/overview");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? "No se pudieron cargar las métricas");
      }
      setData(await res.json());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalServers = data ? data.servers.byHealthStatus.reduce((s, b) => s + b.count, 0) : 0;
  const healthy = data?.servers.byHealthStatus.find((b) => b.label === "ONLINE")?.count ?? 0;
  const openIncidents = data
    ? data.incidents.byStatus
        .filter((b) => ["OPEN", "ASSIGNED", "IN_PROGRESS"].includes(b.label))
        .reduce((s, b) => s + b.count, 0)
    : 0;

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Métricas y KPIs</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Salud de la plataforma, operación de incidentes y volumen de telemetría.
            {data && <span className="text-slate-400"> · actualizado {new Date(data.generatedAt).toLocaleTimeString("es-BO")}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refrescar
          </button>
          <a
            href="/api/v1/metrics/export?dataset=incidents&format=csv"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            <Download className="w-4 h-4" /> Exportar incidentes (CSV)
          </a>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      {loading && !data ? (
        <div className="py-16 text-center text-sm text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Calculando KPIs…
        </div>
      ) : data ? (
        <>
          {/* KPIs principales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={Server}
              label="Servidores monitoreados"
              value={totalServers}
              hint={`${healthy} en línea · ${totalServers - healthy} con alerta`}
              tone="indigo"
            />
            <KpiCard
              icon={Siren}
              label="Incidentes abiertos"
              value={openIncidents}
              hint={`${data.incidents.openSlaBreached} con SLA vencido`}
              tone={data.incidents.openSlaBreached > 0 ? "rose" : "emerald"}
            />
            <KpiCard
              icon={Timer}
              label="Cumplimiento SLA (7 d)"
              value={data.incidents.slaMetPct7d === null ? "—" : `${data.incidents.slaMetPct7d}%`}
              hint="Resueltos dentro del plazo"
              tone="emerald"
            />
            <KpiCard
              icon={TrendingUp}
              label="MTTR mediano"
              value={
                data.incidents.mttrMedianMinutes === null
                  ? "—"
                  : data.incidents.mttrMedianMinutes < 60
                    ? `${Math.round(data.incidents.mttrMedianMinutes)} min`
                    : `${(data.incidents.mttrMedianMinutes / 60).toFixed(1)} h`
              }
              hint="Tiempo medio de resolución"
              tone="amber"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-4">
                <Activity className="w-4 h-4 text-indigo-600" /> Salud de servidores
              </h2>
              <Bars data={data.servers.byHealthStatus} colors={HEALTH_COLORS} />
              <p className="text-xs text-slate-400 mt-4 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                La ausencia de telemetría nunca se interpreta como salud (Principio VIII).
              </p>
            </section>

            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-4">
                <Siren className="w-4 h-4 text-rose-600" /> Incidentes por estado
              </h2>
              <Bars data={data.incidents.byStatus} colors={STATUS_COLORS} />
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-4 mb-2">
                Abiertos por prioridad
              </h3>
              <Bars data={data.incidents.openByPriority} colors={PRIORITY_COLORS} />
            </section>

            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-1">
                <ScrollText className="w-4 h-4 text-indigo-600" /> Ingesta de logs
              </h2>
              <p className="text-xs text-slate-400 mb-3">
                {data.logs.ingest24h.toLocaleString("es-BO")} eventos en las últimas 24 h
              </p>
              <Sparkline values={data.logs.hourly24h} />
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
                {data.logs.bySeverity24h.map((s) => (
                  <div key={s.label} className="rounded-lg border border-slate-100 px-2 py-1.5">
                    <div className="text-[10px] text-slate-400">{s.label}</div>
                    <div className="text-sm font-semibold text-slate-800 tabular-nums">{s.count}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800 mb-4">
                <Bell className="w-4 h-4 text-amber-600" /> Alertas y canales
              </h2>
              {data.alerts.topPatterns.length === 0 ? (
                <p className="text-sm text-slate-400">Sin patrones de alerta registrados.</p>
              ) : (
                <ul className="space-y-2">
                  {data.alerts.topPatterns.map((p) => (
                    <li key={p.pattern} className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-mono text-xs text-slate-600 truncate max-w-[240px]">{p.pattern}</span>
                      <span className="text-xs text-slate-500 whitespace-nowrap">
                        {p.alerts} alerta(s) · {p.events} evento(s)
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex gap-2 text-xs">
                <span className="text-slate-500">Canales:</span>
                {data.channels.length === 0 ? (
                  <span className="text-slate-400">ninguno</span>
                ) : (
                  data.channels.map((c) => (
                    <span key={c.label} className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {c.label}: {c.count}
                    </span>
                  ))
                )}
              </div>
            </section>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <span className="text-slate-500">Más exportaciones:</span>
            <Link href="/api/v1/metrics/export?dataset=servers&format=csv" className="text-indigo-600 hover:underline">
              Servidores (CSV)
            </Link>
            <span className="text-slate-300">·</span>
            <Link href="/api/v1/metrics/export?dataset=events&format=json" className="text-indigo-600 hover:underline">
              Eventos (JSON)
            </Link>
            <span className="text-slate-300">·</span>
            <Link href="/api/v1/metrics/export?dataset=incidents&format=json" className="text-indigo-600 hover:underline">
              Incidentes (JSON)
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}
