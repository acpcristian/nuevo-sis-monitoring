"use client";

import React, { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  Users, UserPlus, ShieldCheck, Shield, Loader2, AlertCircle, CheckCircle2, RefreshCw,
  KeyRound, Pencil, X, Copy, UserX, UserCheck, Eye, EyeOff,
} from "lucide-react";

type Role = "SUPERADMIN" | "OBSERVADOR";

interface UserRow {
  id: string;
  username: string;
  displayName: string | null;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const ROLE_LABEL: Record<Role, string> = {
  SUPERADMIN: "Superadministrador",
  OBSERVADOR: "Observador",
};

const ROLE_BADGE: Record<Role, string> = {
  SUPERADMIN: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100",
  OBSERVADOR: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < 12; i += 1) out += alphabet[(bytes[i] ?? 0) % alphabet.length];
  const specials = "!@#$%&*";
  out += specials[(bytes[12] ?? 0) % specials.length];
  out += String((bytes[13] ?? 0) % 10);
  return out;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" });
}

function Notice({ kind, children }: { kind: "ok" | "error"; children: React.ReactNode }) {
  const base = "flex items-start gap-2 rounded-lg border px-4 py-3 text-sm";
  return (
    <div
      className={
        kind === "ok"
          ? `${base} bg-emerald-50 border-emerald-100 text-emerald-700`
          : `${base} bg-red-50 border-red-100 text-red-700`
      }
    >
      {kind === "ok" ? (
        <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      )}
      <span className="min-w-0 break-words">{children}</span>
    </div>
  );
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ username: "", displayName: "", role: "OBSERVADOR" as Role, password: "" });

  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ displayName: "", role: "OBSERVADOR" as Role, isActive: true });
  const [editSaving, setEditSaving] = useState(false);

  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetSaving, setResetSaving] = useState(false);
  const [resetDoneFor, setResetDoneFor] = useState<{ username: string; password: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/users");
      if (res.status === 403) {
        setForbidden(true);
        setUsers([]);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message ?? "No se pudieron cargar los usuarios.");
      setForbidden(false);
      setUsers(data.items ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBanner(null);
    setSaving(true);
    try {
      const res = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.username.trim(),
          displayName: form.displayName.trim() || undefined,
          role: form.role,
          password: form.password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? "No se pudo crear el usuario.");
        return;
      }
      setBanner(`Usuario «${data.username}» creado con rol ${ROLE_LABEL[data.role as Role]}.`);
      setShowForm(false);
      setForm({ username: "", displayName: "", role: "OBSERVADOR", password: "" });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (user: UserRow) => {
    setEditing(user);
    setEditForm({
      displayName: user.displayName ?? "",
      role: user.role,
      isActive: user.isActive,
    });
    setError(null);
  };

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setEditSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/users/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: editForm.displayName.trim(),
          role: editForm.role,
          isActive: editForm.isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? "No se pudo actualizar el usuario.");
        return;
      }
      setBanner(`Usuario «${data.username}» actualizado.`);
      setEditing(null);
      await load();
    } finally {
      setEditSaving(false);
    }
  };

  const toggleActive = async (user: UserRow) => {
    setError(null);
    setBanner(null);
    try {
      const res = await fetch(`/api/v1/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? "No se pudo cambiar el estado del usuario.");
        return;
      }
      setBanner(`Usuario «${data.username}» ${data.isActive ? "activado" : "desactivado"}.`);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const openReset = (user: UserRow) => {
    setResetting(user);
    setResetPassword(generatePassword());
    setResetDoneFor(null);
    setError(null);
  };

  const submitReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!resetting) return;
    setResetSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/users/${resetting.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-password", newPassword: resetPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.message ?? "No se pudo restablecer la contraseña.");
        return;
      }
      setResetDoneFor({ username: resetting.username, password: resetPassword });
      setBanner(`Contraseña restablecida para «${resetting.username}».`);
      await load();
    } finally {
      setResetSaving(false);
    }
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setBanner("Contraseña copiada al portapapeles.");
    } catch {
      setError("No se pudo copiar. Selecciona el texto manualmente.");
    }
  };

  const totalActive = users.filter((u) => u.isActive).length;
  const superadmins = users.filter((u) => u.role === "SUPERADMIN" && u.isActive).length;

  if (forbidden) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Shield className="w-5 h-5" /> Acceso restringido
          </h1>
          <p className="mt-2 text-sm">
            La gestión de usuarios está reservada al rol SUPERADMIN. Tu cuenta es de solo lectura.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Usuarios y accesos</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Altas, roles y rotación de contraseñas. Toda mutación queda auditada con actor e IP.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refrescar
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            <UserPlus className="w-4 h-4" /> Nuevo usuario
          </button>
        </div>
      </div>

      {banner && <Notice kind="ok">{banner}</Notice>}
      {error && <Notice kind="error">{error}</Notice>}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Users className="w-4 h-4 text-indigo-600" /> Usuarios registrados
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{users.length}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <UserCheck className="w-4 h-4 text-emerald-600" /> Cuentas activas
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{totalActive}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <ShieldCheck className="w-4 h-4 text-indigo-600" /> Superadmins activos
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{superadmins}</div>
          <p className="text-xs text-slate-400 mt-1">Debe existir al menos uno en todo momento.</p>
        </div>
      </div>

      {showForm && (
        <form
          onSubmit={submitCreate}
          className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4"
        >
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <UserPlus className="w-4 h-4 text-indigo-600" /> Alta de usuario
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Usuario *</label>
              <input
                required
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                placeholder="juan.perez"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-1 text-[11px] text-slate-400">3–50 caracteres: letras, números, . _ -</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nombre visible</label>
              <input
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                placeholder="Juan Pérez — Turno noche"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Rol *</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="OBSERVADOR">Observador (solo lectura)</option>
                <option value="SUPERADMIN">Superadministrador (acceso total)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Contraseña inicial *</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  required
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setForm((f) => ({ ...f, password: generatePassword() }));
                  setShowPassword(true);
                }}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
              >
                <KeyRound className="w-4 h-4" /> Generar segura
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              Mínimo 10 caracteres, con al menos una letra y un número. Compártela por un canal seguro.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} Crear usuario
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Directorio de usuarios</h2>
          <span className="text-xs text-slate-400">{users.length} cuenta(s)</span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Cargando usuarios…
          </div>
        ) : users.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">No hay usuarios registrados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="px-5 py-2.5 text-left font-medium">Usuario</th>
                  <th className="px-5 py-2.5 text-left font-medium">Rol</th>
                  <th className="px-5 py-2.5 text-left font-medium">Estado</th>
                  <th className="px-5 py-2.5 text-left font-medium">Último acceso</th>
                  <th className="px-5 py-2.5 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">{user.username}</div>
                      <div className="text-xs text-slate-500">{user.displayName ?? "Sin nombre visible"}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[user.role]}`}>
                        {user.role === "SUPERADMIN" ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                        {ROLE_LABEL[user.role]}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                          user.isActive
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                            : "bg-rose-50 text-rose-700 ring-1 ring-rose-100"
                        }`}
                      >
                        {user.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(user.lastLoginAt)}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(user)}
                          title="Editar nombre, rol o estado"
                          className="p-1.5 rounded-md text-slate-500 hover:text-indigo-700 hover:bg-indigo-50"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openReset(user)}
                          title="Restablecer contraseña"
                          className="p-1.5 rounded-md text-slate-500 hover:text-amber-700 hover:bg-amber-50"
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => toggleActive(user)}
                          title={user.isActive ? "Desactivar cuenta" : "Activar cuenta"}
                          className={`p-1.5 rounded-md ${
                            user.isActive
                              ? "text-slate-500 hover:text-rose-700 hover:bg-rose-50"
                              : "text-slate-500 hover:text-emerald-700 hover:bg-emerald-50"
                          }`}
                        >
                          {user.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <form onSubmit={submitEdit} className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Pencil className="w-4 h-4 text-indigo-600" /> Editar «{editing.username}»
              </h2>
              <button type="button" onClick={() => setEditing(null)} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nombre visible</label>
                <input
                  value={editForm.displayName}
                  onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Rol</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value as Role }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="OBSERVADOR">Observador (solo lectura)</option>
                  <option value="SUPERADMIN">Superadministrador (acceso total)</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editForm.isActive}
                  onChange={(e) => setEditForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Cuenta activa (puede iniciar sesión)
              </label>
              <p className="text-[11px] text-slate-400">
                No puedes desactivar tu propia cuenta ni quitarte el rol. La plataforma siempre conserva
                al menos un SUPERADMIN activo.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={editSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {editSaving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {resetting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <form onSubmit={submitReset} className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <KeyRound className="w-4 h-4 text-amber-600" /> Restablecer contraseña
              </h2>
              <button type="button" onClick={() => setResetting(null)} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-3">
              <p className="text-sm text-slate-600">
                Usuario: <span className="font-medium text-slate-900">{resetting.username}</span>
              </p>

              {resetDoneFor ? (
                <div className="space-y-2">
                  <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-700">
                    Contraseña restablecida. Cópiala ahora: no se volverá a mostrar.
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
                    <code className="flex-1 text-sm font-mono break-all">{resetDoneFor.password}</code>
                    <button
                      type="button"
                      onClick={() => copy(resetDoneFor.password)}
                      className="p-1.5 rounded-md text-slate-500 hover:text-indigo-700 hover:bg-white"
                      title="Copiar"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Nueva contraseña</label>
                    <div className="flex gap-2">
                      <input
                        required
                        value={resetPassword}
                        onChange={(e) => setResetPassword(e.target.value)}
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => setResetPassword(generatePassword())}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <RefreshCw className="w-4 h-4" /> Generar
                      </button>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Mínimo 10 caracteres, con al menos una letra y un número.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={() => setResetting(null)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                {resetDoneFor ? "Cerrar" : "Cancelar"}
              </button>
              {!resetDoneFor && (
                <button
                  type="submit"
                  disabled={resetSaving}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {resetSaving && <Loader2 className="w-4 h-4 animate-spin" />} Restablecer
                </button>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
