"use client";

import React, { useMemo, useState } from "react";
import {
  ArrowDownAZ,
  ArrowRight,
  ArrowUpAZ,
  Building2,
  FolderTree,
  Settings2,
  Tag,
} from "lucide-react";

export interface OrgCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  color: string;
  sortOrder: number;
  unitCount: number;
}

export interface SecretariaGroup {
  id: string;
  unitId: string | null;
  name: string;
  names?: string[];
  category: {
    id: string;
    slug: string;
    name: string;
    color: string;
    sortOrder: number;
  } | null;
  tags: string[];
  sortOrder: number;
  total: number;
  ok: number;
  warn: number;
  down: number;
  serverIds: string[];
}

type SortBy = "category" | "name" | "servers" | "alerts";
type SortDirection = "asc" | "desc";

const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: "category", label: "Categoría / orden institucional" },
  { value: "name", label: "Nombre" },
  { value: "servers", label: "Cantidad de servidores" },
  { value: "alerts", label: "Alertas" },
];

function normalized(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}

interface CategoryBucket {
  key: string;
  name: string;
  description: string | null;
  color: string;
  sortOrder: number;
  groups: SecretariaGroup[];
}

export default function SecretariaBoard({
  groups,
  categories,
  tagVocabulary,
  onOpen,
  onManage,
  canManage,
}: {
  groups: SecretariaGroup[];
  categories: OrgCategory[];
  tagVocabulary: string[];
  onOpen: (groupId: string) => void;
  onManage: () => void;
  canManage: boolean;
}) {
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [unidadFilter, setUnidadFilter] = useState("ALL");
  const [tagFilter, setTagFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<SortBy>("category");
  const [direction, setDirection] = useState<SortDirection>("asc");

  const filtered = useMemo(() => {
    const category = categoryFilter === "ALL" ? null : categoryFilter;
    const unidad = unidadFilter === "ALL" ? null : unidadFilter;
    const tag = tagFilter === "ALL" ? null : normalized(tagFilter);

    return groups.filter((group) => {
      if (category) {
        const groupCategory = group.category?.id ?? "__none__";
        if (groupCategory !== category) return false;
      }
      if (unidad && group.name !== unidad) return false;
      if (tag && !group.tags.some((item) => normalized(item) === tag)) return false;
      return true;
    });
  }, [groups, categoryFilter, unidadFilter, tagFilter]);

  const unidadOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: string[] = [];
    for (const group of groups) {
      if (!seen.has(group.name)) {
        seen.add(group.name);
        options.push(group.name);
      }
    }
    return options.sort((a, b) => a.localeCompare(b, "es"));
  }, [groups]);

  const buckets = useMemo<CategoryBucket[]>(() => {
    const factor = direction === "asc" ? 1 : -1;
    const map = new Map<string, CategoryBucket>();

    for (const group of filtered) {
      const key = group.category?.id ?? "__none__";
      let bucket = map.get(key);
      if (!bucket) {
        bucket = {
          key,
          name: group.category?.name ?? "Sin categoría",
          description:
            group.category?.id
              ? (categories.find((category) => category.id === group.category?.id)?.description ?? null)
              : "Unidades detectadas por etiqueta que aún no están en el catálogo.",
          color: group.category?.color ?? "#94a3b8",
          sortOrder: group.category?.sortOrder ?? Number.MAX_SAFE_INTEGER,
          groups: [],
        };
        map.set(key, bucket);
      }
      bucket.groups.push(group);
    }

    const sortGroups = (items: SecretariaGroup[]) =>
      [...items].sort((a, b) => {
        if (sortBy === "name") {
          return factor * a.name.localeCompare(b.name, "es");
        }
        if (sortBy === "servers") {
          return factor * (a.total - b.total) || a.name.localeCompare(b.name, "es");
        }
        if (sortBy === "alerts") {
          const alertsA = a.warn + a.down;
          const alertsB = b.warn + b.down;
          return factor * (alertsA - alertsB) || a.name.localeCompare(b.name, "es");
        }
        return factor * (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name, "es");
      });

    return Array.from(map.values())
      .map((bucket) => ({ ...bucket, groups: sortGroups(bucket.groups) }))
      .sort((a, b) => {
        if (a.key === "__none__") return 1;
        if (b.key === "__none__") return -1;
        if (sortBy === "category") return factor * (a.sortOrder - b.sortOrder);
        return a.sortOrder - b.sortOrder;
      });
  }, [filtered, categories, direction, sortBy]);

  const totalServers = filtered.reduce((sum, group) => sum + group.total, 0);
  const hasClientFilters = categoryFilter !== "ALL" || tagFilter !== "ALL" || unidadFilter !== "ALL";

  return (
    <div className="space-y-5">
      {/* Controles: filtrar por categoría/etiqueta y ordenar */}
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-2)] bg-white p-4 shadow-soft lg:flex-row lg:items-center">
        <label className="flex items-center gap-2 text-sm">
          <FolderTree className="h-4 w-4 text-[var(--text-4)]" aria-hidden="true" />
          <span className="text-[var(--text-3)]">Categoría</span>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            aria-label="Filtrar por categoría"
            className="cursor-pointer rounded-lg border border-[var(--border-2)] bg-white px-2.5 py-1.5 font-medium text-[var(--text-1)] focus:border-[var(--primary-500)] focus:outline-none"
          >
            <option value="ALL">Todas</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
            <option value="__none__">Sin categoría</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <Building2 className="h-4 w-4 text-[var(--text-4)]" aria-hidden="true" />
          <span className="text-[var(--text-3)]">Unidad</span>
          <select
            value={unidadFilter}
            onChange={(event) => setUnidadFilter(event.target.value)}
            aria-label="Filtrar por unidad"
            className="max-w-[14rem] cursor-pointer rounded-lg border border-[var(--border-2)] bg-white px-2.5 py-1.5 font-medium text-[var(--text-1)] focus:border-[var(--primary-500)] focus:outline-none"
          >
            <option value="ALL">Todas</option>
            {unidadOptions.map((unidad) => (
              <option key={unidad} value={unidad}>
                {unidad}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          <Tag className="h-4 w-4 text-[var(--text-4)]" aria-hidden="true" />
          <span className="text-[var(--text-3)]">Etiqueta</span>
          <select
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            aria-label="Filtrar por etiqueta"
            className="max-w-[12rem] cursor-pointer rounded-lg border border-[var(--border-2)] bg-white px-2.5 py-1.5 font-medium text-[var(--text-1)] focus:border-[var(--primary-500)] focus:outline-none"
          >
            <option value="ALL">Todas</option>
            {tagVocabulary.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm lg:ml-auto">
          <span className="text-[var(--text-3)]">Ordenar por</span>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as SortBy)}
            aria-label="Ordenar contenedores"
            className="cursor-pointer rounded-lg border border-[var(--border-2)] bg-white px-2.5 py-1.5 font-medium text-[var(--text-1)] focus:border-[var(--primary-500)] focus:outline-none"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => setDirection((current) => (current === "asc" ? "desc" : "asc"))}
          aria-label={direction === "asc" ? "Orden ascendente" : "Orden descendente"}
          title={direction === "asc" ? "Ascendente" : "Descendente"}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-2)] bg-white text-[var(--text-2)] transition-colors hover:border-[var(--primary-200)] hover:text-[var(--primary-600)]"
        >
          {direction === "asc" ? (
            <ArrowUpAZ className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ArrowDownAZ className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {canManage && (
          <button
            type="button"
            onClick={onManage}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-2)] bg-white px-3 py-2 text-sm font-semibold text-[var(--text-2)] transition-colors hover:border-[var(--primary-200)] hover:text-[var(--primary-600)]"
          >
            <Settings2 className="h-4 w-4" aria-hidden="true" />
            Administrar
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-3)]">
        <span>
          <strong className="font-semibold text-[var(--text-1)]">{filtered.length}</strong> unidades en{" "}
          <strong className="font-semibold text-[var(--text-1)]">{buckets.filter((bucket) => bucket.key !== "__none__").length}</strong>{" "}
          categorías
        </span>
        <span>
          <strong className="font-semibold text-[var(--text-1)]">{totalServers}</strong> servidores en el filtro
        </span>
        {hasClientFilters && (
          <button
            type="button"
            onClick={() => {
              setCategoryFilter("ALL");
              setUnidadFilter("ALL");
              setTagFilter("ALL");
            }}
            className="font-semibold text-[var(--primary-600)] transition-colors hover:text-[var(--primary-700)]"
          >
            Limpiar categoría, unidad y etiqueta
          </button>
        )}
      </div>

      {buckets.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--border-2)] bg-white px-6 py-14 text-center shadow-soft">
          <Tag className="h-8 w-8 text-[var(--text-4)]" aria-hidden="true" />
          <h3 className="mt-3 text-sm font-semibold text-[var(--text-1)]">
            No hay unidades con esa categoría o etiqueta
          </h3>
          <p className="mt-1 text-sm text-[var(--text-3)]">Prueba con otra combinación de filtros.</p>
          <button
            type="button"
            onClick={() => {
              setCategoryFilter("ALL");
              setUnidadFilter("ALL");
              setTagFilter("ALL");
            }}
            className="mt-4 rounded-lg border border-[var(--border-2)] px-3.5 py-2 text-sm font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--surface-2)]"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        buckets.map((bucket) => (
          <section key={bucket.key} aria-labelledby={`org-category-${bucket.key}`} className="space-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: bucket.color }}
              />
              <h3
                id={`org-category-${bucket.key}`}
                className="text-sm font-semibold text-[var(--text-1)]"
              >
                {bucket.name}
              </h3>
              <span className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--text-3)]">
                {bucket.groups.length} {bucket.groups.length === 1 ? "unidad" : "unidades"}
              </span>
              {bucket.description && (
                <span className="hidden text-xs text-[var(--text-3)] md:inline">{bucket.description}</span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {bucket.groups.map((group) => {
                const alerts = group.warn + group.down;
                const visibleTags = group.tags.slice(0, 3);
                const hiddenTags = group.tags.length - visibleTags.length;
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => onOpen(group.id)}
                    className="group flex h-full flex-col justify-between rounded-xl border border-[var(--border-2)] bg-white p-5 text-left shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--primary-500)] hover:shadow-large focus-visible:-translate-y-0.5"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <span
                          aria-hidden="true"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-50)] transition-colors duration-200 group-hover:bg-[var(--primary-100)]"
                        >
                          <Building2 className="h-5 w-5 text-[var(--primary-600)]" />
                        </span>
                        {group.category && (
                          <span
                            className="inline-flex max-w-[65%] items-center gap-1.5 truncate rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                            style={{
                              backgroundColor: `${group.category.color}20`,
                              color: group.category.color,
                              border: `1px solid ${group.category.color}55`,
                            }}
                            title={group.category.name}
                          >
                            <span
                              aria-hidden="true"
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: group.category.color }}
                            />
                            <span className="truncate">{group.category.name}</span>
                          </span>
                        )}
                      </div>

                      <h4 className="mt-4 line-clamp-2 min-h-[2.5rem] text-[15px] font-semibold leading-snug text-[var(--text-1)]">
                        {group.name}
                      </h4>

                      <div className="mt-2 flex min-h-[1.5rem] flex-wrap items-center gap-1.5">
                        {visibleTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 rounded-md border border-[var(--border-1)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-2)]"
                          >
                            <Tag className="h-2.5 w-2.5 text-[var(--text-4)]" aria-hidden="true" />
                            {tag}
                          </span>
                        ))}
                        {hiddenTags > 0 && (
                          <span
                            className="rounded-md border border-[var(--border-1)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--text-3)]"
                            title={group.tags.slice(3).join(", ")}
                          >
                            +{hiddenTags}
                          </span>
                        )}
                        {!group.tags.length && (
                          <span className="text-[11px] italic text-[var(--text-4)]">Sin etiquetas</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--border-1)] pt-3 text-xs text-[var(--text-3)]">
                      <span className="tabular-nums">
                        <strong className="font-semibold text-[var(--text-1)]">{group.total}</strong>{" "}
                        servidores
                      </span>
                      <span className="tabular-nums">
                        <strong className="font-semibold text-[#1e7c50]">{group.ok}</strong> operativos
                      </span>
                      {alerts > 0 && (
                        <span className="tabular-nums">
                          <strong className="font-semibold text-[#b4432d]">{alerts}</strong>{" "}
                          alerta{alerts === 1 ? "" : "s"}
                        </span>
                      )}
                      <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--primary-600)] opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                        Ingresar
                        <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
