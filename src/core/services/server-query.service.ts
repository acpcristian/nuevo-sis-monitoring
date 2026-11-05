import { prisma } from "@/infrastructure/db/prisma";
import { NotFoundError } from "@/shared/errors/domain-errors";
import { OsType, Environment, HealthStatus, LifecycleState } from "@prisma/client";
import { deriveGlobalStatus } from "@/core/domain/server.types";

export interface ListServersParams {
  environment?: Environment;
  osType?: OsType;
  healthStatus?: HealthStatus;
  lifecycleState?: LifecycleState;
  search?: string;
  /** Agrupa el listado por contenedor de secretaría (etiqueta `secretaria`). */
  secretaria?: string;
  page?: number;
  limit?: number;
}

/**
 * Grupo de secretaría: los servidores se asocian a la secretaría mediante la
 * etiqueta `secretaria` (la relación se mantiene por identificador del tag,
 * sin esquema nuevo). Los servidores sin esa etiqueta forman el grupo
 * especial `_sin_secretaria`.
 */
export interface SecretariaGroupItem {
  id: string; // valor del tag `secretaria` o "_sin_secretaria"
  name: string;
  /** Valores de etiqueta que pertenecen al grupo (nombre oficial + históricos). */
  names: string[];
  total: number;
  ok: number;
  warn: number;
  down: number;
  serverIds: string[];
}

export const SECRETARIA_TAG_KEY = "secretaria";
export const UNTAGGED_SECRETARIA_ID = "_sin_secretaria";
export const UNTAGGED_SECRETARIA_NAME = "Sin secretaría asignada";

/**
 * Catálogo oficial de Secretarías municipales de El Alto. Los contenedores se
 * muestran SIEMPRE con este orden institucional, incluso cuando aún no tienen
 * servidores asignados (conteos en 0). Editar esta lista = redeploy.
 */
export const SECRETARIA_CATALOG: string[] = [
  "SECRETARÍA MUNICIPAL DE GESTIÓN INSTITUCIONAL",
  "SECRETARÍA MUNICIPAL DE ADMINISTRACIÓN Y FINANZAS",
  "SECRETARÍA MUNICIPAL DE MOVILIDAD URBANA",
  "SECRETARÍA MUNICIPAL DE EDUCACIÓN Y CULTURA",
  "SECRETARÍA MUNICIPAL DE DESARROLLO HUMANO Y SOCIAL INTEGRAL",
  "SECRETARÍA MUNICIPAL DE SEGURIDAD CIUDADANA",
  "SECRETARÍA MUNICIPAL DE SALUD",
  "SECRETARÍA MUNICIPAL DE INFRAESTRUCTURA PÚBLICA",
  "SECRETARÍA MUNICIPAL DE AGUA, SANEAMIENTO, GESTIÓN AMBIENTAL Y RIESGOS",
  "SECRETARÍA MUNICIPAL DE DESARROLLO ECONÓMICO",
];

/**
 * Etiquetas históricas o libres que se agrupan bajo un nombre del catálogo
 * (datos registrados antes de existir el catálogo oficial).
 */
const SECRETARIA_ALIASES: Record<string, string> = {
  "hacienda": "SECRETARÍA MUNICIPAL DE ADMINISTRACIÓN Y FINANZAS",
  "secretaria de hacienda": "SECRETARÍA MUNICIPAL DE ADMINISTRACIÓN Y FINANZAS",
};

/** Clave de comparación: mayúsculas, sin acentos, sin símbolos. */
function normalizedSecretariaKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

/** Clave de etiqueta normalizada para tolerar mayúsculas y acentos. */
function normalizedTagKey(key: string): string {
  return key.trim().toLowerCase().replace(/í/g, "i");
}

export class ServerQueryService {
  /**
   * Consulta el catálogo de servidores con filtrado indexado en tiempo real y paginación.
   */
  public static async listServers(params: ListServersParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (params.environment) {
      where.environment = params.environment;
    }
    if (params.osType) {
      where.osType = params.osType;
    }
    if (params.healthStatus) {
      where.healthStatus = params.healthStatus;
    }
    if (params.lifecycleState) {
      where.lifecycleState = params.lifecycleState;
    }

    if (params.search && params.search.trim().length > 0) {
      const query = params.search.trim();
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { ipAddress: { contains: query } },
        { hostname: { contains: query, mode: "insensitive" } },
      ];
    }

    // Filtro por contenedor de secretaría (etiqueta `secretaria`).
    if (params.secretaria) {
      if (params.secretaria === UNTAGGED_SECRETARIA_ID) {
        where.tags = { none: { tag: { OR: [
          { key: { equals: SECRETARIA_TAG_KEY, mode: "insensitive" } },
          { key: { equals: "secretaría", mode: "insensitive" } },
        ] } } };
      } else {
        where.tags = { some: { tag: { AND: [
          { value: params.secretaria },
          { key: { OR: [
            { equals: SECRETARIA_TAG_KEY, mode: "insensitive" },
            { equals: "secretaría", mode: "insensitive" },
          ] } },
        ] } } };
      }
    }

