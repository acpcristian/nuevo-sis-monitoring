"use client";

import React from "react";
import { AlertTriangle, CheckCircle, Clock, Server, XCircle } from "lucide-react";

export interface AlertListItem {
  id: string;
  serverId: string | null;
  serverName: string | null;
  category: string | null;
  categoryName: string | null;
  patternType: string;
  eventCount: number;
  windowStart: string;
  windowEnd: string;
  severity: string;
  status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
}

interface AlertTableProps {
  alerts: AlertListItem[];
  onRefresh?: () => void;
  isLoading?: boolean;
  canMutate?: boolean;
  onAcknowledge?: (id: string) => void;
  onResolve?: (id: string) => void;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  ACTIVE: <AlertTriangle className="w-4 h-4 text-rose-600" />,
  ACKNOWLEDGED: <Clock className="w-4 h-4 text-amber-600" />,
  RESOLVED: <CheckCircle className="w-4 h-4 text-emerald-600" />,
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-rose-50 text-rose-700 border-rose-200",
  ACKNOWLEDGED: "bg-amber-50 text-amber-700 border-amber-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const SEVERITY_COLORS: Record<string, string> = {
  INFO: "bg-emerald-50 text-emerald-700 border-emerald-200",
  WARN: "bg-amber-50 text-amber-700 border-amber-200",
  ERROR: "bg-rose-50 text-rose-700 border-rose-200",
  CRITICAL: "bg-rose-100 text-rose-800 border-rose-200",
};

export function AlertTable({
  alerts,
  onRefresh,
  isLoading,
  canMutate = false,
  onAcknowledge,
  onResolve,
}: AlertTableProps) {
  const [selectedStatus, setSelectedStatus] = React.useState<string>("ALL");
  const [searchTerm, setSearchTerm] = React.useState("");

  const filteredAlerts = alerts.filter((alert) => {
    const matchesSearch =
      alert.patternType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (alert.serverName && alert.serverName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (alert.categoryName && alert.categoryName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      alert.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = selectedStatus === "ALL" || alert.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });

  const handleAcknowledge = (id: string) => {
    if (onAcknowledge) onAcknowledge(id);
  };

  const handleResolve = (id: string) => {
    if (onResolve) onResolve(id);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-50/50">
        <div className="relative w-full md:w-96">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por patrón, servidor, categoría..."
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent focus:outline-none text-slate-700 cursor-pointer font-medium"
            >
              <option value="ALL">Todos los estados</option>
              <option value="ACTIVE">Activas</option>
              <option value="ACKNOWLEDGED">Reconocidas</option>
              <option value="RESOLVED">Resueltas</option>
            </select>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Refrescar"
              className="p-1.5 bg-white border border-slate-300 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition disabled:opacity-50"
            >
              <Clock className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-100/70 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Estado</th>
              <th className="py-3 px-4">Severidad</th>
              <th className="py-3 px-4">Patrón</th>
              <th className="py-3 px-4">Categoría</th>
              <th className="py-3 px-4">Servidor</th>
              <th className="py-3 px-4">Eventos / Ventana</th>
              <th className="py-3 px-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredAlerts.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-400">
                  No se encontraron alertas coincidentes con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filteredAlerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border ${STATUS_COLORS[alert.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}
                    >
                      {STATUS_ICONS[alert.status] || <XCircle className="w-3 h-3" />}
                      {alert.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border ${SEVERITY_COLORS[alert.severity] || "bg-slate-100 text-slate-600 border-slate-200"}`}
                    >
                      {alert.severity}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-mono text-xs text-slate-700 max-w-[200px] truncate">{alert.patternType}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs text-slate-600">
                      {alert.categoryName || (alert.category ? `(${alert.category})` : "—")}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-slate-700 font-medium">{alert.serverName || "No asignado"}</div>
                    <div className="text-xs text-slate-500 font-mono">{alert.serverId || "—"}</div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm text-slate-700 font-medium">{alert.eventCount} eventos</div>
                    <div className="text-xs text-slate-500">
                      {new Date(alert.windowStart).toLocaleString("es-ES", { timeZoneName: "short" })} —{" "}
                      {new Date(alert.windowEnd).toLocaleString("es-ES", { timeZoneName: "short" })}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {canMutate && alert.status === "ACTIVE" && (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="text-xs font-medium text-amber-700 hover:text-amber-900 transition px-2 py-1 bg-amber-50 hover:bg-amber-100 rounded mr-1"
                      >
                        Reconocer
                      </button>
                    )}
                    {canMutate && (alert.status === "ACTIVE" || alert.status === "ACKNOWLEDGED") && (
                      <button
                        onClick={() => handleResolve(alert.id)}
                        className="text-xs font-medium text-emerald-700 hover:text-emerald-900 transition px-2 py-1 bg-emerald-50 hover:bg-emerald-100 rounded"
                      >
                        Resolver
                      </button>
                    )}
                    {alert.status === "RESOLVED" && (
                      <span className="text-xs text-slate-400">Resuelta</span>
                    )}
                    {alert.acknowledgedBy && (
                      <div className="text-xs text-slate-500 mt-1 text-right">
                        Por: {alert.acknowledgedBy}
                        {alert.acknowledgedAt && (
                          <>
                            {" | "}
                            {new Date(alert.acknowledgedAt).toLocaleString("es-ES", { timeZoneName: "short" })}
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="p-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 flex justify-between items-center">
        <span>Mostrando {filteredAlerts.length} de {alerts.length} alertas</span>
        <span>Principio VIII: La ausencia de telemetría NUNCA se interpreta como salud satisfactoria</span>
      </div>
    </div>
  );
}