import { prisma } from "@/infrastructure/db/prisma";
import { NotFoundError } from "@/shared/errors/domain-errors";
import { OsType, Environment, HealthStatus, LifecycleState } from "@prisma/client";

export interface ListServersParams {
  environment?: Environment;
  osType?: OsType;
  healthStatus?: HealthStatus;
  lifecycleState?: LifecycleState;
  search?: string;
  page?: number;
  limit?: number;
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
}

