"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Loader2 } from "lucide-react";
import Sidebar, { type NavUser } from "./Sidebar";

export type { NavUser } from "./Sidebar";

const BREADCRUMB: Array<[prefix: string, label: string]> = [
  ["/metrics", "Resumen"],
  ["/servers/new", "Registrar servidor"],
  ["/servers", "Servidores"],
  ["/logs/alerts", "Alertas"],
  ["/logs/diagnosis", "Diagnósticos"],
  ["/logs", "Logs"],
  ["/incidents", "Incidentes"],
  ["/channels", "Notificaciones"],
  ["/automation", "Automatización"],
  ["/users", "Usuarios"],
  ["/audit", "Auditoría"],
  ["/settings/appearance", "Configuración"],
  ["/settings", "Configuración"],
];

function breadcrumbFor(pathname: string): { href: string; label: string } {
  const match = BREADCRUMB.find(([prefix]) =>
    prefix === "/servers" || prefix === "/logs" ? pathname === prefix : pathname.startsWith(prefix)
  );
  if (match) return { href: match[0], label: match[1] };
  if (pathname.startsWith("/servers/")) return { href: "/servers", label: "Servidores" };
  if (pathname.startsWith("/logs/")) return { href: "/logs", label: "Logs" };
  if (pathname.startsWith("/incidents/")) return { href: "/incidents", label: "Incidentes" };
  return { href: "/servers", label: "Servidores" };
}

/**
 * Envolvente del dashboard: barra lateral institucional + barra superior
 * sticky con breadcrumb e indicador "EN LÍNEA". El contenido se desplaza a
 * la derecha del sidebar en escritorio (lg:pl) y a ancho completo en móvil.
 */
export default function DashboardShell({
  user,
  children,
}: {
  user: NavUser | null;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const crumb = breadcrumbFor(pathname);

  return (
    <div className="min-h-screen bg-[var(--surface-0)]">
      <Sidebar user={user} open={drawerOpen} onClose={() => setDrawerOpen(false)} />

      {/* Barra superior (contrastada: fondo institucional oscuro del sidebar) */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[var(--sidebar-bg)] backdrop-blur-md lg:pl-[248px]">
        <div className="flex h-[64px] items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Abrir menú"
            className="rounded-lg border border-white/15 bg-white/5 p-2 text-[var(--sidebar-text)] transition-colors hover:bg-white/10 hover:text-[var(--sidebar-text-strong)] lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <nav aria-label="Ruta actual" className="hidden min-w-0 items-center gap-1.5 text-sm sm:flex">
            <span className="text-[var(--sidebar-text)]">Administración</span>
            <span aria-hidden="true" className="text-white/30">/</span>
            <Link
              href={crumb.href}
              className="truncate font-medium text-[var(--sidebar-text-strong)] transition-colors hover:text-[var(--primary-400)]"
            >
              {crumb.label}
            </Link>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden items-center gap-2 text-xs font-medium text-[var(--sidebar-text)] md:inline-flex">
              <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin text-[var(--primary-400)]" />
              Monitoreo en tiempo real
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,#2d9b68_45%,transparent)] bg-[color-mix(in_srgb,#2d9b68_18%,transparent)] px-2.5 py-1 text-[11px] font-semibold text-[#7ee2b0]">
              <span aria-hidden="true" className="nexo-live-dot h-2 w-2 rounded-full bg-[#2d9b68]" />
              EN LÍNEA
            </span>
          </div>
        </div>
      </header>

      <main className="lg:pl-[248px]">{children}</main>
    </div>
  );
}
