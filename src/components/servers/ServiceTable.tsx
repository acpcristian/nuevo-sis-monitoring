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
  Power,
  RotateCw,
  Ban,
  Play,
} from "lucide-react";
import type { ServiceItem } from "./ServiceCard";

interface ServiceTableProps {
  services: ServiceItem[];
  host: string;
  serverId: string;
  onEditService?: (service: ServiceItem) => void;
  onServiceDeleted?: () => void;
  onActionComplete?: () => void;
}

export function ServiceTable({
  services,
  host,
  serverId,
  onEditService,
  onServiceDeleted,
  onActionComplete,
}: ServiceTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<{ id: string; action: string } | null>(null);

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

  const handleServiceControl = async (serviceId: string, action: "start" | "stop" | "restart" | "enable" | "disable") => {
    setActionLoading({ id: serviceId, action });
    try {
      const res = await fetch(`/api/v1/servers/${serverId}/services/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId, action }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.message || `Fallo al ejecutar '${action}' en el servicio.`);
      }
      if (onActionComplete) onActionComplete();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setActionLoading(null);
    }
  };

  if (services.length === 0) {
    return (
      <div className="py-12 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-slate-300" />
        <h3 className="text-sm font-semibold text-slate-800">No hay servicios registrados</h3>
        <p className="mt-1 text-xs text-slate-500">
          Agrega o sincroniza los servicios del servidor para comenzar a monitorearlos.
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
            <th className="px-4 py-3 text-center">Acciones del Servicio</th>
            <th className="px-4 py-3 text-right">Gestión</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {services.map((service) => {
            const isRunning = service.status === "RUNNING";
            const isStopped = service.status === "STOPPED";
            const isError = service.status === "ERROR";

            const effectiveEndpoint =
              service.endpoint || (service.port ? `http://${host}:${service.port}` : null);
            const isWebLink =
              effectiveEndpoint &&
              (effectiveEndpoint.startsWith("http://") || effectiveEndpoint.startsWith("https://"));

            const isCurrentAction = actionLoading?.id === service.id;

            return (
              <tr key={service.id} className="align-middle transition-colors hover:bg-slate-50/60">
                <td className="px-4 py-3.5">
                  <div className="font-semibold text-slate-900">{service.name}</div>
                  {service.processName && (
                    <div className="font-mono text-[11px] text-slate-400 mt-0.5">{service.processName}</div>
                  )}
                </td>

                <td className="max-w-[220px] px-4 py-3.5">
                  <div className="line-clamp-2 text-slate-600">
                    {service.description || "—"}
                  </div>
                  {/* Etiqueta informativa para servicios del sistema operativo/kernel */}
                  {(service.name.startsWith("kmod") ||
                    service.name.startsWith("systemd") ||
                    service.name === "containerd.service") && (
                    <span className="inline-block mt-1 text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">
                      Servicio base SO (no requiere puerto web)
                    </span>
                  )}
                </td>

                {/* Columna ESTADO con SWITCH (Prendido / Apagado / Fallido) */}
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-2.5">
                    {/* Switch interactivo */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isRunning}
                      disabled={isCurrentAction}
                      onClick={() => handleServiceControl(service.id, isRunning ? "stop" : "start")}
                      title={isRunning ? "Hacer clic para Apagar el servicio" : "Hacer clic para Prender el servicio"}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 ${
                        isRunning ? "bg-emerald-600" : isError ? "bg-rose-500" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                          isRunning ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>

                    {/* Badge con diseño fiel al modelo */}
                    {isRunning && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-emerald-200 bg-emerald-50 text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Prendido
                      </span>
                    )}

                    {isStopped && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium border border-slate-300 bg-slate-100 text-slate-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                        Apagado
                      </span>
                    )}

                    {isError && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-rose-200 bg-rose-50 text-rose-700">
                        ▲ Fallido
                      </span>
                    )}

                    {!isRunning && !isStopped && !isError && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-amber-200 bg-amber-50 text-amber-700">
                        <AlertTriangle className="h-3 w-3" />
                        Desconocido
                      </span>
                    )}
                  </div>
                </td>

                {/* Columna PUERTO */}
                <td className="px-4 py-3.5 font-mono whitespace-nowrap">
                  {service.port ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold border border-slate-200">
                      {service.port}
                    </span>
                  ) : (
                    <span className="text-slate-400 font-sans text-[11px]">—</span>
                  )}
                </td>

                {/* Columna IP / ENDPOINT */}
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
                    <span className="text-slate-400 font-sans text-[11px]">—</span>
                  )}
                </td>

                <td className="px-4 py-3.5 min-w-[160px]">
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
                        isRunning ? "text-slate-400" : "text-slate-500"
                      }`}
                      title={service.lastResult}
                    >
                      {service.lastResult}
                    </div>
                  )}
                </td>

                {/* Columna ACCIONES DEL SERVICIO (Arrancar, Reiniciar, Deshabilitar auto-arranque) */}
                <td className="px-4 py-3.5 text-center whitespace-nowrap">
                  <div className="inline-flex flex-col gap-1 items-center">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={isCurrentAction}
                        onClick={() => handleServiceControl(service.id, isRunning ? "stop" : "start")}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition shadow-xs disabled:opacity-50 ${
                          isRunning
                            ? "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                            : "bg-cyan-700 hover:bg-cyan-800 text-white border-cyan-800"
                        }`}
                        title={isRunning ? "Detener servicio" : "Arrancar servicio"}
                      >
                        {isCurrentAction && (actionLoading?.action === "start" || actionLoading?.action === "stop") ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : isRunning ? (
                          <Power className="w-3 h-3" />
                        ) : (
                          <Play className="w-3 h-3" />
                        )}
                        {isRunning ? "Detener" : "Arrancar"}
                      </button>

                      <button
                        type="button"
                        disabled={isCurrentAction}
                        onClick={() => handleServiceControl(service.id, "restart")}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold border border-slate-700 bg-slate-800 hover:bg-slate-900 text-cyan-200 transition shadow-xs disabled:opacity-50"
                        title="Reiniciar servicio"
                      >
                        {isCurrentAction && actionLoading?.action === "restart" ? (
                          <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                        ) : (
                          <RotateCw className="w-3 h-3" />
                        )}
                        Reiniciar
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={isCurrentAction}
                      onClick={() => handleServiceControl(service.id, "disable")}
                      className="w-full text-center px-2 py-0.5 rounded-md text-[10px] font-medium border border-slate-300/80 bg-slate-100 hover:bg-slate-200 text-slate-700 transition disabled:opacity-50"
                      title="Deshabilitar auto-arranque en el inicio del sistema (systemctl disable / docker update --restart=no)"
                    >
                      {isCurrentAction && actionLoading?.action === "disable" ? (
                        <span className="inline-flex items-center gap-1 justify-center">
                          <Loader2 className="w-2.5 h-2.5 animate-spin" />
                          Deshabilitando...
                        </span>
                      ) : (
                        "Deshabilitar auto-arranque"
                      )}
                    </button>
                  </div>
                </td>

                {/* Columna GESTIÓN CRUD (Editar / Eliminar) */}
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
                        title="Editar parámetros del servicio"
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
