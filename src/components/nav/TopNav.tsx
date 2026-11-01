"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Server, ScrollText, ShieldAlert, Siren, Bell, BarChart3, Workflow, LogOut, Activity,
} from "lucide-react";

export interface NavUser {
  username: string;
  role: "SUPERADMIN" | "OBSERVADOR";
}

const LINKS = [
  { href: "/servers", label: "Servidores", icon: Server },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/logs/alerts", label: "Alertas", icon: ShieldAlert },
  { href: "/incidents", label: "Incidentes", icon: Siren },
  { href: "/channels", label: "Notificaciones", icon: Bell },
  { href: "/metrics", label: "Métricas", icon: BarChart3 },
  { href: "/automation", label: "Automatización", icon: Workflow },
];

export default function TopNav({ user }: { user: NavUser | null }) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) =>
    href === "/logs/alerts" ? pathname === "/logs/alerts" : pathname.startsWith(href);

  const logout = async () => {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-4">
        <Link href="/servers" className="flex items-center gap-2 shrink-0">
          <Activity className="w-6 h-6 text-indigo-600" />
          <span className="font-bold text-slate-900 tracking-tight hidden sm:block">
            Nuevo SIS · Monitoreo
          </span>
        </Link>

        <nav className="flex items-center gap-1 overflow-x-auto">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition ${
                isActive(href)
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden md:block">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3 shrink-0">
          {user ? (
            <>
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium text-slate-900 leading-tight">{user.username}</div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500 leading-tight">
                  {user.role}
                </div>
              </div>
              <button
                onClick={logout}
                title="Cerrar sesión"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 transition"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:block">Salir</span>
              </button>
            </>
          ) : (
            <Link href="/login" className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              Iniciar sesión
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
