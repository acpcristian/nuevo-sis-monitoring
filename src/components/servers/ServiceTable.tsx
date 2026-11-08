"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  PauseCircle,
  XCircle,
  Pencil,
  Trash2,
  ExternalLink,
  PlusCircle,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import type { ServiceItem } from "./ServiceCard";

interface ServiceTableProps {
  services: ServiceItem[];
  host: string;
  serverId: string;
  onEditService?: (service: ServiceItem) => void;
  onServiceDeleted?: () => void;
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

export function ServiceTable({
  services,
  host,
  serverId,
  onEditService,
  onServiceDeleted,
}: ServiceTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = async (serviceId: string) => {
    setDeletingId(serviceId);
    try {
      const res = await fetch(`/api/v1/servers/${serverId}/services?serviceId=${serviceId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "No se pudo eliminar el servicio.");
      }
      setConfirmDeleteId(null);
      if (onServiceDeleted) onServiceDeleted();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingId(null);
    }
  };

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
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {services.map((service) => {
            const cfg = STATUS_CONFIG[service.status] ?? STATUS_CONFIG.UNKNOWN;
            const StatusIcon = cfg.icon;

            const effectiveEndpoint =
              service.endpoint || (service.port ? `http://${host}:${service.port}` : null);
            const isWebLink =
              effectiveEndpoint &&
              (effectiveEndpoint.startsWith("http://") || effectiveEndpoint.startsWith("https://"));

            return (
              <tr key={service.id} className="align-middle transition-colors hover:bg-slate-50/60">
                <td className="px-4 py-3.5">
                  <div className="font-semibold text-slate-900">{service.name}</div>
                  {service.processName && (
                    <div className="font-mono text-[11px] text-slate-400 mt-0.5">{service.processName}</div>
                  )}
                </td>

                <td className="max-w-[240px] px-4 py-3.5">
                  <span className="line-clamp-2 text-slate-600">
                    {service.description || "—"}
                  </span>
                </td>

                <td className="px-4 py-3.5 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${cfg.className}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {cfg.label}
                  </span>
                </td>

                <td className="px-4 py-3.5 font-mono whitespace-nowrap">
                  {service.port ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold border border-slate-200">
                      {service.port}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onEditService && onEditService(service)}
                      className="inline-flex items-center gap-1 text-[11px] text-amber-600 hover:text-amber-700 hover:underline"
                    >
                      <PlusCircle className="w-3 h-3" />
                      Asignar puerto
                    </button>
                  )}
                </td>

                <td className="max-w-[260px] px-4 py-3.5">
                  {effectiveEndpoint ? (
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-700">
                      <span className="truncate" title={effectiveEndpoint}>
                        {service.endpoint ? service.endpoint : `${host}:${service.port}`}
                      </span>
                      {isWebLink && (
                        <a
                          href={effectiveEndpoint}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-amber-600 transition"
                          title="Abrir endpoint en nueva pestaña"
                        >
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                        </a>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onEditService && onEditService(service)}
                      className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-600 hover:underline"
                    >
                      <PlusCircle className="w-3 h-3" />
                      Configurar URL
                    </button>
                  )}
                </td>

                <td className="px-4 py-3.5 min-w-[180px]">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="text-[11px]">
                      {service.lastCheckedAt
                        ? new Date(service.lastCheckedAt).toLocaleString("es-ES", {
                            dateStyle: "short",
                            timeStyle: "medium",
                          })
                        : "Sin verificar"}
                    </span>
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

                <td className="px-4 py-3.5 text-right whitespace-nowrap">
                  {confirmDeleteId === service.id ? (
                    <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg">
                      <span className="text-[11px] font-semibold text-rose-700">¿Eliminar?</span>
                      <button
                        type="button"
                        onClick={() => handleDelete(service.id)}
                        disabled={deletingId === service.id}
                        className="px-2 py-0.5 bg-rose-600 text-white rounded text-[11px] font-bold hover:bg-rose-700"
                      >
                        {deletingId === service.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          "Sí"
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-1.5 py-0.5 text-slate-600 hover:text-slate-800 text-[11px]"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEditService && onEditService(service)}
                        className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                        title="Editar parámetros del servicio (puerto, endpoint, proceso)"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(service.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                        title="Eliminar este servicio del monitoreo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
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
