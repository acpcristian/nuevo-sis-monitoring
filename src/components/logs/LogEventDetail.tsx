"use client";

import React from "react";
import { Clock, Key, Shield, AlertCircle, Wrench, HelpCircle, ClipboardList } from "lucide-react";
import {
  describeLogEvent,
  describeSeverity,
  splitKnowledgeText,
  SERVICE_STATUS_LABELS,
} from "@/core/domain/log-knowledge";

interface LogEventDetailProps {
  event: {
    id: string;
    serverId: string | null;
    serverName: string | null;
    serverIp: string | null;
    serverEnvironment?: string | null;
    serverHealth?: string | null;
    serverOs?: string | null;
    serverDescription?: string | null;
    serverOwner?: string | null;
    serverLastSeenAt?: string | null;
    serverTags?: Array<{ key: string; value: string }>;
    serverServices?: Array<{ id: string; name: string; status: string }>;
    serviceId: string | null;
    serviceName: string | null;
    serviceStatus: string | null;
    servicePort: number | null;
    serviceEndpoint: string | null;
    category: string;
    categoryName: string;
    categoryDescription?: string | null;
    categoryCommonCauses?: string | null;
    categorySolutions?: string | null;
    eventTimestamp: string;
    ingestionTimestamp: string;
    processedTimestamp: string | null;
    eventType: string | null;
    severity: string;
    sanitizedMessage: string;
    rawLog: string | null;
    isUntrusted: boolean;
    metadata: Record<string, unknown> | null;
  };
  canViewRaw: boolean;
}

