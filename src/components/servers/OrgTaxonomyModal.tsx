"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  FolderTree,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import type { OrgCategory } from "./SecretariaBoard";

interface OrgUnit {
  id: string;
  name: string;
  categoryId: string | null;
  category: { id: string; slug: string; name: string; color: string; sortOrder: number } | null;
  tags: string[];
  sortOrder: number;
  active: boolean;
  serverCount: number;
}

type Tab = "categories" | "units";

const DEFAULT_COLOR = "#6366f1";

function parseTags(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of value.split(/[,\n]/)) {
    const tag = raw.trim().replace(/\s+/g, " ");
    if (!tag) continue;
    const key = tag.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }
  return result;
}

async function apiRequest<T>(url: string, method: string, body?: unknown): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { message?: string } & Record<string, unknown>;
  if (!response.ok) {
    throw new Error(data.message || "No se pudo completar la operación.");
  }
  return data as T;
}

export default function OrgTaxonomyModal({
  open,
  categories,
  tagVocabulary,
  onClose,
  onChanged,
}: {
  open: boolean;
  categories: OrgCategory[];
  tagVocabulary: string[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>("categories");
  const [localCategories, setLocalCategories] = useState<OrgCategory[]>(categories);
  const [units, setUnits] = useState<OrgUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [categoryForm, setCategoryForm] = useState({ name: "", color: DEFAULT_COLOR, sortOrder: "100" });
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryEdit, setCategoryEdit] = useState({ name: "", color: DEFAULT_COLOR, sortOrder: "0" });
  const [unitSearch, setUnitSearch] = useState("");
  const [unitForm, setUnitForm] = useState({ name: "", categoryId: "", tags: "" });

  // Al abrir: limpiar mensajes y forzar recarga de unidades.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setNotice(null);
    setUnits([]);
  }, [open]);

  // Mantener la lista local sincronizada si el padre recarga categorías.
  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  const loadUnits = useCallback(async () => {
    setUnitsLoading(true);
    try {
      const data = await apiRequest<{ items: OrgUnit[] }>("/api/v1/org-units", "GET");
      setUnits(Array.isArray(data.items) ? data.items : []);
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setUnitsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && tab === "units" && units.length === 0 && !unitsLoading) {
      void loadUnits();
    }
  }, [open, tab, units.length, unitsLoading, loadUnits]);

  const refreshCategories = useCallback(async () => {
    const data = await apiRequest<{ items: OrgCategory[] }>("/api/v1/org-categories", "GET");
    setLocalCategories(Array.isArray(data.items) ? data.items : []);
  }, []);

  const handleCreateCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy("create-category");
    setError(null);
    try {
      await apiRequest("/api/v1/org-categories", "POST", {
        name: categoryForm.name,
        color: categoryForm.color,
        sortOrder: Number(categoryForm.sortOrder) || 100,
      });
      setCategoryForm({ name: "", color: DEFAULT_COLOR, sortOrder: "100" });
      await refreshCategories();
      onChanged();
      setNotice("Categoría creada.");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  };

  const startEditCategory = (category: OrgCategory) => {
    setEditingCategoryId(category.id);
    setCategoryEdit({
      name: category.name,
      color: category.color,
      sortOrder: String(category.sortOrder),
    });
  };

  const handleUpdateCategory = async (id: string) => {
    setBusy(`update-category-${id}`);
    setError(null);
    try {
      await apiRequest(`/api/v1/org-categories/${id}`, "PUT", {
        name: categoryEdit.name,
        color: categoryEdit.color,
        sortOrder: Number(categoryEdit.sortOrder) || 0,
      });
      setEditingCategoryId(null);
      await refreshCategories();
      onChanged();
      setNotice("Categoría actualizada.");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteCategory = async (category: OrgCategory) => {
    if (!window.confirm(`¿Eliminar la categoría "${category.name}"?`)) return;
    setBusy(`delete-category-${category.id}`);
    setError(null);
    try {
      await apiRequest(`/api/v1/org-categories/${category.id}`, "DELETE");
      await refreshCategories();
      onChanged();
      setNotice("Categoría eliminada.");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  };

  const handleCreateUnit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy("create-unit");
    setError(null);
    try {
      await apiRequest("/api/v1/org-units", "POST", {
        name: unitForm.name,
        categoryId: unitForm.categoryId || null,
        tags: parseTags(unitForm.tags),
      });
      setUnitForm({ name: "", categoryId: "", tags: "" });
      await loadUnits();
      onChanged();
      setNotice("Unidad creada.");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  };

  const handleUpdateUnit = async (id: string, input: { categoryId: string | null; tags: string[] }) => {
    setBusy(`update-unit-${id}`);
    setError(null);
    try {
      await apiRequest(`/api/v1/org-units/${id}`, "PUT", input);
      await loadUnits();
      onChanged();
      setNotice("Unidad actualizada.");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  };

  const handleDeleteUnit = async (unit: OrgUnit) => {
    if (!window.confirm(`¿Eliminar la unidad "${unit.name}"?`)) return;
    setBusy(`delete-unit-${unit.id}`);
    setError(null);
    try {
      await apiRequest(`/api/v1/org-units/${unit.id}`, "DELETE");
      await loadUnits();
      onChanged();
      setNotice("Unidad eliminada.");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(null);
    }
  };

  const filteredUnits = useMemo(() => {
    const term = unitSearch.trim().toLowerCase();
    if (!term) return units;
    return units.filter(
      (unit) =>
        unit.name.toLowerCase().includes(term) ||
        unit.tags.some((tag) => tag.toLowerCase().includes(term)) ||
        (unit.category?.name.toLowerCase().includes(term) ?? false)
    );
  }, [units, unitSearch]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="org-taxonomy-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#172033]/55 px-4 backdrop-blur-sm"
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[var(--border-2)] bg-white shadow-large">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-1)] px-5 py-4">
          <div>
            <h2 id="org-taxonomy-title" className="text-base font-semibold text-[var(--text-1)]">
              Categorías y etiquetas
            </h2>
            <p className="mt-0.5 text-xs text-[var(--text-3)]">
              Clasifica las unidades por tipo de entidad y asígnales etiquetas. El agente usará esta
              estructura para distinguir categorías y etiquetas.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana"
            className="rounded-md p-1.5 text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-[var(--border-1)] px-5 pt-3">
          <button
            type="button"
            onClick={() => setTab("categories")}
            className={`inline-flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-semibold transition-colors ${
              tab === "categories"
                ? "border-b-2 border-[var(--primary-600)] text-[var(--primary-700)]"
                : "text-[var(--text-3)] hover:text-[var(--text-1)]"
            }`}
          >
            <FolderTree className="h-4 w-4" aria-hidden="true" />
            Categorías
            <span className="rounded-full bg-[var(--surface-2)] px-1.5 text-[11px] tabular-nums">
              {localCategories.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab("units")}
            className={`inline-flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-semibold transition-colors ${
              tab === "units"
                ? "border-b-2 border-[var(--primary-600)] text-[var(--primary-700)]"
                : "text-[var(--text-3)] hover:text-[var(--text-1)]"
            }`}
          >
            <Tag className="h-4 w-4" aria-hidden="true" />
            Unidades y etiquetas
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {(error || notice) && (
            <div
              role="status"
              className={`mb-4 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                error
                  ? "border-rose-200 bg-rose-50 text-rose-800"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {error ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              ) : (
                <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              )}
              <span className="flex-1">{error ?? notice}</span>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                }}
                className="text-xs font-semibold underline"
              >
                Cerrar
              </button>
            </div>
          )}

          {tab === "categories" ? (
            <div className="space-y-5">
              <form onSubmit={handleCreateCategory} className="rounded-xl border border-[var(--border-2)] p-4">
                <p className="text-sm font-semibold text-[var(--text-1)]">Nueva categoría</p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
                  <label className="text-xs font-medium text-[var(--text-2)]">
                    Nombre
                    <input
                      value={categoryForm.name}
                      onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })}
                      required
                      minLength={2}
                      maxLength={80}
                      placeholder="Subalcaldías"
                      className="mt-1 w-full rounded-lg border border-[var(--border-2)] bg-white px-3 py-2 text-sm text-[var(--text-1)] focus:border-[var(--primary-500)] focus:outline-none"
                    />
                  </label>
                  <label className="text-xs font-medium text-[var(--text-2)]">
                    Color
                    <input
                      type="color"
                      value={categoryForm.color}
                      onChange={(event) => setCategoryForm({ ...categoryForm, color: event.target.value })}
                      className="mt-1 block h-[38px] w-14 cursor-pointer rounded-lg border border-[var(--border-2)] bg-white p-1"
                    />
                  </label>
                  <label className="text-xs font-medium text-[var(--text-2)]">
                    Orden
                    <input
                      type="number"
                      min={0}
                      max={9999}
                      value={categoryForm.sortOrder}
                      onChange={(event) => setCategoryForm({ ...categoryForm, sortOrder: event.target.value })}
                      className="mt-1 w-20 rounded-lg border border-[var(--border-2)] bg-white px-2 py-2 text-sm text-[var(--text-1)] focus:border-[var(--primary-500)] focus:outline-none"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={busy === "create-category"}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--primary-600)] px-3.5 py-2 text-sm font-semibold text-[var(--primary-contrast)] transition-colors hover:bg-[var(--primary-700)] disabled:opacity-60"
                  >
                    {busy === "create-category" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Plus className="h-4 w-4" aria-hidden="true" />
                    )}
                    Agregar
                  </button>
                </div>
              </form>

              <div className="overflow-hidden rounded-xl border border-[var(--border-2)]">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-[var(--border-1)] bg-[var(--surface-2)] text-[11px] font-semibold uppercase tracking-wide text-[var(--text-3)]">
                    <tr>
                      <th scope="col" className="px-4 py-2.5">Categoría</th>
                      <th scope="col" className="px-4 py-2.5">Orden</th>
                      <th scope="col" className="px-4 py-2.5">Unidades</th>
                      <th scope="col" className="px-4 py-2.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-1)]">
                    {localCategories.map((category) => {
                      const editing = editingCategoryId === category.id;
                      return (
                        <tr key={category.id} className="align-middle">
                          <td className="px-4 py-2.5">
                            {editing ? (
                              <div className="flex items-center gap-2">
                                <input
                                  value={categoryEdit.name}
                                  onChange={(event) =>
                                    setCategoryEdit({ ...categoryEdit, name: event.target.value })
                                  }
                                  className="w-full rounded-lg border border-[var(--border-2)] px-2 py-1.5 text-sm"
                                  aria-label="Nombre de la categoría"
                                />
                                <input
                                  type="color"
                                  value={categoryEdit.color}
                                  onChange={(event) =>
                                    setCategoryEdit({ ...categoryEdit, color: event.target.value })
                                  }
                                  className="h-8 w-10 cursor-pointer rounded border border-[var(--border-2)] p-0.5"
                                  aria-label="Color de la categoría"
                                />
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span
                                  aria-hidden="true"
                                  className="h-2.5 w-2.5 rounded-full"
                                  style={{ backgroundColor: category.color }}
                                />
                                <span className="font-medium text-[var(--text-1)]">{category.name}</span>
                                <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] text-[var(--text-3)]">
                                  {category.slug}
                                </code>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums text-[var(--text-2)]">
                            {editing ? (
                              <input
                                type="number"
                                min={0}
                                max={9999}
                                value={categoryEdit.sortOrder}
                                onChange={(event) =>
                                  setCategoryEdit({ ...categoryEdit, sortOrder: event.target.value })
                                }
                                className="w-20 rounded-lg border border-[var(--border-2)] px-2 py-1.5 text-sm"
                                aria-label="Orden de la categoría"
                              />
                            ) : (
                              category.sortOrder
                            )}
                          </td>
                          <td className="px-4 py-2.5 tabular-nums text-[var(--text-2)]">
                            {category.unitCount}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-1.5">
                              {editing ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void handleUpdateCategory(category.id)}
                                    disabled={busy === `update-category-${category.id}`}
                                    className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 disabled:opacity-60"
                                  >
                                    <Check className="h-3 w-3" aria-hidden="true" />
                                    Guardar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingCategoryId(null)}
                                    className="rounded-md border border-[var(--border-2)] px-2 py-1 text-xs font-medium text-[var(--text-2)]"
                                  >
                                    Cancelar
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => startEditCategory(category)}
                                    className="rounded-md border border-[var(--border-2)] p-1.5 text-[var(--text-2)] transition-colors hover:border-[var(--primary-200)] hover:text-[var(--primary-600)]"
                                    aria-label={`Editar ${category.name}`}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteCategory(category)}
                                    disabled={busy === `delete-category-${category.id}`}
                                    className="rounded-md border border-rose-200 p-1.5 text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60"
                                    aria-label={`Eliminar ${category.name}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {localCategories.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-3)]">
                          No hay categorías. Crea la primera arriba.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <form onSubmit={handleCreateUnit} className="rounded-xl border border-[var(--border-2)] p-4">
                <p className="text-sm font-semibold text-[var(--text-1)]">Nueva unidad organizacional</p>
                <p className="mt-0.5 text-xs text-[var(--text-3)]">
                  El nombre debe coincidir con el valor de la etiqueta <code>secretaria</code> de sus
                  servidores.
                </p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-[var(--text-2)]">
                    Nombre
                    <input
                      value={unitForm.name}
                      onChange={(event) => setUnitForm({ ...unitForm, name: event.target.value })}
                      required
                      minLength={2}
                      maxLength={200}
                      placeholder="SUBALCALDÍA DISTRITO 1"
                      className="mt-1 w-full rounded-lg border border-[var(--border-2)] bg-white px-3 py-2 text-sm text-[var(--text-1)] focus:border-[var(--primary-500)] focus:outline-none"
                    />
                  </label>
                  <label className="text-xs font-medium text-[var(--text-2)]">
                    Categoría
                    <select
                      value={unitForm.categoryId}
                      onChange={(event) => setUnitForm({ ...unitForm, categoryId: event.target.value })}
                      className="mt-1 w-full rounded-lg border border-[var(--border-2)] bg-white px-3 py-2 text-sm text-[var(--text-1)] focus:border-[var(--primary-500)] focus:outline-none"
                    >
                      <option value="">Sin categoría</option>
                      {localCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-medium text-[var(--text-2)] sm:col-span-2">
                    Etiquetas (separadas por coma)
                    <input
                      value={unitForm.tags}
                      onChange={(event) => setUnitForm({ ...unitForm, tags: event.target.value })}
                      placeholder="Atención ciudadana, Salud"
                      list="org-tag-vocabulary"
                      className="mt-1 w-full rounded-lg border border-[var(--border-2)] bg-white px-3 py-2 text-sm text-[var(--text-1)] focus:border-[var(--primary-500)] focus:outline-none"
                    />
                  </label>
                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      disabled={busy === "create-unit"}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary-600)] px-3.5 py-2 text-sm font-semibold text-[var(--primary-contrast)] transition-colors hover:bg-[var(--primary-700)] disabled:opacity-60"
                    >
                      {busy === "create-unit" ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      )}
                      Agregar unidad
                    </button>
                  </div>
                </div>
              </form>

              <datalist id="org-tag-vocabulary">
                {tagVocabulary.map((tag) => (
                  <option key={tag} value={tag} />
                ))}
              </datalist>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <input
                  value={unitSearch}
                  onChange={(event) => setUnitSearch(event.target.value)}
                  placeholder="Buscar unidad, categoría o etiqueta..."
                  aria-label="Buscar unidad organizacional"
                  className="w-full rounded-lg border border-[var(--border-2)] bg-white px-3 py-2 text-sm text-[var(--text-1)] focus:border-[var(--primary-500)] focus:outline-none sm:max-w-sm"
                />
                <button
                  type="button"
                  onClick={() => void loadUnits()}
                  className="inline-flex items-center gap-1.5 self-start rounded-lg border border-[var(--border-2)] px-3 py-2 text-sm font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)]"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${unitsLoading ? "animate-spin" : ""}`} aria-hidden="true" />
                  Recargar
                </button>
              </div>

              {unitsLoading && units.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-[var(--text-3)]">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Cargando unidades…
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredUnits.map((unit) => (
                    <UnitRow
                      key={unit.id}
                      unit={unit}
                      categories={localCategories}
                      busy={busy === `update-unit-${unit.id}`}
                      deleting={busy === `delete-unit-${unit.id}`}
                      onSave={(input) => void handleUpdateUnit(unit.id, input)}
                      onDelete={() => void handleDeleteUnit(unit)}
                    />
                  ))}
                  {filteredUnits.length === 0 && (
                    <p className="rounded-xl border border-[var(--border-2)] px-4 py-8 text-center text-sm text-[var(--text-3)]">
                      No hay unidades que coincidan con la búsqueda.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function UnitRow({
  unit,
  categories,
  busy,
  deleting,
  onSave,
  onDelete,
}: {
  unit: OrgUnit;
  categories: OrgCategory[];
  busy: boolean;
  deleting: boolean;
  onSave: (input: { categoryId: string | null; tags: string[] }) => void;
  onDelete: () => void;
}) {
  const [categoryId, setCategoryId] = useState(unit.categoryId ?? "");
  const [tags, setTags] = useState(unit.tags.join(", "));

  useEffect(() => {
    setCategoryId(unit.categoryId ?? "");
    setTags(unit.tags.join(", "));
  }, [unit.categoryId, unit.tags]);

  const parsedTags = parseTags(tags);
  const dirty =
    (categoryId || null) !== unit.categoryId ||
    parsedTags.join("|").toUpperCase() !== unit.tags.join("|").toUpperCase();

  return (
    <div className="rounded-xl border border-[var(--border-2)] bg-white p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[var(--text-1)]" title={unit.name}>
            {unit.name}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--text-3)]">
            {unit.serverCount} servidor{unit.serverCount === 1 ? "" : "es"} ·{" "}
            {unit.category?.name ?? "Sin categoría"}
          </p>
        </div>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="rounded-md border border-rose-200 p-1.5 text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60"
          aria-label={`Eliminar ${unit.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,14rem)_1fr_auto] sm:items-center">
        <select
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
          aria-label={`Categoría de ${unit.name}`}
          className="rounded-lg border border-[var(--border-2)] bg-white px-2.5 py-1.5 text-sm text-[var(--text-1)] focus:border-[var(--primary-500)] focus:outline-none"
        >
          <option value="">Sin categoría</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <input
          value={tags}
          onChange={(event) => setTags(event.target.value)}
          placeholder="Etiquetas separadas por coma"
          aria-label={`Etiquetas de ${unit.name}`}
          className="rounded-lg border border-[var(--border-2)] bg-white px-2.5 py-1.5 text-sm text-[var(--text-1)] focus:border-[var(--primary-500)] focus:outline-none"
        />
        <button
          type="button"
          onClick={() => onSave({ categoryId: categoryId || null, tags: parsedTags })}
          disabled={!dirty || busy}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--primary-600)] px-3 py-1.5 text-xs font-semibold text-[var(--primary-contrast)] transition-colors hover:bg-[var(--primary-700)] disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
          Guardar
        </button>
      </div>
    </div>
  );
}
