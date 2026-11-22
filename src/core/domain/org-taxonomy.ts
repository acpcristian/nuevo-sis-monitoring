/**
 * Taxonomía organizacional de la plataforma.
 *
 * Los servidores se asocian a una unidad mediante la etiqueta `secretaria`
 * (mismo mecanismo de siempre). Este catálogo describe esas unidades con una
 * categoría de entidad (Secretarías Municipales, Subalcaldías, Empresas
 * Públicas…) y etiquetas libres que permiten ordenar, filtrar y que el agente
 * distinga categorías y etiquetas.
 *
 * La fuente de verdad en runtime es la base de datos (`org_categories` y
 * `org_units`); estas semillas solo poblaron la migración inicial y sirven de
 * autocura si las tablas están vacías.
 */

export interface OrgCategorySeed {
  slug: string;
  name: string;
  description: string;
  color: string;
  sortOrder: number;
}

export interface OrgUnitSeed {
  name: string;
  categorySlug: string;
  tags: string[];
  sortOrder: number;
}

export const ORG_CATEGORY_SEEDS: OrgCategorySeed[] = [
  {
    slug: "despacho",
    name: "Despacho Municipal",
    description: "Despacho del Alcalde y equipo de gabinete directo.",
    color: "#dc2626",
    sortOrder: 5,
  },
  {
    slug: "secretarias-municipales",
    name: "Secretarías Municipales",
    description: "Secretarías del Gobierno Autónomo Municipal de El Alto.",
    color: "#6366f1",
    sortOrder: 10,
  },
  {
    slug: "subalcaldias",
    name: "Subalcaldías",
    description: "Subalcaldías distritales y sus equipos técnicos.",
    color: "#0ea5e9",
    sortOrder: 20,
  },
  {
    slug: "empresas-publicas",
    name: "Empresas Públicas",
    description: "Empresas y entidades descentralizadas del municipio.",
    color: "#14b8a6",
    sortOrder: 30,
  },
  {
    slug: "direcciones-unidades",
    name: "Direcciones y Unidades",
    description: "Direcciones, unidades de apoyo y equipos operativos.",
    color: "#f59e0b",
    sortOrder: 40,
  },
];

/**
 * Catálogo oficial de unidades (Secretarías municipales de El Alto) con su
 * categoría y etiquetas sugeridas. El orden institucional se conserva.
 */
export const ORG_UNIT_SEEDS: OrgUnitSeed[] = [
  {
    name: "DESPACHO MUNICIPAL",
    categorySlug: "despacho",
    tags: ["Alcaldía", "Gabinete", "Despacho"],
    sortOrder: 5,
  },
  {
    name: "SECRETARÍA MUNICIPAL DE GESTIÓN INSTITUCIONAL",
    categorySlug: "secretarias-municipales",
    tags: ["Institucional", "Talento humano", "Planificación"],
    sortOrder: 10,
  },
  {
    name: "SECRETARÍA MUNICIPAL DE ADMINISTRACIÓN Y FINANZAS",
    categorySlug: "secretarias-municipales",
    tags: ["Finanzas", "Compras", "Presupuesto"],
    sortOrder: 20,
  },
  {
    name: "SECRETARÍA MUNICIPAL DE MOVILIDAD URBANA",
    categorySlug: "secretarias-municipales",
    tags: ["Transporte", "Tránsito", "Vías"],
    sortOrder: 30,
  },
  {
    name: "SECRETARÍA MUNICIPAL DE EDUCACIÓN Y CULTURA",
    categorySlug: "secretarias-municipales",
    tags: ["Educación", "Cultura", "Juventud"],
    sortOrder: 40,
  },
  {
    name: "SECRETARÍA MUNICIPAL DE DESARROLLO HUMANO Y SOCIAL INTEGRAL",
    categorySlug: "secretarias-municipales",
    tags: ["Social", "Atención ciudadana", "Género"],
    sortOrder: 50,
  },
  {
    name: "SECRETARÍA MUNICIPAL DE SEGURIDAD CIUDADANA",
    categorySlug: "secretarias-municipales",
    tags: ["Seguridad", "Emergencias", "Prevención"],
    sortOrder: 60,
  },
  {
    name: "SECRETARÍA MUNICIPAL DE SALUD",
    categorySlug: "secretarias-municipales",
    tags: ["Salud", "Atención ciudadana", "Epidemiología"],
    sortOrder: 70,
  },
  {
    name: "SECRETARÍA MUNICIPAL DE INFRAESTRUCTURA PÚBLICA",
    categorySlug: "secretarias-municipales",
    tags: ["Infraestructura", "Obras", "Supervisión"],
    sortOrder: 80,
  },
  {
    name: "SECRETARÍA MUNICIPAL DE AGUA, SANEAMIENTO, GESTIÓN AMBIENTAL Y RIESGOS",
    categorySlug: "secretarias-municipales",
    tags: ["Servicios básicos", "Ambiente", "Riesgos"],
    sortOrder: 90,
  },
  {
    name: "SECRETARÍA MUNICIPAL DE DESARROLLO ECONÓMICO",
    categorySlug: "secretarias-municipales",
    tags: ["Economía", "Emprendimiento", "Mercados"],
    sortOrder: 100,
  },
];

