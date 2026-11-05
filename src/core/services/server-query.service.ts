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
  total: number;
  ok: number;
  warn: number;
  down: number;
  serverIds: string[];
}

export const SECRETARIA_TAG_KEY = "secretaria";
export const UNTAGGED_SECRETARIA_ID = "_sin_secretaria";
export const UNTAGGED_SECRETARIA_NAME = "Sin secretaría asignada";

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

      let group = groups.get(groupId);
      if (!group) {
        group = { id: groupId, name, total: 0, ok: 0, warn: 0, down: 0, serverIds: [] };
        groups.set(groupId, group);
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

    return Array.from(groups.values()).sort((a, b) => {
      if (a.id === UNTAGGED_SECRETARIA_ID) return 1;
      if (b.id === UNTAGGED_SECRETARIA_ID) return -1;
      return a.name.localeCompare(b.name, "es");
    });
  }
}

