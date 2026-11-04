"use client";

import React from "react";
import { Server as ServerIcon } from "lucide-react";
import { ServerCard } from "./ServerCard";
import type { ServerListItem } from "./server-list-item";

interface ServerGridProps {
  servers: ServerListItem[];
}

export function ServerGrid({ servers }: ServerGridProps) {
  if (servers.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-soft">
        <ServerIcon className="mx-auto mb-3 h-12 w-12 text-slate-300" />
        <h3 className="text-lg font-semibold text-slate-800">No hay servidores coincidentes</h3>
        <p className="mt-1 text-sm text-slate-500">
          Ajusta los filtros o registra un nuevo servidor para comenzar a monitorear.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {servers.map((server) => (
        <ServerCard key={server.id} server={server} />
      ))}
    </div>
  );
}
