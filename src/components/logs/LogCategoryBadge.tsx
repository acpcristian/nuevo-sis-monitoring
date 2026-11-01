"use client";

import React from "react";
import { Shield, Activity, Database, Wrench, Globe, Layers, Save, AlertTriangle, Circle, HardHat } from "lucide-react";

interface LogCategoryBadgeProps {
  category: string;
  size?: "sm" | "md";
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  SYS_KERNEL: <Activity className="w-3 h-3" />,
  AUTH_ACCESS: <Shield className="w-3 h-3" />,
  SSH_NETWORK: <Globe className="w-3 h-3" />,
  SYSTEM_SERVICE: <Wrench className="w-3 h-3" />,
  WEB_APP: <Globe className="w-3 h-3" />,
  DATABASE: <Database className="w-3 h-3" />,
  STORAGE_HW: <Save className="w-3 h-3" />,
  BACKUP_TASK: <Save className="w-3 h-3" />,
  SECURITY_AUDIT: <AlertTriangle className="w-3 h-3" />,
  AGENT_ERROR: <Circle className="w-3 h-3" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  SYS_KERNEL: "bg-blue-50 text-blue-700 border-blue-200",
  AUTH_ACCESS: "bg-indigo-50 text-indigo-700 border-indigo-200",
  SSH_NETWORK: "bg-cyan-50 text-cyan-700 border-cyan-200",
  SYSTEM_SERVICE: "bg-purple-50 text-purple-700 border-purple-200",
  WEB_APP: "bg-orange-50 text-orange-700 border-orange-200",
  DATABASE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  STORAGE_HW: "bg-amber-50 text-amber-700 border-amber-200",
  BACKUP_TASK: "bg-rose-50 text-rose-700 border-rose-200",
  SECURITY_AUDIT: "bg-rose-100 text-rose-800 border-rose-200",
  AGENT_ERROR: "bg-zinc-50 text-zinc-700 border-zinc-200",
};

const CATEGORY_NAMES: Record<string, string> = {
  SYS_KERNEL: "Sistema/Kernel",
  AUTH_ACCESS: "Autenticación",
  SSH_NETWORK: "Red/SSH",
  SYSTEM_SERVICE: "Servicios",
  WEB_APP: "Web",
  DATABASE: "Base de Datos",
  STORAGE_HW: "Almacenamiento",
  BACKUP_TASK: "Backups",
  SECURITY_AUDIT: "Seguridad",
  AGENT_ERROR: "Agente",
};

export function LogCategoryBadge({
  category,
  size = "md",
}: LogCategoryBadgeProps) {
  const isSm = size === "sm";
  const icon = CATEGORY_ICONS[category] || <HardHat className="w-3 h-3" />;
  const colorClass = CATEGORY_COLORS[category] || "bg-slate-100 text-slate-700 border-slate-200";
  const name = CATEGORY_NAMES[category] || category;

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-medium rounded-full border ${colorClass} ${
        isSm ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs"
      }`}
      title={name}
    >
      {icon}
      <span>{name}</span>
    </span>
  );
}
