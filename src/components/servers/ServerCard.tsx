"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Clock, Cpu, Globe2, Server as ServerIcon } from "lucide-react";
import type { GlobalServerStatus } from "@/core/domain/server.types";
import { ServerStatusBadge } from "./ServerStatusBadge";
import type { ServerListItem } from "./server-list-item";

interface ServerCardProps {
  server: ServerListItem;
}

const STATUS_CONFIG: Record<
  GlobalServerStatus,
  { label: string; dot: string; text: string; bg: string; border: string }
> = {
  ONLINE: {
    label: "Online",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  WARNING: {
    label: "Warning",
    dot: "bg-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  OFFLINE: {
    label: "Offline",
    dot: "bg-rose-500",
    text: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
  },
  PENDING: {
    label: "Pendiente",
    dot: "bg-slate-400",
    text: "text-slate-600",
    bg: "bg-slate-100",
    border: "border-slate-200",
  },
};

const ENV_STYLES: Record<string, string> = {
  PROD: "bg-rose-50 text-rose-700 border-rose-200",
  STAGING: "bg-amber-50 text-amber-700 border-amber-200",
  DEV: "bg-sky-50 text-sky-700 border-sky-200",
  QA: "bg-violet-50 text-violet-700 border-violet-200",
};

export function ServerCard({ server }: ServerCardProps) {
  const globalStatus = server.globalStatus ?? "PENDING";
  const cfg = STATUS_CONFIG[globalStatus];
  const total = server.serviceCount ?? 0;
  const running = server.servicesRunning ?? 0;
  const down = server.servicesDown ?? 0;
  const isActive = server.lifecycleState === "ACTIVE";

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-soft transition-shadow duration-200 hover:shadow-medium">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
            <ServerIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <Link
              href={`/servers/${server.id}`}
              className="block truncate text-base font-semibold text-slate-900 transition hover:text-indigo-600"
              title={server.name}
            >
              {server.name}
            </Link>
            <p className="mt-0.5 truncate font-mono text-xs text-slate-500">
              {server.ipAddress}
              {server.hostname ? ` · ${server.hostname}` : ""}
            </p>
          </div>
        </div>

        <span
          className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            ENV_STYLES[server.environment] ?? "border-slate-200 bg-slate-100 text-slate-600"
          }`}
        >
          {server.environment}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text} ${cfg.border}`}
          title={isActive ? "Estado agregado de conectividad y servicios" : "Servidor fuera de monitoreo activo"}
        >
          <span className="relative flex h-2 w-2">
            {globalStatus === "ONLINE" && (
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${cfg.dot} opacity-60`} />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${cfg.dot}`} />
          </span>
          {cfg.label}
        </span>

        {!isActive && (
          <ServerStatusBadge healthStatus={server.healthStatus} lifecycleState={server.lifecycleState} size="sm" />
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
          <dt className="flex items-center gap-1 text-slate-500">
            <Cpu className="h-3.5 w-3.5" />
            Servicios
          </dt>
          <dd className="mt-1 font-semibold text-slate-900">
            {running}
            <span className="font-normal text-slate-500"> / {total} en ejecución</span>
          </dd>
        </div>

        <div className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
          <dt className="flex items-center gap-1 text-slate-500">
            <Globe2 className="h-3.5 w-3.5" />
            Con problemas
          </dt>
          <dd className={`mt-1 font-semibold ${down > 0 ? "text-rose-600" : "text-slate-900"}`}>
            {down}
            {server.servicesUnknown ? (
              <span className="ml-1 font-normal text-slate-500">+{server.servicesUnknown} sin verificar</span>
            ) : null}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
        <Clock className="h-3.5 w-3.5 text-slate-400" />
        <span>
          {server.lastCheckedAt
            ? `Última verificación: ${new Date(server.lastCheckedAt).toLocaleString("es-ES", {
                dateStyle: "short",
                timeStyle: "short",
              })}`
            : "Sin verificación todavía"}
        </span>
      </div>

      <div className="mt-auto pt-4">
        <Link
          href={`/servers/${server.id}`}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
        >
          Ver Detalles
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </article>
  );
}
