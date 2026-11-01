import { prisma } from "@/infrastructure/db/prisma";
import { NotFoundError } from "@/shared/errors/domain-errors";

export type IncidentStatus = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type IncidentPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type IncidentCategory =
  | "INCIDENT_CRITICAL"
  | "INCIDENT_MAJOR"
  | "INCIDENT_MINOR"
  | "INCIDENT_MAINTENANCE";

export interface IncidentInput {
  title: string;
  description: string;
  category: IncidentCategory;
  priority: IncidentPriority;
  serverId?: string;
  eventId?: string;
  assignedTo?: string;
  slaTimeout?: number;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  category: IncidentCategory;
  priority: IncidentPriority;
  status: IncidentStatus;
  serverId?: string | null;
  eventId?: string | null;
  assignedTo?: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date | null;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  slaTimeout?: number | null;
  slaMet?: boolean | null;
  assignedAt?: Date | null;
  closedBy?: string | null;
  details?: Record<string, unknown> | null;
}

export interface ListIncidentsParams {
  status?: IncidentStatus;
  priority?: IncidentPriority;
  category?: IncidentCategory;
  serverId?: string;
  assignedTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export class IncidentService {
  /**
   * Crea un nuevo incidente.
   */
  public static async createIncident(input: IncidentInput, userId: string) {
    // Validar que el servidor existe si se proporciona
    if (input.serverId) {
      const server = await prisma.server.findUnique({
        where: { id: input.serverId },
      });
      if (!server) {
        throw new NotFoundError("Servidor");
      }
    }

    // Crear el incidente
    const incident = await prisma.incident.create({
      data: {
        title: input.title,
        description: input.description,
        category: input.category,
        priority: input.priority,
        status: "OPEN",
        serverId: input.serverId,
        eventId: input.eventId,
        assignedTo: input.assignedTo,
        slaTimeout: input.slaTimeout,
        createdBy: userId,
      },
      include: {
        server: {
          select: { id: true, name: true, hostname: true, healthStatus: true },
        },
      },
    });

    return {
      id: incident.id,
      title: incident.title,
      description: incident.description,
      category: incident.category,
      priority: incident.priority,
      status: incident.status,
      serverId: incident.serverId,
      eventId: incident.eventId,
      assignedTo: incident.assignedTo,
      createdAt: incident.createdAt,
      updatedAt: incident.updatedAt,
    };
  }

  /**
   * Obtiene un incidente por su ID.
   */
  public static async getIncidentById(id: string) {
    const incident = await prisma.incident.findUnique({
      where: { id },
      include: {
        server: {
          select: { id: true, name: true, hostname: true, healthStatus: true },
        },
      },
    });

    if (!incident) {
      throw new NotFoundError("Incidente");
    }

    return {
      id: incident.id,
      title: incident.title,
      description: incident.description,
      category: incident.category,
      priority: incident.priority,
      status: incident.status,
      serverId: incident.serverId,
      eventId: incident.eventId,
      assignedTo: incident.assignedTo,
      createdAt: incident.createdAt,
      updatedAt: incident.updatedAt,
      startedAt: incident.startedAt,
      resolvedAt: incident.resolvedAt,
      closedAt: incident.closedAt,
      slaTimeout: incident.slaTimeout,
      slaMet: incident.slaMet,
      assignedAt: incident.assignedAt,
      closedBy: incident.closedBy,
    };
  }

  /**
   * Lista incidentes con filtros multifactoriales.
   */
  public static async listIncidents(params: ListIncidentsParams) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (params.status) {
      where.status = params.status;
    }
    if (params.priority) {
      where.priority = params.priority;
    }
    if (params.category) {
      where.category = params.category;
    }
    if (params.serverId) {
      where.serverId = params.serverId;
    }
    if (params.assignedTo) {
      where.assignedTo = params.assignedTo;
    }
    if (params.search && params.search.trim().length > 0) {
      where.OR = [
        { title: { contains: params.search, mode: "insensitive" } },
        { description: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [total, items] = await Promise.all([
      prisma.incident.count({ where }),
      prisma.incident.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: "desc" }],
        include: {
          server: {
            select: { id: true, name: true, hostname: true, healthStatus: true },
          },
        },
      }),
    ]);

    return {
      items: items.map((inc) => ({
        id: inc.id,
        title: inc.title,
        description: inc.description,
        category: inc.category,
        priority: inc.priority,
        status: inc.status,
        serverId: inc.serverId,
        eventId: inc.eventId,
        assignedTo: inc.assignedTo,
        createdAt: inc.createdAt,
        updatedAt: inc.updatedAt,
        startedAt: inc.startedAt,
        resolvedAt: inc.resolvedAt,
        closedAt: inc.closedAt,
        slaTimeout: inc.slaTimeout,
        slaMet: inc.slaMet,
        assignedAt: inc.assignedAt,
        closedBy: inc.closedBy,
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Transiciona el estado de un incidente.
   * Máquina de estados: OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → CLOSED
   */
  public static async transitionState(
    id: string,
    newStatus: IncidentStatus,
    userId: string
  ) {
    const incident = await prisma.incident.findUnique({
      where: { id },
    });

    if (!incident) {
      throw new NotFoundError("Incidente");
    }

    // Validar transición válida
    const validTransitions: Record<IncidentStatus, IncidentStatus[]> = {
      OPEN: ["ASSIGNED", "CLOSED"],
      ASSIGNED: ["IN_PROGRESS", "OPEN", "CLOSED"],
      IN_PROGRESS: ["RESOLVED", "ASSIGNED", "OPEN"],
      RESOLVED: ["CLOSED"],
      CLOSED: [],
    };

    const allowedNextStates = validTransitions[incident.status];
    if (!allowedNextStates || !allowedNextStates.includes(newStatus)) {
      throw new Error(
        `Transición inválida de ${incident.status} a ${newStatus}`
      );
    }

    // Actualizar estado con marcas de tiempo
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updatedAt: new Date(),
    };

    if (newStatus === "ASSIGNED" && !incident.assignedAt) {
      updateData.assignedAt = new Date();
    }
    if (newStatus === "IN_PROGRESS" && !incident.startedAt) {
      updateData.startedAt = new Date();
    }
    if (newStatus === "RESOLVED" && !incident.resolvedAt) {
      updateData.resolvedAt = new Date();
    }
    if (newStatus === "CLOSED" && !incident.closedAt) {
      updateData.closedAt = new Date();
    }

    const updated = await prisma.incident.update({
      where: { id },
      data: updateData,
    });

    return {
      id: updated.id,
      title: updated.title,
      description: updated.description,
      category: updated.category,
      priority: updated.priority,
      status: updated.status,
      serverId: updated.serverId,
      eventId: updated.eventId,
      assignedTo: updated.assignedTo,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      startedAt: updated.startedAt,
      resolvedAt: updated.resolvedAt,
      closedAt: updated.closedAt,
    };
  }

  /**
   * Cierra un incidente.
   */
  public static async closeIncident(id: string, userId: string) {
    // Transitar a RESOLVED primero si no está ya
    const incident = await prisma.incident.findUnique({
      where: { id },
    });

    if (incident.status !== "RESOLVED" && incident.status !== "CLOSED") {
      await this.transitionState(id, "RESOLVED", userId);
    }

    // Luego cerrar
    const incidentNow = await prisma.incident.findUnique({
      where: { id },
    });

    const updated = await prisma.incident.update({
      where: { id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
      },
    });

    return {
      id: updated.id,
      title: updated.title,
      status: updated.status,
      closedAt: updated.closedAt,
    };
  }
}