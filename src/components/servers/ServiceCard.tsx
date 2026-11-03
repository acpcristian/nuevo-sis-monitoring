"use client";

import React from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  PauseCircle,
  Activity,
  Server,
  Globe,
  Cpu,
  Clock,
} from "lucide-react";

export interface ServiceItem {
  id: string;
  serverId: string;
  name: string;
  description?: string | null;
  status: "RUNNING" | "STOPPED" | "ERROR" | "UNKNOWN";
  port?: number | null;
  endpoint?: string | null;
  processName?: string | null;
  lastCheckedAt?: string | null;
  lastResult?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ServiceCardProps {
  service: ServiceItem;
  onRefresh?: () => void;
}

export function ServiceCard({ service, onRefresh }: ServiceCardProps) {
  const statusConfig: Record<
    ServiceItem["status"],
    { label: string; icon: React.ElementType; color: string; bg: string; border: string }
  > = {
    RUNNING: {
      label: "Activo",
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
    },
    STOPPED: {
      label: "Detenido",
      icon: PauseCircle,
      color: "text-slate-500",
      bg: "bg-slate-50",
      border: "border-slate-200",
    },
    ERROR: {
      label: "Error",
      icon: XCircle,
      color: "text-rose-600",
      bg: "bg-rose-50",
      border: "border-rose-200",
    },
    UNKNOWN: {
      label: "Desconocido",
      icon: AlertTriangle,
      color: "text-amber-600",
      bg: "bg-amber-50",
      border: "border-amber-200",
    },
  };

  const cfg = statusConfig[service.status] ?? statusConfig.UNKNOWN;
  const StatusIcon = cfg.icon;

  return (
    <div className="bg-white rounded-xl shadow-soft border border-slate-200 p-5 hover:shadow-medium transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${cfg.bg} border ${cfg.border}`}>
            <StatusIcon className={`w-5 h-5 ${cfg.color}`} />
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-slate-900 truncate">{service.name}</h4>
            {service.processName && (
              <p className="text-xs text-slate-500 font-mono mt-0.5">{service.processName}</p>
            )}
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color} border ${cfg.border}`}
        >
          <StatusIcon className="w-3.5 h-3.5" />
          {cfg.label}
        </span>
      </div>

      {service.description && (
        <p className="text-sm text-slate-600 mt-3 line-clamp-2">{service.description}</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
        {service.port && (
          <div className="flex items-center gap-1.5 text-slate-600">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>Puerto: <span className="font-mono font-medium text-slate-800">{service.port}</span></span>
          </div>
        )}
        {service.endpoint && (
          <div className="flex items-center gap-1.5 text-slate-600">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-mono truncate">{service.endpoint}</span>
          </div>
        )}
        {service.lastCheckedAt && (
          <div className="flex items-center gap-1.5 text-slate-500">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Verificado: {new Date(service.lastCheckedAt).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</span>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-slate-500">
          <Cpu className="w-3.5 h-3.5 text-slate-400" />
          <span>Actualizado: {new Date(service.updatedAt).toLocaleString("es-ES", { dateStyle: "short", timeStyle: "short" })}</span>
        </div>
      </div>

      {service.lastResult && service.status !== "RUNNING" && (
        <div className="mt-3 p-2.5 bg-slate-50 rounded-lg border border-slate-100">
          <p className="text-xs text-slate-600">
            <span className="font-semibold">Último resultado:</span> {service.lastResult}
          </p>
        </div>
      )}
    </div>
  );
}

export function ServiceEmptyState() {
  return (
    <div className="bg-white rounded-2xl shadow-soft border border-slate-200 p-12 text-center">
      <Server className="w-12 h-12 text-slate-300 mx-auto mb-3" />
      <h3 className="text-lg font-semibold text-slate-800">No hay servicios registrados</h3>
      <p className="text-sm text-slate-500 mt-1">
        Este servidor no tiene servicios configurados para monitoreo.
      </p>
    </div>
  );
}