/** Catálogo oficial: nombres de unidad en orden institucional. */
export const SECRETARIA_CATALOG: string[] = ORG_UNIT_SEEDS.map((unit) => unit.name);

export const SECRETARIA_TAG_KEY = "secretaria";
export const UNTAGGED_SECRETARIA_ID = "_sin_secretaria";
export const UNTAGGED_SECRETARIA_NAME = "Sin secretaría asignada";

/** Etiquetas máximas por unidad y longitud de cada etiqueta (validación UI/API). */
export const MAX_UNIT_TAGS = 12;
export const MAX_UNIT_TAG_LENGTH = 40;

/**
 * Etiquetas históricas o libres que se agrupan bajo un nombre del catálogo
 * (datos registrados antes de existir el catálogo oficial).
 */
export const SECRETARIA_ALIASES: Record<string, string> = {
  hacienda: "SECRETARÍA MUNICIPAL DE ADMINISTRACIÓN Y FINANZAS",
  "secretaria de hacienda": "SECRETARÍA MUNICIPAL DE ADMINISTRACIÓN Y FINANZAS",
};

/** Clave de comparación: mayúsculas, sin acentos, sin símbolos. */
export function normalizedSecretariaKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Clave de etiqueta normalizada para tolerar mayúsculas y acentos. */
export function normalizedTagKey(key: string): string {
  return key.trim().toLowerCase().replace(/í/g, "i");
}

/** Convierte un nombre en slug estable para una categoría. */
export function slugifyOrgCategory(value: string): string {
  return normalizedSecretariaKey(value).toLowerCase().replace(/\s+/g, "-");
}

/**
 * Normaliza una lista de etiquetas: recorta, descarta vacías, elimina
 * duplicados sin distinguir mayúsculas/acentos y limita cantidad/longitud.
 */
export function normalizeOrgTags(tags: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of tags) {
    if (typeof raw !== "string") continue;
    const tag = raw.trim().replace(/\s+/g, " ");
    if (!tag || tag.length > MAX_UNIT_TAG_LENGTH) continue;
    const key = normalizedSecretariaKey(tag);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length >= MAX_UNIT_TAGS) break;
  }

  return result;
}

/**
 * Índice de unidades por clave normalizada, incluyendo alias históricos.
 * Permite resolver el valor de la etiqueta `secretaria` de un servidor.
 */
export function buildOrgUnitIndex<T extends { name: string }>(units: readonly T[]): Map<string, T> {
  const index = new Map<string, T>();

  for (const unit of units) {
    index.set(normalizedSecretariaKey(unit.name), unit);
  }

  for (const [alias, target] of Object.entries(SECRETARIA_ALIASES)) {
    const targetUnit = index.get(normalizedSecretariaKey(target));
    if (targetUnit) {
      index.set(normalizedSecretariaKey(alias), targetUnit);
    }
  }

  return index;
}

/** Resuelve un valor de etiqueta `secretaria` contra una lista de unidades. */
export function resolveOrgUnit<T extends { name: string }>(
  units: readonly T[],
  value: string
): T | null {
  return buildOrgUnitIndex(units).get(normalizedSecretariaKey(value)) ?? null;
}
