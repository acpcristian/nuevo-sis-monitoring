"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Palette, Sun, Moon, Save, RotateCcw, CheckCircle2, AlertCircle, Loader2,
  ShieldAlert, Sparkles, Type, Square,
} from "lucide-react";
import {
  DEFAULT_THEME,
  THEME_PRESETS,
  contrastRatio,
  densityFontSize,
  isValidHexColor,
  presetById,
  themeVars,
  type Theme,
} from "@/core/domain/theme";

interface ThemeMeta {
  updatedAt: string | null;
  updatedBy: string | null;
}

function applyToDocument(theme: Theme): void {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme.mode);
  root.setAttribute("data-density", theme.density);
  const vars = themeVars(theme);
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

function formatDate(value: string | null): string {
  if (!value) return "Sin cambios registrados";
  return new Date(value).toLocaleString("es-BO", { dateStyle: "medium", timeStyle: "short" });
}

export default function AppearancePage() {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [meta, setMeta] = useState<ThemeMeta>({ updatedAt: null, updatedBy: null });
  const [initial, setInitial] = useState<Theme>(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [meRes, themeRes] = await Promise.all([
          fetch("/api/v1/auth/me"),
          fetch("/api/v1/settings/theme"),
        ]);

        if (meRes.status === 401 || themeRes.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (meRes.status === 403 || themeRes.status === 403) {
          if (!cancelled) setForbidden(true);
          return;
        }

        const me = await meRes.json().catch(() => null);
        if (me?.role !== "SUPERADMIN") {
          if (!cancelled) setForbidden(true);
          return;
        }

        const body = await themeRes.json().catch(() => null);
        if (themeRes.ok && body?.theme) {
          const loaded = body.theme as Theme;
          if (!cancelled) {
            setTheme(loaded);
            setInitial(loaded);
            setMeta(body.meta ?? { updatedAt: null, updatedBy: null });
          }
        }
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const invalidHex = !isValidHexColor(theme.primaryColor);
  const dirty = useMemo(() => JSON.stringify(theme) !== JSON.stringify(initial), [theme, initial]);
  const previewStyle = useMemo(
    () => ({ ...themeVars(theme), fontSize: densityFontSize(theme.density) }) as React.CSSProperties,
    [theme]
  );
  const primaryContrast = useMemo(
    () => (invalidHex ? 0 : contrastRatio(theme.primaryColor, "#ffffff")),
    [theme.primaryColor, invalidHex]
  );

  const selectPreset = useCallback((presetId: string) => {
    const preset = presetById(presetId);
    if (!preset) return;
    setTheme((current) => ({ ...current, preset: preset.id, primaryColor: preset.color }));
    setSuccess(null);
  }, []);

  const save = useCallback(async () => {
    setError(null);
    setSuccess(null);
    if (invalidHex) {
      setError("El color principal debe tener el formato #rrggbb.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/v1/settings/theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(theme),
      });
      const body = await res.json().catch(() => ({}));

      if (res.status === 403) {
        setForbidden(true);
        return;
      }
      if (!res.ok) {
        throw new Error(body?.message ?? "No se pudo guardar la apariencia.");
      }

      const saved = (body.theme ?? theme) as Theme;
      setTheme(saved);
      setInitial(saved);
      setMeta(body.meta ?? { updatedAt: new Date().toISOString(), updatedBy: null });
      applyToDocument(saved);
      setSuccess("Apariencia guardada. Se aplicó a todo el sistema.");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }, [theme, invalidHex, router]);

  const reset = useCallback(() => {
    setTheme(DEFAULT_THEME);
    setSuccess(null);
    setError(null);
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 text-center text-sm text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" /> Cargando apariencia…
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="max-w-3xl mx-auto py-16 px-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldAlert className="w-5 h-5" /> Acceso restringido
          </h1>
          <p className="mt-2 text-sm">
            Solo el rol SUPERADMIN puede cambiar la apariencia global del sistema.
          </p>
        </div>
      </div>
    );
  }

  const activePreset = presetById(theme.preset);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Palette className="w-6 h-6 text-indigo-600" />
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Apariencia</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Color principal, modo claro/oscuro, bordes y densidad. El cambio es global y queda
            registrado en auditoría.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="w-4 h-4" /> Restablecer
          </button>
          <button
            onClick={save}
            disabled={saving || invalidHex || !dirty}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Guardar cambios
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-5">
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Sparkles className="w-4 h-4 text-indigo-600" /> Tema predefinido
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Elige una paleta base o define tu propio color principal más abajo.
            </p>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {THEME_PRESETS.map((preset) => {
                const active = theme.preset === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => selectPreset(preset.id)}
                    className={`group rounded-lg border p-3 text-left transition ${
                      active
                        ? "border-indigo-500 ring-2 ring-indigo-500/30"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span
                      className="block h-8 w-full rounded-md"
                      style={{
                        background: `linear-gradient(135deg, ${preset.color} 0%, ${preset.color} 55%, ${preset.color}99 100%)`,
                      }}
                    />
                    <span className="mt-2 block text-xs font-medium text-slate-700">
                      {preset.label}
                    </span>
                    <span className="block text-[10px] font-mono text-slate-400">
                      {preset.color}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Palette className="w-4 h-4 text-indigo-600" /> Color principal
            </h2>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                type="color"
                value={isValidHexColor(theme.primaryColor) ? theme.primaryColor : "#4f46e5"}
                onChange={(e) =>
                  setTheme((current) => ({ ...current, preset: "custom", primaryColor: e.target.value }))
                }
                className="h-10 w-16 cursor-pointer rounded-lg border border-slate-300 bg-white p-1"
                aria-label="Selector de color principal"
              />
              <input
                type="text"
                value={theme.primaryColor}
                onChange={(e) =>
                  setTheme((current) => ({ ...current, preset: "custom", primaryColor: e.target.value }))
                }
                className={`w-40 rounded-lg border px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  invalidHex ? "border-red-300" : "border-slate-300"
                }`}
                placeholder="#4f46e5"
              />
              <span className="text-xs text-slate-500">
                {invalidHex
                  ? "Formato inválido: usa #rrggbb."
                  : `Contraste con texto blanco: ${primaryContrast.toFixed(1)}:1`}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {(["50", "100", "500", "600", "700"] as const).map((step) => (
                <div key={step} className="text-center">
                  <div
                    className="h-9 rounded-md border border-slate-200"
                    style={{ backgroundColor: `var(--primary-${step})` }}
                  />
                  <span className="mt-1 block text-[10px] text-slate-400">{step}</span>
                </div>
              ))}
            </div>
            {activePreset && (
              <p className="text-[11px] text-slate-400">
                Tema activo: {activePreset.label}. Al elegir un color propio pasa a «Personalizado».
              </p>
            )}
          </section>

          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <Sun className="w-4 h-4 text-indigo-600" /> Modo y densidad
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setTheme((current) => ({ ...current, mode: "light" }))}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium ${
                  theme.mode === "light"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Sun className="w-4 h-4" /> Claro
              </button>
              <button
                onClick={() => setTheme((current) => ({ ...current, mode: "dark" }))}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium ${
                  theme.mode === "dark"
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-slate-300 text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Moon className="w-4 h-4" /> Oscuro
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
                  <Square className="w-3.5 h-3.5" /> Radio de bordes
                  <span className="ml-auto font-mono text-slate-400">{theme.radius}px</span>
                </label>
                <input
                  type="range"
                  min={0}
                  max={16}
                  step={1}
                  value={theme.radius}
                  onChange={(e) =>
                    setTheme((current) => ({ ...current, radius: Number(e.target.value) }))
                  }
                  className="w-full accent-indigo-600"
                />
              </div>
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 mb-1">
                  <Type className="w-3.5 h-3.5" /> Densidad
                </label>
                <select
                  value={theme.density}
                  onChange={(e) =>
                    setTheme((current) => ({
                      ...current,
                      density: e.target.value === "compact" ? "compact" : "comfortable",
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="comfortable">Cómoda (16 px)</option>
                  <option value="compact">Compacta (15 px)</option>
                </select>
              </div>
            </div>
          </section>
        </div>

        <aside className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <h2 className="text-sm font-semibold text-slate-800">Vista previa</h2>
            <p className="text-xs text-slate-500 mt-0.5">Sin guardar · se aplica al confirmar.</p>

            <div
              data-theme={theme.mode}
              style={previewStyle}
              className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 text-slate-900"
            >
              <div className="flex items-center justify-between border-b border-slate-200 bg-white/95 px-3 py-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
                  <span className="h-2.5 w-2.5 rounded-full bg-indigo-600" /> Monitoreo
                </span>
                <span className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="text-indigo-600">Servidores</span>
                  <span>Incidentes</span>
                  <span>Métricas</span>
                </span>
              </div>

              <div className="space-y-3 p-3">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900">Estado del inventario</span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-100">
                      Operativo
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    12 servidores monitoreados · 2 alertas abiertas.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-indigo-100">
                      Principal
                    </span>
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 ring-1 ring-amber-100">
                      Advertencia
                    </span>
                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700 ring-1 ring-rose-100">
                      Crítico
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-600">Uso de CPU</span>
                    <span className="font-mono text-slate-800">42%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full w-[42%] rounded-full bg-indigo-600" />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-indigo-700">
                      Acción principal
                    </button>
                    <button className="rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-50">
                      Secundaria
                    </button>
                  </div>
                </div>

                <input
                  readOnly
                  value="10.0.0.15"
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[11px] text-slate-600"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500 space-y-1">
            <p>
              <span className="font-medium text-slate-700">Tema:</span>{" "}
              {activePreset?.label ?? "Personalizado"}
            </p>
            <p>
              <span className="font-medium text-slate-700">Modo:</span>{" "}
              {theme.mode === "dark" ? "Oscuro" : "Claro"}
            </p>
            <p>
              <span className="font-medium text-slate-700">Bordes:</span> {theme.radius} px ·{" "}
              {theme.density === "compact" ? "Compacta" : "Cómoda"}
            </p>
            <p className="pt-1 text-[11px] text-slate-400">
              Última actualización: {formatDate(meta.updatedAt)}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
