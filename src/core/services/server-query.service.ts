import { prisma } from "@/infrastructure/db/prisma";
import { NotFoundError } from "@/shared/errors/domain-errors";
import { OsType, Environment, HealthStatus, LifecycleState } from "@prisma/client";
import { deriveGlobalStatus } from "@/core/domain/server.types";
import {
  OrgTaxonomyService,
  type OrgUnitCategoryDto,
} from "@/core/services/org-taxonomy.service";
import {
  SECRETARIA_CATALOG,
  SECRETARIA_TAG_KEY,
  UNTAGGED_SECRETARIA_ID,
  UNTAGGED_SECRETARIA_NAME,
  buildOrgUnitIndex,
  normalizedSecretariaKey,
  normalizedTagKey,
} from "@/core/domain/org-taxonomy";

export {
  SECRETARIA_CATALOG,
  SECRETARIA_TAG_KEY,
  UNTAGGED_SECRETARIA_ID,
  UNTAGGED_SECRETARIA_NAME,
};

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
 *
 * La clasificación (categoría de entidad + etiquetas) viene del catálogo
 * editable `org_units` / `org_categories`.
 */
export interface SecretariaGroupItem {
  id: string; // valor canónico del tag `secretaria` o "_sin_secretaria"
  unitId: string | null; // id de la unidad en el catálogo (null = sin catálogo)
  name: string;
  /** Valores de etiqueta que pertenecen al grupo (nombre oficial + históricos). */
  names: string[];
  /** Categoría de entidad (Secretarías Municipales, Subalcaldías…). */
  category: OrgUnitCategoryDto | null;
  /** Etiquetas libres de la unidad (Finanzas, Salud, TI…). */
  tags: string[];
  sortOrder: number;
  total: number;
  ok: number;
  warn: number;
  down: number;
  serverIds: string[];
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
   * Contenedores organizacionales: agrupa los servidores visibles (no
   * retirados) por la etiqueta `secretaria` y los enriquece con la categoría y
   * las etiquetas del catálogo editable. Las unidades del catálogo siempre
   * aparecen (aunque tengan 0 servidores); los valores de etiqueta ajenos al
   * catálogo se muestran como grupos sin categoría.
   */
  public static async listSecretariaGroups(): Promise<SecretariaGroupItem[]> {
    const [units, servers] = await Promise.all([
      OrgTaxonomyService.listUnits(),
      prisma.server.findMany({
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
      }),
    ]);

    const unitIndex = buildOrgUnitIndex(units);
    const groups = new Map<string, SecretariaGroupItem>();

    // 1. Cada unidad del catálogo es un contenedor visible, incluso en 0.
    for (const unit of units) {
      groups.set(`UNIT:${unit.id}`, {
        id: unit.name,
        unitId: unit.id,
        name: unit.name,
        names: [unit.name],
        category: unit.category,
        tags: unit.tags,
        sortOrder: unit.sortOrder,
        total: 0,
        ok: 0,
        warn: 0,
        down: 0,
        serverIds: [],
      });
    }

    // 2. Suma de servidores al grupo que resuelve su etiqueta `secretaria`.
    for (const server of servers) {
      const rawValue =
        server.tags.find(
          (t) => normalizedTagKey(t.tag.key) === SECRETARIA_TAG_KEY && t.tag.value.trim().length > 0
        )?.tag.value.trim() ?? null;

      let group: SecretariaGroupItem;
      if (!rawValue) {
        const existing = groups.get(UNTAGGED_SECRETARIA_ID);
        if (existing) {
          group = existing;
        } else {
          group = {
            id: UNTAGGED_SECRETARIA_ID,
            unitId: null,
            name: UNTAGGED_SECRETARIA_NAME,
            names: [UNTAGGED_SECRETARIA_NAME],
            category: null,
            tags: [],
            sortOrder: Number.MAX_SAFE_INTEGER,
            total: 0,
            ok: 0,
            warn: 0,
            down: 0,
            serverIds: [],
          };
          groups.set(UNTAGGED_SECRETARIA_ID, group);
        }
      } else {
        const unit = unitIndex.get(normalizedSecretariaKey(rawValue)) ?? null;
        const key = unit ? `UNIT:${unit.id}` : `EXTRA:${normalizedSecretariaKey(rawValue)}`;
        const existing = groups.get(key);
        if (existing) {
          group = existing;
          if (!group.names.includes(rawValue)) group.names.push(rawValue);
        } else {
          group = {
            id: rawValue,
            unitId: null,
            name: rawValue,
            names: [rawValue],
            category: null,
            tags: [],
            sortOrder: Number.MAX_SAFE_INTEGER,
            total: 0,
            ok: 0,
            warn: 0,
            down: 0,
            serverIds: [],
          };
          groups.set(key, group);
        }
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

    // 3. Orden institucional: categoría → orden de la unidad → nombre; el
    //    grupo sin secretaría queda siempre al final.
    return Array.from(groups.values()).sort((a, b) => {
      if (a.id === UNTAGGED_SECRETARIA_ID) return 1;
      if (b.id === UNTAGGED_SECRETARIA_ID) return -1;
      const categoryA = a.category?.sortOrder ?? Number.MAX_SAFE_INTEGER;
      const categoryB = b.category?.sortOrder ?? Number.MAX_SAFE_INTEGER;
      if (categoryA !== categoryB) return categoryA - categoryB;
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name, "es");
    });
  }
}

