"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Shield,
  Activity,
  Layers,
} from "lucide-react";
import { ServerStatusBadge } from "./ServerStatusBadge";

export interface ServerListItem {
  id: string;
  name: string;
  ipAddress: string;
  hostname?: string | null;
  osType: "LINUX" | "WINDOWS" | "OTHER";
  osVersion?: string | null;
  environment: "PROD" | "STAGING" | "DEV" | "QA";
  connectionPort: number;
  lifecycleState: "ACTIVE" | "MAINTENANCE" | "DISABLED" | "RETIRED";
  healthStatus: "ONLINE" | "DEGRADED" | "UNREACHABLE" | "AUTH_FAILED" | "PENDING";
  hasCredential: boolean;
  lastCheckedAt?: string | null;
  tags?: Array<{ key: string; value: string }>;
}

interface ServerTableProps {
  servers: ServerListItem[];
  onRefresh?: () => void;
  isLoading?: boolean;
}

export function ServerTable({ servers, onRefresh, isLoading }: ServerTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEnv, setSelectedEnv] = useState<string>("ALL");
  const [selectedOs, setSelectedOs] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // Filtrado reactivo en memoria (< 1s para 1000 items - SC-002)
  const filteredServers = servers.filter((server) => {
    const matchesSearch =
      server.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      server.ipAddress.includes(searchTerm) ||
      (server.hostname && server.hostname.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesEnv = selectedEnv === "ALL" || server.environment === selectedEnv;
    const matchesOs = selectedOs === "ALL" || server.osType === selectedOs;
    const matchesStatus =
      selectedStatus === "ALL" ||
      server.healthStatus === selectedStatus ||
      server.lifecycleState === selectedStatus;

    return matchesSearch && matchesEnv && matchesOs && matchesStatus;
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Barra de Filtros y Búsqueda */}
      <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-center justify-between bg-slate-50/50">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre, IP o host..."
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedEnv}
              onChange={(e) => setSelectedEnv(e.target.value)}
              className="bg-transparent focus:outline-none text-slate-700 cursor-pointer font-medium"
            >
              <option value="ALL">Todos los entornos</option>
              <option value="PROD">Producción</option>
              <option value="STAGING">Staging</option>
              <option value="DEV">Desarrollo</option>
              <option value="QA">QA</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedOs}
              onChange={(e) => setSelectedOs(e.target.value)}
              className="bg-transparent focus:outline-none text-slate-700 cursor-pointer font-medium"
            >
              <option value="ALL">Todos los SO</option>
              <option value="LINUX">Linux</option>
              <option value="WINDOWS">Windows Server</option>
              <option value="OTHER">Otros</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs">
            <Activity className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-transparent focus:outline-none text-slate-700 cursor-pointer font-medium"
            >
              <option value="ALL">Cualquier Estado</option>
              <option value="ONLINE">En Línea</option>
              <option value="DEGRADED">Degradado</option>
              <option value="UNREACHABLE">Inalcanzable</option>
              <option value="AUTH_FAILED">Error de Auth</option>
              <option value="MAINTENANCE">Mantenimiento</option>
              <option value="DISABLED">Deshabilitado</option>
              <option value="RETIRED">Retirado</option>
            </select>
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              title="Refrescar catálogo"
              className="p-1.5 bg-white border border-slate-300 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {/* Tabla de Servidores */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-100/70 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">Servidor / Host</th>
              <th className="py-3 px-4">Dirección IP</th>
              <th className="py-3 px-4">Sistema Operativo</th>
              <th className="py-3 px-4">Entorno</th>
              <th className="py-3 px-4">Salud Operativa</th>
              <th className="py-3 px-4">Última Comprobación</th>
              <th className="py-3 px-4 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredServers.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-slate-400">
                  No se encontraron servidores coincidentes con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filteredServers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900 flex items-center gap-1.5">
                      <Link href={`/servers/${s.id}`} className="hover:text-indigo-600 transition">
                        {s.name}
                      </Link>
                      {s.hasCredential && (
                        <span title="Credencial segura configurada">
                          <Shield className="w-3.5 h-3.5 text-indigo-500" />
                        </span>
                      )}
                    </div>
                    {s.hostname && <div className="text-xs text-slate-400 font-mono">{s.hostname}</div>}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-slate-700">{s.ipAddress}:{s.connectionPort}</td>
                  <td className="py-3 px-4">
                    <span className="text-slate-700 font-medium">{s.osType}</span>
                    {s.osVersion && <div className="text-xs text-slate-400">{s.osVersion}</div>}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-medium ${
                        s.environment === "PROD"
                          ? "bg-rose-50 text-rose-700 border border-rose-200"
                          : s.environment === "STAGING"
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-slate-100 text-slate-700 border border-slate-200"
                      }`}
                    >
                      {s.environment}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <ServerStatusBadge
                      healthStatus={s.healthStatus}
                      lifecycleState={s.lifecycleState}
                      size="sm"
                    />
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-500">
                    {s.lastCheckedAt
                      ? new Date(s.lastCheckedAt).toLocaleString("es-ES", {
                          timeZoneName: "short",
                        })
                      : "Nunca comprobado"}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <Link
                      href={`/servers/${s.id}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition px-2 py-1 bg-indigo-50 hover:bg-indigo-100 rounded"
                    >
                      Ficha <ExternalLink className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pie de tabla con conteo */}
      <div className="p-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 flex justify-between items-center">
        <span>Mostrando {filteredServers.length} de {servers.length} servidores registrados</span>
        <span>Zona horaria: Local del navegador con referencia UTC</span>
      </div>
    </div>
  );
}
