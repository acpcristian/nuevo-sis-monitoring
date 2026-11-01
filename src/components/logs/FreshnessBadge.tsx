"use client";

import React from "react";
import { Wifi, WifiOff, AlertCircle, CheckCircle } from "lucide-react";

export type FreshnessState = "FRESH" | "STALE" | "AGENT_DISCONNECTED" | "UNREACHABLE";

interface FreshnessBadgeProps {
  state: FreshnessState;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const FRESHNESS_CONFIG: Record<FreshnessState, { icon: React.ReactNode; color: string; label: string }> = {
  FRESH: {
    icon: <CheckCircle className="w-3 h-3" />,
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    label: "Actualizado",
  },
  STALE: {
    icon: <AlertCircle className="w-3 h-3" />,
    color: "bg-amber-50 text-amber-700 border-amber-200",
    label: "Datos obsoletos",
  },
  AGENT_DISCONNECTED: {
    icon: <WifiOff className="w-3 h-3" />,
    color: "bg-rose-50 text-rose-700 border-rose-200",
    label: "Agente desconectado",
  },
  UNREACHABLE: {
    icon: <Wifi className="w-3 h-3" />,
    color: "bg-rose-100 text-rose-800 border-rose-200",
    label: "Inalcanzable",
  },
};

const SIZE_CLASSES: Record<string, string> = {
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
  lg: "px-3 py-1.5 text-sm",
};

export function FreshnessBadge({
  state,
  size = "md",
  showLabel = true,
}: FreshnessBadgeProps) {
  const config = FRESHNESS_CONFIG[state] || FRESHNESS_STATUS["STALE"];
  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES["md"];

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${config.color} ${sizeClass}`}
      title={config.label}
    >
      {config.icon}
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}

// Export config for reference
export const FRESHNESS_STATUS = FRESHNESS_CONFIG;