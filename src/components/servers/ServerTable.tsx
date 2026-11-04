"use client";

import React from "react";
import Link from "next/link";
import { ExternalLink, Shield } from "lucide-react";
import { ServerStatusBadge } from "./ServerStatusBadge";
import type { ServerListItem } from "./server-list-item";

interface ServerTableProps {
  servers: ServerListItem[];
}

/**
 * Vista de tabla del catálogo. Recibe la lista ya filtrada desde la página para
 * compartir el mismo estado de filtros con la grilla de tarjetas.
 */
export function ServerTable({ servers }: ServerTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
          <tr>
            <th className="px-6 py-4 font-semibold">Servidor / Host</th>
            <th className="px-6 py-4 font-semibold">Dirección IP</th>
            <th className="px-6 py-4 font-semibold">Sistema Operativo</th>
            <th className="px-6 py-4 font-semibold">Entorno</th>
            <th className="px-6 py-4 font-semibold">Servicios</th>
            <th className="px-6 py-4 font-semibold">Salud Operativa</th>
            <th className="px-6 py-4 font-semibold">Última Comprobación</th>
            <th className="px-6 py-4 text-right font-semibold">Acción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {servers.length === 0 ? (
            <tr>
              <td colSpan={8} className="py-12 text-center text-slate-400">
                No se encontraron servidores coincidentes con los filtros seleccionados.
              </td>
            </tr>
          ) : (
            servers.map((server) => (
              <tr key={server.id} className="transition-colors hover:bg-slate-50/80">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 font-medium text-slate-900">
                    <Link href={`/servers/${server.id}`} className="transition hover:text-indigo-600">
                      {server.name}
                    </Link>
                    {server.hasCredential && (
                      <span title="Credencial segura configurada">
                        <Shield className="h-3.5 w-3.5 text-indigo-500" />
                      </span>
                    )}
                  </div>
                  {server.hostname && (
                    <div className="font-mono text-xs text-slate-400">{server.hostname}</div>
                  )}
                </td>

                <td className="px-4 py-3 font-mono text-xs text-slate-700">
                  {server.ipAddress}:{server.connectionPort}
                </td>

                <td className="px-4 py-3">
                  <span className="font-medium text-slate-700">{server.osType}</span>
                  {server.osVersion && <div className="text-xs text-slate-400">{server.osVersion}</div>}
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`rounded border px-2 py-0.5 text-xs font-medium ${
                      server.environment === "PROD"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : server.environment === "STAGING"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-slate-200 bg-slate-100 text-slate-700"
                    }`}
                  >
                    {server.environment}
                  </span>
                </td>

                <td className="px-4 py-3">
                  <span className="font-semibold text-slate-900">
                    {server.servicesRunning ?? 0}
                    <span className="font-normal text-slate-400"> / {server.serviceCount ?? 0}</span>
                  </span>
                  {(server.servicesDown ?? 0) > 0 && (
                    <div className="text-xs font-medium text-rose-600">
                      {server.servicesDown} con fallo
                    </div>
                  )}
                </td>

                <td className="px-4 py-3">
                  <ServerStatusBadge
                    healthStatus={server.healthStatus}
                    lifecycleState={server.lifecycleState}
                    size="sm"
                  />
                </td>

                <td className="px-4 py-3 text-xs text-slate-500">
                  {server.lastCheckedAt
                    ? new Date(server.lastCheckedAt).toLocaleString("es-ES", {
                        timeZoneName: "short",
                      })
                    : "Nunca comprobado"}
                </td>

                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/servers/${server.id}`}
                    className="inline-flex items-center gap-1 rounded bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-600 transition hover:bg-indigo-100 hover:text-indigo-800"
                  >
                    Ficha <ExternalLink className="h-3 w-3" />
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
