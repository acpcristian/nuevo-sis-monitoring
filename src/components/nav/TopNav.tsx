"use client";

import React, { useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Server, ScrollText, ShieldAlert, Siren, Bell, BarChart3, Workflow, LogOut, Activity,
  Users, KeyRound, X, Loader2, CheckCircle2, AlertCircle,
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

const ADMIN_LINKS = [{ href: "/users", label: "Usuarios", icon: Users }];

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
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

export default function TopNav({ user }: { user: NavUser | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [passwordOpen, setPasswordOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/logs/alerts" ? pathname === "/logs/alerts" : pathname.startsWith(href);

  const logout = async () => {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const links = user?.role === "SUPERADMIN" ? [...LINKS, ...ADMIN_LINKS] : LINKS;

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
          {links.map(({ href, label, icon: Icon }) => (
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
                onClick={() => setPasswordOpen(true)}
                title="Cambiar mi contraseña"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 transition"
              >
                <KeyRound className="w-4 h-4" />
                <span className="hidden lg:block">Mi contraseña</span>
              </button>
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

      {passwordOpen && user && <PasswordModal onClose={() => setPasswordOpen(false)} />}
    </header>
  );
}
