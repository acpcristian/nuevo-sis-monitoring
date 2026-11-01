"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Server, AlertTriangle } from "lucide-react";
import { ServerTable, ServerListItem } from "@/components/servers/ServerTable";

export default function ServersPage() {
  const [servers, setServers] = useState<ServerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchServers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/servers?limit=100", {
        headers: {
          Authorization: "Bearer TOKEN_SUPERADMIN",
        },
      });
      if (!res.ok) {
        throw new Error("No se pudo cargar el catálogo de servidores");
      }
      const data = await res.json();
      setServers(data.items || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServers();
  }, []);

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Server className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Inventario de Servidores</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Supervisión centralizada de infraestructura, conectividad y estado operativo de nodos.
          </p>
        </div>

        <Link
          href="/servers/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition shadow-sm w-fit"
        >
          <Plus className="w-4 h-4" />
          Registrar Servidor
        </Link>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-3 text-rose-700 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabla interactiva */}
      <ServerTable servers={servers} onRefresh={fetchServers} isLoading={loading} />
    </div>
  );
}

