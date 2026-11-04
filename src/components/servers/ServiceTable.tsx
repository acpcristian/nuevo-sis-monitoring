"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, Clock, PauseCircle, XCircle } from "lucide-react";
import type { ServiceItem } from "./ServiceCard";

interface ServiceTableProps {
  services: ServiceItem[];
  host: string;
}

const STATUS_CONFIG: Record<
  ServiceItem["status"],
  { label: string; icon: React.ElementType; className: string }
> = {
  RUNNING: {
    label: "RUNNING",
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  STOPPED: {
    label: "STOPPED",
    icon: PauseCircle,
    className: "border-slate-200 bg-slate-100 text-slate-600",
  },
  ERROR: {
    label: "ERROR",
    icon: XCircle,
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  UNKNOWN: {
    label: "UNKNOWN",
    icon: AlertTriangle,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
};

export function ServiceTable({ services, host }: ServiceTableProps) {
  if (services.length === 0) {
    return (
      <div className="py-12 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <h3 className="text-sm font-semibold text-slate-800">No hay servicios registrados</h3>
        <p className="mt-1 text-xs text-slate-500">
          Agrega un servicio con puerto o endpoint para comenzar a monitorearlo.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs text-slate-600">
        <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
          <tr>
            <th className="px-4 py-3">Nombre</th>
            <th className="px-4 py-3">Descripción</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Puerto</th>
            <th className="px-4 py-3">IP / Endpoint</th>
            <th className="px-4 py-3">Última Verificación</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {services.map((service) => {
            const cfg = STATUS_CONFIG[service.status] ?? STATUS_CONFIG.UNKNOWN;
            const StatusIcon = cfg.icon;

            return (
              <tr key={service.id} className="align-top transition-colors hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <div className="font-semibold text-slate-900">{service.name}</div>
                  {service.processName && (
                    <div className="font-mono text-[11px] text-slate-400">{service.processName}</div>
                  )}
                </td>

                <td className="max-w-[280px] px-4 py-3">
                  <span className="line-clamp-2 text-slate-600">
                    {service.description || "—"}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${cfg.className}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {cfg.label}
                  </span>
                </td>

                <td className="px-4 py-3 font-mono text-slate-700">
                  {service.port ?? "—"}
                </td>

                <td className="max-w-[260px] px-4 py-3">
                  <span className="block truncate font-mono text-[11px] text-slate-700" title={service.endpoint ?? undefined}>
                    {service.endpoint ?? (service.port ? `${host}:${service.port}` : "—")}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    {service.lastCheckedAt
                      ? new Date(service.lastCheckedAt).toLocaleString("es-ES", {
                          dateStyle: "short",
                          timeStyle: "medium",
                        })
                      : "Sin verificar"}
                  </div>
                  {service.lastResult && (
                    <div
                      className={`mt-0.5 line-clamp-2 text-[11px] ${
                        service.status === "RUNNING" ? "text-slate-400" : "text-slate-500"
                      }`}
                      title={service.lastResult}
                    >
                      {service.lastResult}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