    const [total, items] = await Promise.all([
      prisma.server.count({ where }),
      prisma.server.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ healthStatus: "asc" }, { updatedAt: "desc" }],
        include: {
          credential: {
            select: {
              credentialType: true,
              username: true,
              keyFingerprint: true,
              rotatedAt: true,
            },
          },
          tags: {
            include: { tag: true },
          },
          // Solo el estado: el panel necesita conteos sin descargar descripciones
          // ni endpoints de cada servicio.
          services: {
            select: { status: true },
          },
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Obtiene la ficha técnica completa de un servidor específico junto a sus últimos sondeos.
   */
  public static async getServerById(id: string) {
    const server = await prisma.server.findUnique({
      where: { id },
      include: {
        credential: {
          select: {
            credentialType: true,
            username: true,
            keyFingerprint: true,
            rotatedAt: true,
          },
        },
        tags: {
          include: { tag: true },
        },
        services: {
          select: { status: true },
        },
        checks: {
          orderBy: { eventTimestamp: "desc" },
          take: 10,
        },
      },
    });

    if (!server) {
      throw new NotFoundError("Servidor");
    }

    return server;
  }

  /**
   * Contenedores de Secretarías municipales: agrupa el catálogo visible
   * (servidores no retirados) por la etiqueta `secretaria` y entrega conteos
   * de estado con las mismas reglas del semáforo (`deriveGlobalStatus`).
   * Solo lectura; no muta el esquema (la relación vive en el tag).
   */
  public static async listSecretariaGroups(): Promise<SecretariaGroupItem[]> {
    const servers = await prisma.server.findMany({
      where: { lifecycleState: { not: "RETIRED" } },
      select: {
        id: true,
        healthStatus: true,
        lifecycleState: true,
        services: { select: { status: true } },
        tags: {
          include: { tag: { select: { key: true, value: true } } },
        },
      },
      orderBy: { name: "asc" },
    });

    const groups = new Map<string, SecretariaGroupItem>();

    for (const server of servers) {
      const secretariaTag = server.tags.find(
        (t) => normalizedTagKey(t.tag.key) === SECRETARIA_TAG_KEY && t.tag.value.trim().length > 0
      );
      const groupId = secretariaTag?.tag.value.trim() ?? UNTAGGED_SECRETARIA_ID;
      const name = secretariaTag?.tag.value.trim() ?? UNTAGGED_SECRETARIA_NAME;

      let group: SecretariaGroupItem | undefined = groups.get(groupId);
      if (!group) {
        const created: SecretariaGroupItem = { id: groupId, name, names: [name], total: 0, ok: 0, warn: 0, down: 0, serverIds: [] };
        groups.set(groupId, created);
        group = created;
      }

      const status = deriveGlobalStatus({
        healthStatus: server.healthStatus,
        lifecycleState: server.lifecycleState,
        services: server.services,
      });

      group.total += 1;
      if (status === "ONLINE") group.ok += 1;
      else if (status === "WARNING") group.warn += 1;
      else if (status === "OFFLINE") group.down += 1;
      group.serverIds.push(server.id);
    }

    // Fusión con el catálogo oficial: cada Secretaría del catálogo SIEMPRE
    // aparece (aunque no tenga servidores, con conteos en 0), los grupos
    // derivados de etiquetas se agrupan bajo el nombre oficial (directo o por
    // alias) y los nombres ajenos al catálogo quedan al final, aparte.
    const catalogKeys = new Map<string, { index: number; name: string }>();
    SECRETARIA_CATALOG.forEach((name, index) => {
      catalogKeys.set(normalizedSecretariaKey(name), { index, name });
    });

    interface MergedGroup extends SecretariaGroupItem {
      catalogIndex: number | null;
    }

    const merged = new Map<string, MergedGroup>();
    for (const catalogKey of catalogKeys.keys()) {
      const entry = catalogKeys.get(catalogKey)!;
      merged.set(catalogKey, {
        id: entry.name,
        name: entry.name,
        names: [entry.name],
        total: 0,
        ok: 0,
        warn: 0,
        down: 0,
        serverIds: [],
        catalogIndex: entry.index,
      });
    }

    for (const group of groups.values()) {
      if (group.id === UNTAGGED_SECRETARIA_ID) {
        merged.set(UNTAGGED_SECRETARIA_ID, { ...group, names: [UNTAGGED_SECRETARIA_NAME], catalogIndex: null });
        continue;
      }

      const key = normalizedSecretariaKey(group.id);
      const resolvedCatalogKey = catalogKeys.has(key)
        ? key
        : aliasCatalogKey(key) ?? null;
      const entry = resolvedCatalogKey ? catalogKeys.get(resolvedCatalogKey)! : null;

      const id = entry?.name ?? group.id;
      const mapKey = entry ? resolvedCatalogKey! : `EXTRA:${key}`;
      const existing = merged.get(mapKey);
      if (!existing) {
        merged.set(mapKey, {
          ...group,
          id,
          name: entry?.name ?? group.name,
          names: entry ? [entry.name, group.name] : [group.name],
          catalogIndex: entry?.index ?? null,
        });
      } else {
        existing.total += group.total;
        existing.ok += group.ok;
        existing.warn += group.warn;
        existing.down += group.down;
        existing.serverIds.push(...group.serverIds);
        if (!existing.names.includes(group.name)) existing.names.push(group.name);
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => {
        if (a.id === UNTAGGED_SECRETARIA_ID) return 1;
        if (b.id === UNTAGGED_SECRETARIA_ID) return -1;
        if (a.catalogIndex !== null && b.catalogIndex !== null) return a.catalogIndex - b.catalogIndex;
        if (a.catalogIndex !== null) return -1;
        if (b.catalogIndex !== null) return 1;
        return a.name.localeCompare(b.name, "es");
      })
      .map(({ catalogIndex: _catalogIndex, ...group }) => group);
  }
}

/**
 * Alias históricos → clave normalizada del catálogo (o null si no hay match).
 */
function aliasCatalogKey(aliasKey: string): string | null {
  for (const [alias, catalogName] of Object.entries(SECRETARIA_ALIASES)) {
    if (normalizedSecretariaKey(alias) === aliasKey) {
      return normalizedSecretariaKey(catalogName);
    }
  }
  return null;
}

