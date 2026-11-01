"use client";

import React from "react";
import { Clock, FileText, Key, Shield, AlertCircle } from "lucide-react";

interface LogEventDetailProps {
  event: {
    id: string;
    serverId: string | null;
    serverName: string | null;
    serverIp: string | null;
    category: string;
    categoryName: string;
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
              <FileText className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-800">Servidor</h3>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Nombre:</span>
                <span className="font-medium text-slate-700">{event.serverName || "No asignado"}</span>
              </div>
              {event.serverIp && (
                <div className="flex justify-between">
                  <span className="text-slate-500">IP:</span>
                  <span className="font-mono text-slate-700">{event.serverIp}</span>
                </div>
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
