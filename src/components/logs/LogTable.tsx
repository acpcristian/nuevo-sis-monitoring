"use client";

import React, { useState, useCallback } from "react";
import {
  Search,
  Filter,
  RefreshCw,
  Clock,
  Shield,
  Activity,
  Layers,
  Wrench,
} from "lucide-react";
import { LogCategoryBadge } from "./LogCategoryBadge";
import { LogDetailModal } from "./LogDetailModal";
import { describeLogEvent, describeSeverity, SERVICE_STATUS_LABELS } from "@/core/domain/log-knowledge";

export interface LogListItem {
  id: string;
  serverId: string | null;
  serverName: string | null;
  serviceId: string | null;
  serviceName: string | null;
  serviceStatus: string | null;
  category: string;
  categoryName: string;
  categoryDescription?: string | null;
  categoryCommonCauses?: string | null;
  categorySolutions?: string | null;
  eventTimestamp: string;
  ingestionTimestamp: string;
  eventType?: string | null;
  severity: string;
  sanitizedMessage: string;
  isUntrusted: boolean;
}

interface LogTableProps {
  logs: LogListItem[];
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function LogTable({ logs, onRefresh, isLoading }: LogTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [selectedLog, setSelectedLog] = useState<LogListItem | null>(null);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.sanitizedMessage.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.serverName && log.serverName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      log.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      selectedCategory === "ALL" || log.category === selectedCategory;

    const matchesSeverity =
      selectedSeverity === "ALL" || log.severity === selectedSeverity;

    return matchesSearch && matchesCategory && matchesSeverity;
  });

  const categories = [
    { value: "SYS_KERNEL", label: "Sistema/Kernel" },
    { value: "AUTH_ACCESS", label: "Autenticación" },
    { value: "SSH_NETWORK", label: "Red/SSH" },
    { value: "SYSTEM_SERVICE", label: "Servicios" },
    { value: "WEB_APP", label: "Web" },
    { value: "DATABASE", label: "Base de Datos" },
    { value: "STORAGE_HW", label: "Almacenamiento" },
    { value: "BACKUP_TASK", label: "Backups" },
    { value: "SECURITY_AUDIT", label: "Seguridad" },
    { value: "AGENT_ERROR", label: "Agente" },
  ];

  return (
    <div className="bg-white rounded-2xl shadow-soft border border-slate-200 overflow-hidden">
      <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between bg-gradient-to-r from-slate-50 to-white">
        <div className="relative w-full lg:w-96">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por mensaje, servidor o ID..."
            className="w-full pl-11 pr-4 py-3 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none shadow-soft transition-all"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs">
            <Activity className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-transparent focus:outline-none text-slate-700 cursor-pointer font-medium"
            >
              <option value="ALL">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="bg-transparent focus:outline-none text-slate-700 cursor-pointer font-medium"
            >
              <option value="ALL">Todas las severidades</option>
              <option value="INFO">Info</option>
              <option value="WARN">Advertencia</option>
              <option value="ERROR">Error</option>
              <option value="CRITICAL">Crítico</option>
            </select>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Refrescar"
              className="p-1.5 bg-white border border-slate-300 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-600 border-b border-slate-200">
            <tr>
              <th className="py-4 px-6 font-semibold">Fecha del Evento</th>
              <th className="py-4 px-6 font-semibold">Categoría</th>
              <th className="py-4 px-6 font-semibold">Severidad</th>
              <th className="py-4 px-6 font-semibold">Servidor / Servicio</th>
              <th className="py-4 px-6 font-semibold">Qué pasó</th>
              <th className="py-4 px-6 text-right font-semibold">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-slate-400">
                  No se encontraron eventos de log coincidentes con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-mono text-xs text-slate-700">
                      {new Date(log.eventTimestamp).toLocaleString("es-ES", {
                        timeZoneName: "short",
                      })}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <LogCategoryBadge category={log.category} size="sm" />
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        log.severity === "INFO"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : log.severity === "WARN"
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : log.severity === "ERROR"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-rose-100 text-rose-800 border-rose-200"
                      }`}
                    >
                      {log.severity}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="space-y-1.5">
                      <div className="text-sm text-slate-700 font-medium">
                        {log.serverName || "No asignado"}
                        {log.isUntrusted && (
                          <span className="ml-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 align-middle">
                            no confiable
                          </span>
                        )}
                      </div>
                      {log.serviceName ? (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-medium ${
                            SERVICE_STATUS_LABELS[log.serviceStatus ?? "UNKNOWN"]?.badgeClass ??
                            "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                          title={`Estado del servicio: ${SERVICE_STATUS_LABELS[log.serviceStatus ?? "UNKNOWN"]?.label ?? log.serviceStatus ?? "desconocido"}`}
                        >
                          <Wrench className="w-3 h-3" />
                          {log.serviceName}
                        </span>
                      ) : (
                        <div className="text-xs text-slate-400 italic">sin servicio identificado</div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 max-w-md">
                    {/* Lectura descriptiva para decidir rápido, con el mensaje
                        técnico original de referencia. */}
                    <div className="text-sm text-slate-800 font-medium leading-snug">
                      {describeLogEvent({
                        category: log.category,
                        severity: log.severity,
                        message: log.sanitizedMessage,
                      }).title}
                    </div>
                    <div
                      className="text-xs text-slate-500 font-mono truncate mt-1"
                      title={`Mensaje técnico original: ${log.sanitizedMessage}`}
                    >
                      {log.sanitizedMessage}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {/* Única acción por fila: abre el detalle con servidor,
                        servicio, categoría, causas y soluciones (LogDetailModal). */}
                    <button
                      onClick={() => setSelectedLog(log)}
                      title={`Ver detalle del evento (${describeSeverity(log.severity)})`}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition px-2 py-1 bg-indigo-50 hover:bg-indigo-100 rounded"
                    >
                      Ver detalle
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detalle del evento seleccionado */}
      {selectedLog && (
        <LogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}

      <div className="p-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 flex justify-between items-center">
        <span>
          Mostrando {filteredLogs.length} de {logs.length} eventos de log
        </span>
        <span>
          Zona horaria: Local del navegador con referencia UTC
        </span>
      </div>
    </div>
  );
}