export function LogEventDetail({ event, canViewRaw }: LogEventDetailProps) {
  const severityColor: Record<string, string> = {
    INFO: "bg-emerald-50 text-emerald-700 border-emerald-200",
    WARN: "bg-amber-50 text-amber-700 border-amber-200",
    ERROR: "bg-rose-50 text-rose-700 border-rose-200",
    CRITICAL: "bg-rose-100 text-rose-800 border-rose-200",
  };

  const summary = describeLogEvent({
    category: event.category,
    severity: event.severity,
    eventType: event.eventType,
    message: event.sanitizedMessage,
  });

  const curatedCauses = splitKnowledgeText(event.categoryCommonCauses);
  const curatedSolutions = splitKnowledgeText(event.categorySolutions);
  const causes = curatedCauses.length > 0 ? curatedCauses : summary.causes;
  const solutions = curatedSolutions.length > 0 ? curatedSolutions : summary.solutions;

  const serviceStatus = event.serviceStatus
    ? SERVICE_STATUS_LABELS[event.serviceStatus] ?? { label: event.serviceStatus, badgeClass: "bg-slate-100 text-slate-600 border-slate-200" }
    : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Evento de Log</h2>
          <p className="text-sm text-slate-500">
            ID: <span className="font-mono text-slate-400">{event.id}</span>
          </p>
        </div>
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-medium ${severityColor[event.severity] || "bg-slate-100 text-slate-600 border-slate-200"}`}
        >
          {event.severity}
        </span>
      </div>

      <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
        <h3 className="text-sm font-semibold text-indigo-900 mb-1">¿Qué significa este evento?</h3>
        <p className="text-sm text-indigo-800 leading-relaxed">{summary.meaning}</p>
        <p className="text-xs text-indigo-700 mt-2">
          <span className="font-semibold">Severidad:</span> {describeSeverity(event.severity)}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-800">Categoría</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-slate-700">{event.categoryName}</span>
              <span className="text-xs text-slate-500 font-mono">{event.category}</span>
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-800">Marcas Temporales</h3>
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Evento (origen):</span>
                <span className="font-mono text-slate-700">
                  {new Date(event.eventTimestamp).toLocaleString("es-ES", { timeZoneName: "short" })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Ingestión:</span>
                <span className="font-mono text-slate-700">
                  {new Date(event.ingestionTimestamp).toLocaleString("es-ES", { timeZoneName: "short" })}
                </span>
              </div>
              {event.processedTimestamp && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Procesado:</span>
                  <span className="font-mono text-slate-700">
                    {new Date(event.processedTimestamp).toLocaleString("es-ES", { timeZoneName: "short" })}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-800">Servidor del inventario</h3>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Nombre:</span>
                <span className="font-medium text-slate-700 text-right">{event.serverName || "Sin servidor asociado"}</span>
              </div>
              {event.serverIp && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">IP:</span>
                  <span className="font-mono text-slate-700">{event.serverIp}</span>
                </div>
              )}
              {event.serverEnvironment && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Ambiente:</span>
                  <span className="text-slate-700">{event.serverEnvironment}</span>
                </div>
              )}
              {event.serverHealth && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Salud:</span>
                  <span className="text-slate-700">{event.serverHealth}</span>
                </div>
              )}
              {event.serverOs && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Sistema:</span>
                  <span className="text-slate-700">{event.serverOs}</span>
                </div>
              )}
              {event.serverOwner && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Responsable:</span>
                  <span className="text-slate-700 text-right">{event.serverOwner}</span>
                </div>
              )}
            </div>
            {event.serverDescription && (
              <p className="text-xs text-slate-600 leading-relaxed mt-2">{event.serverDescription}</p>
            )}
            {(event.serverTags?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {event.serverTags!.map((t) => (
                  <span key={`${t.key}=${t.value}`} className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 font-medium">
                    {t.key}: {t.value}
                  </span>
                ))}
              </div>
            )}
            {(event.serverServices?.length ?? 0) > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-100">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Servicios registrados del servidor</p>
                <div className="flex flex-wrap gap-1">
                  {event.serverServices!.map((s) => (
                    <span
                      key={s.id}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-medium ${
                        s.status === "RUNNING" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        s.status === "ERROR" ? "bg-rose-50 text-rose-700 border-rose-200" :
                        s.status === "STOPPED" ? "bg-amber-50 text-amber-700 border-amber-200" :
                        "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <Wrench className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-800">Servicio</h3>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Nombre:</span>
                <span className="font-medium text-slate-700 text-right">
                  {event.serviceName || "Sin servicio identificado"}
                </span>
              </div>
              {serviceStatus && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Estado:</span>
                  <span className={`px-2 py-0.5 rounded border text-[10px] font-medium ${serviceStatus.badgeClass}`}>
                    {serviceStatus.label}
                  </span>
                </div>
              )}
              {event.servicePort && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Puerto:</span>
                  <span className="font-mono text-slate-700">{event.servicePort}</span>
                </div>
              )}
              {event.serviceEndpoint && (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Endpoint:</span>
                  <span className="font-mono text-slate-700 break-all text-right">{event.serviceEndpoint}</span>
                </div>
              )}
              {!event.serviceName && (
                <p className="text-xs text-slate-500">
                  El agente no reportó el servicio (metadata.serviceName) para este evento.
                </p>
              )}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-800">Tipo de Evento</h3>
            </div>
            <span className="font-mono text-slate-700 text-sm">{event.eventType || "—"}</span>
          </div>
        </div>
      </div>

      <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
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
      </div>

      <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-2">
          <ClipboardList className="w-4 h-4 text-indigo-600" />
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
      </div>

      <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800 mb-3">Mensaje del Evento</h3>
        <div className="font-mono text-xs text-slate-700 whitespace-pre-wrap break-all">
          {event.sanitizedMessage}
        </div>
        {!canViewRaw && event.rawLog !== null && (
          <p className="mt-2 text-xs text-slate-500">
            El registro original (raw log) no está disponible para su rol.
          </p>
        )}
      </div>

      {canViewRaw && event.rawLog && (
        <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">Registro Original (Raw Log)</h3>
          </div>
          <div className="font-mono text-xs text-amber-700 whitespace-pre-wrap break-all">
            {event.rawLog}
          </div>
          <p className="mt-2 text-xs text-amber-600">
            El registro original se muestra solo a SUPERADMIN (Principio III).
          </p>
        </div>
      )}

      {event.metadata && (
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Metadatos</h3>
          <pre className="font-mono text-xs text-slate-600 whitespace-pre-wrap break-all">
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        </div>
      )}

      <div className="p-3 bg-slate-100 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Shield className="w-3 h-3" />
          <span>
            Datos no confiables (untrusted):{" "}
            {event.isUntrusted ? "Sí - requiere sanitización" : "No"}
          </span>
        </div>
      </div>
    </div>
  );
}
