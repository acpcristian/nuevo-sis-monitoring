import React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Key,
  Clock,
  Wrench,
  PauseCircle,
  Archive,
} from "lucide-react";

interface ServerStatusBadgeProps {
  healthStatus?: string;
  lifecycleState?: string;
  size?: "sm" | "md";
}

export function ServerStatusBadge({
  healthStatus,
  lifecycleState,
  size = "md",
}: ServerStatusBadgeProps) {
  const isSm = size === "sm";

  // 1. Si está en un estado especial de ciclo de vida, este prevalece
  if (lifecycleState === "MAINTENANCE") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200 ${
          isSm ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
        }`}
        title="Ventana de mantenimiento activa. Sondeos de alerta silenciados."
      >
        <Wrench className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} aria-hidden="true" />
        <span>Mantenimiento</span>
      </span>
    );
  }

  if (lifecycleState === "DISABLED") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-slate-100 text-slate-700 border border-slate-300 ${
          isSm ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
        }`}
        title="Servidor deshabilitado administrativamente."
      >
        <PauseCircle className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} aria-hidden="true" />
        <span>Deshabilitado</span>
      </span>
    );
  }

  if (lifecycleState === "RETIRED") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-zinc-100 text-zinc-600 border border-zinc-300 ${
          isSm ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
        }`}
        title="Servidor desincorporado permanentemente."
      >
        <Archive className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} aria-hidden="true" />
        <span>Retirado</span>
      </span>
    );
  }

  // 2. Estados de Salud Operativa
  switch (healthStatus) {
    case "ONLINE":
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 ${
            isSm ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
          }`}
          title="Conectividad y servicios operativos"
        >
          <CheckCircle2 className={isSm ? "w-3 h-3 text-emerald-600" : "w-3.5 h-3.5 text-emerald-600"} />
          <span>En Línea</span>
        </span>
      );

    case "DEGRADED":
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-amber-50 text-amber-700 border border-amber-200 ${
            isSm ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
          }`}
          title="Alta latencia o pérdida parcial de paquetes detectada"
        >
          <AlertTriangle className={isSm ? "w-3 h-3 text-amber-600" : "w-3.5 h-3.5 text-amber-600"} />
          <span>Degradado</span>
        </span>
      );

    case "UNREACHABLE":
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-rose-50 text-rose-700 border border-rose-200 ${
            isSm ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
          }`}
          title="Inaccesible por red o puerto cerrado"
        >
          <XCircle className={isSm ? "w-3 h-3 text-rose-600" : "w-3.5 h-3.5 text-rose-600"} />
          <span>Inalcanzable</span>
        </span>
      );

    case "AUTH_FAILED":
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-purple-50 text-purple-700 border border-purple-200 ${
            isSm ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
          }`}
          title="Fallo de autenticación: clave SSH o contraseña rechazada por el servidor"
        >
          <Key className={isSm ? "w-3 h-3 text-purple-600" : "w-3.5 h-3.5 text-purple-600"} />
          <span>Error de Auth</span>
        </span>
      );

    case "PENDING":
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200 ${
            isSm ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
          }`}
          title="Sondeo pendiente"
        >
          <Clock className={isSm ? "w-3 h-3 text-slate-500" : "w-3.5 h-3.5 text-slate-500"} />
          <span>Pendiente</span>
        </span>
      );
  }
}

