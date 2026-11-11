"use client";

import React, { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bot,
  ChevronsUpDown,
  History,
  KeyRound,
  Loader2,
  LogOut,
  Palette,
  ScrollText,
  Server,
  ShieldAlert,
  Siren,
  Users,
  X,
  AlertCircle,
  CheckCircle2,
  BarChart3,
  Workflow,
  Bell,
} from "lucide-react";

export interface NavUser {
  username: string;
  role: "SUPERADMIN" | "OBSERVADOR";
}

const PRIMARY_LINKS = [
  { href: "/metrics", label: "Resumen", icon: BarChart3 },
  { href: "/servers", label: "Servidores", icon: Server },
  { href: "/logs/alerts", label: "Alertas", icon: ShieldAlert, badge: true },
  { href: "/incidents", label: "Incidentes", icon: Siren },
];

const OPERATIONS_LINKS = [
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/agent", label: "Agente IA", icon: Bot },
  { href: "/channels", label: "Notificaciones", icon: Bell },
  { href: "/automation", label: "Automatización", icon: Workflow },
];

const ADMIN_LINKS = [
  { href: "/users", label: "Usuarios", icon: Users },
  { href: "/audit", label: "Auditoría", icon: History },
  { href: "/settings/appearance", label: "Apariencia", icon: Palette },
];

const ROLE_LABEL: Record<NavUser["role"], string> = {
  SUPERADMIN: "Administrador",
  OBSERVADOR: "Observador",
};

function initialsFor(username: string): string {
  const clean = username.trim();
  if (!clean) return "??";
  const parts = clean.split(/\s+|[._-]+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]?.[0]}${parts[1]?.[0]}`.toUpperCase();
  return clean.slice(0, 2).toUpperCase();
}

/** Contador de alertas activas (badge rojo del menú «Alertas»). */
function useActiveAlertCount(intervalMs = 60_000): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/v1/alerts?status=ACTIVE&limit=1", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { total?: number };
        if (!cancelled && typeof data.total === "number") setCount(data.total);
      } catch {
        // Sin contador no se rompe la navegación.
      }
    };

    void load();
    const timer = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [intervalMs]);

  return count;
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  badge?: number | boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 ${
        active
          ? "text-[var(--sidebar-text-strong)]"
          : "text-[var(--sidebar-text)] hover:bg-white/5 hover:text-[var(--sidebar-text-strong)]"
      }`}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[var(--primary-600)]"
        />
      )}
      <Icon
        className={`h-[18px] w-[18px] shrink-0 transition-colors duration-200 ${
          active ? "text-[var(--primary-400)]" : "text-[var(--sidebar-text)] group-hover:text-[var(--sidebar-text-strong)]"
        }`}
      />
      <span className="truncate">{label}</span>
      {badge && (
        <span className="ml-auto inline-flex min-w-[20px] items-center justify-center rounded-full bg-[#d45b43] px-1.5 py-0.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
    </Link>
  );
}

function SidebarSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1 px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">
      {children}
    </p>
  );
}

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError("La confirmación no coincide con la nueva contraseña.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? "No se pudo cambiar la contraseña.");
        return;
      }
      setDone(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#172033]/55 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <KeyRound className="w-4 h-4 text-indigo-600" /> Mi contraseña
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        {done ? (
          <div className="px-5 py-6 space-y-4">
            <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="w-4 h-4 mt-0.5" /> Contraseña actualizada correctamente.
            </div>
            <button
              onClick={onClose}
              className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="px-5 py-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Contraseña actual</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nueva contraseña</label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Mínimo 10 caracteres, con al menos una letra y un número.
              </p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Confirmar nueva contraseña</label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Guardar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/** Tarjeta de usuario del pie de la barra lateral (avatar, nombre, rol, opciones). */
function SidebarUser({
  user,
  onAfterLogout,
  compact,
}: {
  user: NavUser;
  onAfterLogout?: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const logout = async () => {
    setOpen(false);
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
    onAfterLogout?.();
  };

  return (
    <div ref={ref} className="relative">
      {open && (
        <div
          role="menu"
          className={`absolute bottom-full z-50 mb-2 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg ${
            compact ? "right-0" : "left-0"
          }`}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setPasswordOpen(true);
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <KeyRound className="w-4 h-4" /> Mi contraseña
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void logout()}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-4 h-4" /> Cerrar sesión
          </button>
        </div>
      )}

      <div className="flex items-center gap-2.5 rounded-lg bg-white/5 px-3 py-2.5">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--primary-600)] text-sm font-semibold text-white"
        >
          {initialsFor(user.username)}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-semibold text-[var(--sidebar-text-strong)]">
            {user.username}
          </p>
          <p className="text-[11px] text-[var(--sidebar-text)]">{ROLE_LABEL[user.role]}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-label="Opciones de usuario"
          aria-expanded={open}
          className="rounded-md p-1.5 text-[var(--sidebar-text)] transition-colors hover:bg-white/10 hover:text-white"
        >
          <ChevronsUpDown className="h-4 w-4" />
        </button>
      </div>

      {passwordOpen && <PasswordModal onClose={() => setPasswordOpen(false)} />}
    </div>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-3 px-2 pb-2 pt-1">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-600)] shadow-medium"
      >
        <Activity className="h-5 w-5 text-white" />
      </span>
      <div className="leading-tight">
        <p className="text-[15px] font-bold tracking-tight text-[var(--sidebar-text-strong)]">
          NexoControl
        </p>
        <p className="text-[11px] font-medium text-[var(--sidebar-text)]">Infraestructura TI</p>
      </div>
    </div>
  );
}

function SidebarContent({
  user,
  pathname,
  alertCount,
}: {
  user: NavUser | null;
  pathname: string;
  alertCount: number;
}) {
  const isActive = (href: string) =>
    href === "/logs/alerts" ? pathname === "/logs/alerts" : pathname.startsWith(href);

  return (
    <>
      <div className="px-3 pt-4">
        <Brand />
      </div>

      <nav aria-label="Navegación principal" className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
        {PRIMARY_LINKS.map(({ href, label, icon, badge }) => (
          <NavLink
            key={href}
            href={href}
            label={label}
            icon={icon}
            active={isActive(href)}
            badge={badge && alertCount > 0 ? alertCount : undefined}
          />
        ))}

        <SidebarSectionTitle>Operaciones</SidebarSectionTitle>
        {OPERATIONS_LINKS.map(({ href, label, icon }) => (
          <NavLink key={href} href={href} label={label} icon={icon} active={isActive(href)} />
        ))}

        {user?.role === "SUPERADMIN" && (
          <>
            <SidebarSectionTitle>Administración</SidebarSectionTitle>
            {ADMIN_LINKS.map(({ href, label, icon }) => (
              <NavLink key={href} href={href} label={label} icon={icon} active={isActive(href)} />
            ))}
          </>
        )}
      </nav>

      {user && (
        <div className="border-t border-white/10 p-3">
          <SidebarUser user={user} />
        </div>
      )}
    </>
  );
}

/**
 * Barra lateral institucional. En escritorio permanece fija a la izquierda
 * (248 px); en móvil funciona como drawer con capa oscura que se cierra al
 * hacer clic fuera o con Escape.
 */
export default function Sidebar({
  user,
  open,
  onClose,
}: {
  user: NavUser | null;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const alertCount = useActiveAlertCount();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <>
      {/* Escritorio: fija */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col bg-[var(--sidebar-bg)] lg:flex"
        aria-label="Barra lateral"
      >
        <SidebarContent user={user} pathname={pathname} alertCount={alertCount} />
      </aside>

      {/* Móvil: drawer + capa oscura */}
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-[#172033]/60 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        aria-label="Barra lateral"
        className={`fixed inset-y-0 left-0 z-50 flex w-[272px] max-w-[85vw] flex-col bg-[var(--sidebar-bg)] shadow-2xl transition-transform duration-200 lg:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar menú"
          className="absolute right-3 top-4 rounded-md p-1.5 text-[var(--sidebar-text)] transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
        <SidebarContent user={user} pathname={pathname} alertCount={alertCount} />
      </aside>
    </>
  );
}
