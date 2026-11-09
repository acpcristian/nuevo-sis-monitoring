"use client";

import React from "react";
import {
  X,
  Server,
  Wrench,
  Layers,
  HelpCircle,
  ClipboardList,
  ExternalLink,
  Clock,
  FileText,
} from "lucide-react";
import { LogCategoryBadge } from "./LogCategoryBadge";
import {
  describeLogEvent,
  describeSeverity,
  splitKnowledgeText,
  SERVICE_STATUS_LABELS,
} from "@/core/domain/log-knowledge";

/**
 * Panel de detalle de un evento de log.
 *
 * Un único punto de acción por fila: responde qué pasó, dónde (servidor y
 * servicio), por qué puede ocurrir y qué hacer, apoyándose en el catálogo
 * de categorías (CRUD en /api/v1/log-categories).
 */
interface LogDetailData {
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

interface LogDetailModalProps {
  log: LogDetailData;
  onClose: () => void;
}

const SEVERITY_CLASSES: Record<string, string> = {
  INFO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  WARN: "bg-amber-50 text-amber-700 border-amber-200",
  ERROR: "bg-rose-50 text-rose-700 border-rose-200",
  CRITICAL: "bg-rose-100 text-rose-800 border-rose-200",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("es-ES", { timeZoneName: "short" });
}

export function LogDetailModal({ log, onClose }: LogDetailModalProps) {
  const summary = describeLogEvent({
    category: log.category,
    severity: log.severity,
    eventType: log.eventType,
    message: log.sanitizedMessage,
  });

  // Contenido curado por el administrador (CRUD del catálogo) tiene prioridad;
  // si no existe, se usa el análisis automático (patrones + catálogo default).
  const curatedCauses = splitKnowledgeText(log.categoryCommonCauses);
  const curatedSolutions = splitKnowledgeText(log.categorySolutions);
  const causes = curatedCauses.length > 0 ? curatedCauses : summary.causes;
  const solutions = curatedSolutions.length > 0 ? curatedSolutions : summary.solutions;

  const serviceStatus = log.serviceStatus
    ? SERVICE_STATUS_LABELS[log.serviceStatus] ?? { label: log.serviceStatus, badgeClass: "bg-slate-100 text-slate-600 border-slate-200" }
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-large border border-slate-200 w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Encabezado */}
        <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4 bg-gradient-to-r from-slate-50 to-white rounded-t-2xl">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <LogCategoryBadge category={log.category} size="md" />
              <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${SEVERITY_CLASSES[log.severity] ?? ""}`}>
                {log.severity}
              </span>
            </div>
            <p className="text-sm text-slate-600 leading-snug">
              {summary.title}
            </p>
            <p className="text-xs font-mono text-slate-400">Evento {log.id}</p>
          </div>
          <button
            onClick={onClose}
            title="Cerrar detalle"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="overflow-y-auto p-5 space-y-4">
          {/* Qué significa */}
          <section className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
            <h3 className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              ¿Qué significa este evento?
            </h3>
            <p className="text-sm text-indigo-800 mt-1.5 leading-relaxed">
              {summary.meaning}
            </p>
            <p className="text-xs text-indigo-700 mt-1.5 flex items-center gap-1.5">
              <span className="font-semibold">Severidad:</span> {describeSeverity(log.severity)}
            </p>
          </section>

          {/* Origen: servidor, servicio y categoría */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Server className="w-4 h-4 text-indigo-600" />
                Servidor
              </h3>
              <div className="text-sm font-medium text-slate-700">
                {log.serverName || "Sin servidor asignado"}
              </div>
              {log.serverId ? (
                <div className="space-y-1">
                  <p className="text-xs font-mono text-slate-400 break-all">{log.serverId}</p>
                  <a
                    href={`/servers/${log.serverId}`}
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    Ver servidor <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  El evento llegó sin servidor asociado: verifica la configuración del agente de recolección.
                </p>
              )}
            </div>

            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Wrench className="w-4 h-4 text-indigo-600" />
                Servicio
              </h3>
              <div className="text-sm font-medium text-slate-700">
                {log.serviceName || "Sin servicio identificado"}
              </div>
              {log.serviceStatus && (
                <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-medium ${serviceStatus?.badgeClass}`}>
                  {serviceStatus?.label}
                </span>
              )}
              {!log.serviceName && (
                <p className="text-xs text-slate-500">
                  El agente no reportó el servicio (metadata.serviceName) para este evento.
                </p>
              )}
            </div>

            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                Categoría
              </h3>
              <div className="text-sm font-medium text-slate-700">{log.categoryName}</div>
              <p className="text-xs font-mono text-slate-400">{log.category}</p>
              {(log.categoryDescription ?? null) && (
                <p className="text-xs text-slate-600 leading-relaxed">{log.categoryDescription}</p>
              )}
            </div>
          </section>

          {/* ¿Por qué ocurre? */}
          <section className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-2">
              <HelpCircle className="w-4 h-4 text-amber-600" />
              ¿Por qué puede ocurrir?
            </h3>
            <ol className="space-y-1.5 list-decimal list-inside text-sm text-slate-700 leading-relaxed">
              {causes.length > 0 ? (
                causes.map((cause, i) => <li key={i}>{cause}</li>)
              ) : (
                <li className="list-none text-slate-500">
                  Sin causas registradas para esta categoría. Documenta las causas habituales en el
                  catálogo de categorías (CRUD).
                </li>
              )}
            </ol>
          </section>

          {/* Soluciones */}
          <section className={`p-4 rounded-xl border ${log.severity === "INFO" || log.severity === "WARN" ? "bg-slate-50 border-slate-100" : "bg-rose-50 border-rose-100"}`}>
            <h3 className={`text-sm font-semibold flex items-center gap-2 mb-2 ${log.severity === "INFO" || log.severity === "WARN" ? "text-slate-800" : "text-rose-800"}`}>
              <ClipboardList className={`w-4 h-4 ${log.severity === "INFO" || log.severity === "WARN" ? "text-indigo-600" : "text-rose-600"}`} />
              Soluciones sugeridas
            </h3>
            <ol className="space-y-1.5 list-decimal list-inside text-sm text-slate-700 leading-relaxed">
              {solutions.length > 0 ? (
                solutions.map((solution, i) => <li key={i}>{solution}</li>)
              ) : (
                <li className="list-none text-slate-500">
                  Sin soluciones documentadas todavía. Agrega el runbook en el catálogo de categorías.
                </li>
              )}
            </ol>
          </section>

          {/* Mensaje original + contexto técnico (colapsable para no saturar) */}
          <section className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Mensaje registrado</h3>
            <div className="font-mono text-xs text-slate-700 whitespace-pre-wrap break-all bg-white border border-slate-100 rounded-lg p-3">
              {log.sanitizedMessage}
            </div>
            <details className="mt-3 group">
              <summary className="text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-700 select-none">
                Contexto técnico del evento
              </summary>
              <div className="mt-2 space-y-1.5 text-xs">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Evento (origen):</span>
                  <span className="font-mono text-slate-700">{formatDate(log.eventTimestamp)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Ingesta en plataforma:</span>
                  <span className="font-mono text-slate-700">{formatDate(log.ingestionTimestamp)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Tipo de evento:</span>
                  <span className="font-mono text-slate-700">{log.eventType || "—"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Datos no confiables:</span>
                  <span className="text-slate-700">{log.isUntrusted ? "Sí (se aplicó sanitización)" : "No"}</span>
                </div>
              </div>
            </details>
          </section>
        </div>

        {/* Pie: única acción adicional (diagnóstico completo) + cerrar */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50 rounded-b-2xl">
          <span className={`text-xs ${curatedCauses.length > 0 || curatedSolutions.length > 0 ? "text-emerald-700" : "text-slate-500"}`}>
            {curatedCauses.length > 0 || curatedSolutions.length > 0
              ? "Análisis curado por el administrador (catálogo de categorías)."
              : "Análisis automático según el catálogo por defecto; puede personalizarse en el catálogo de categorías."}
          </span>
          <div className="flex items-center gap-2">
            <a
              href={`/logs/${log.id}`}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition"
            >
              Diagnóstico completo <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
