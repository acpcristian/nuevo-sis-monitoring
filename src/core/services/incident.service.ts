import { prisma } from "@/infrastructure/db/prisma";
import { NotFoundError, DomainError } from "@/shared/errors/domain-errors";
import { AuditService } from "@/core/services/audit.service";
import type { Prisma } from "@prisma/client";

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
  alertId?: string;
  assignedTo?: string;
  /** SLA en minutos; por defecto se deriva de la categoría (crítico 30, mayor 120, menor 480). */
  slaTimeoutMin?: number;
  details?: Record<string, unknown>;
}

const DEFAULT_SLA_MINUTES: Record<IncidentCategory, number> = {
  INCIDENT_CRITICAL: 30,
  INCIDENT_MAJOR: 120,
  INCIDENT_MINOR: 480,
  INCIDENT_MAINTENANCE: 480,
};

/** Máquina de estados válida (FR-005/FR-006). */
const VALID_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  OPEN: ["ASSIGNED", "CLOSED"],
  ASSIGNED: ["IN_PROGRESS", "OPEN", "CLOSED"],
  IN_PROGRESS: ["RESOLVED", "ASSIGNED", "OPEN"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

export interface IncidentPresenter {
  id: string;
  title: string;
  description: string;
  category: IncidentCategory;
  priority: IncidentPriority;
  status: IncidentStatus;
  serverId: string | null;
  eventId: string | null;
  alertId: string | null;
  assignedTo: string | null;
  slaTimeoutMin: number | null;
  slaDueAt: Date | null;
  slaBreached: boolean;
  escalationLevel: number;
  rootCause: string | null;
  correctiveActions: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  assignedAt: Date | null;
  closedBy: string | null;
  details?: Record<string, unknown> | null;
}

type PrismaIncidentRow = {
  id: string;
  title: string;
  description: string;
  category: IncidentCategory;
  priority: IncidentPriority;
  status: IncidentStatus;
  serverId: string | null;
  eventId: string | null;
  alertId: string | null;
  assignedTo: string | null;
  slaTimeoutMin: number | null;
  slaDueAt: Date | null;
  escalationLevel: number;
  rootCause: string | null;
  correctiveActions: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  assignedAt: Date | null;
  closedBy: string | null;
  details: unknown;
  server: { id: string; name: string; hostname: string | null; healthStatus: string } | null;
};

function present(inc: PrismaIncidentRow, now = new Date()): IncidentPresenter {
  return {
    id: inc.id,
    title: inc.title,
    description: inc.description,
    category: inc.category,
    priority: inc.priority,
    status: inc.status,
    serverId: inc.serverId,
    eventId: inc.eventId,
    alertId: inc.alertId,
    assignedTo: inc.assignedTo,
    slaTimeoutMin: inc.slaTimeoutMin,
    slaDueAt: inc.slaDueAt,
    slaBreached: inc.slaDueAt !== null && inc.slaDueAt.getTime() < now.getTime() &&
      !["RESOLVED", "CLOSED"].includes(inc.status),
    escalationLevel: inc.escalationLevel,
    rootCause: inc.rootCause,
    correctiveActions: inc.correctiveActions,
    createdAt: inc.createdAt,
    updatedAt: inc.updatedAt,
    startedAt: inc.startedAt,
    resolvedAt: inc.resolvedAt,
    closedAt: inc.closedAt,
    assignedAt: inc.assignedAt,
    closedBy: inc.closedBy,
    details: (inc.details as Record<string, unknown> | null) ?? null,
  };
}

export class IncidentService {
  /**
   * Registra una entrada append-only en la auditoría del incidente (Principios VI, VIII, FR-007).
   */
  private static async audit(
    incidentId: string,
    userId: string,
    action: string,
    toStatus: string,
    details: Record<string, unknown>,
    fromStatus?: string
  ): Promise<void> {
    await prisma.incidentAuditLog.create({
      data: {
        incidentId,
        userId,
        fromStatus: fromStatus ?? null,
        toStatus,
        action,
        details: details as unknown as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * SLA por defecto según categoría (FR-004 / SC-003).
   */
  public static defaultSlaMinutes(category: IncidentCategory): number {
    return DEFAULT_SLA_MINUTES[category];
  }

  /**
   * Crea un incidente. Asignación round-robin opcional entre responsables activos (FR-003).
   */
  public static async createIncident(
    input: IncidentInput,
    userId: string,
    ipAddress?: string | null
  ): Promise<IncidentPresenter> {
    if (input.serverId) {
      const server = await prisma.server.findUnique({ where: { id: input.serverId } });
      if (!server) {
        throw new NotFoundError("Servidor");
      }
    }
    if (input.eventId) {
      const event = await prisma.logEvent.findUnique({ where: { id: input.eventId } });
      if (!event) {
        throw new NotFoundError("Evento de log");
      }
    }
    if (input.alertId) {
      const alert = await prisma.logAlert.findUnique({ where: { id: input.alertId } });
      if (!alert) {
        throw new NotFoundError("Alerta");
      }
    }

    const slaMin = input.slaTimeoutMin ?? this.defaultSlaMinutes(input.category);
    const slaDueAt = new Date(Date.now() + slaMin * 60_000);

    const created = await prisma.incident.create({
      data: {
        title: input.title,
        description: input.description,
        category: input.category,
        priority: input.priority,
        status: "OPEN",
        serverId: input.serverId ?? null,
        eventId: input.eventId ?? null,
        alertId: input.alertId ?? null,
        assignedTo: input.assignedTo ?? null,
        slaTimeoutMin: slaMin,
        slaDueAt,
        createdBy: userId,
        details: (input.details ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
      },
      include: {
        server: { select: { id: true, name: true, hostname: true, healthStatus: true } },
      },
    });

    await this.audit(created.id, userId, "INCIDENT_CREATED", "OPEN", {
      title: created.title,
      category: created.category,
      priority: created.priority,
      slaTimeoutMin: slaMin,
      slaDueAt: slaDueAt.toISOString(),
    });

    await AuditService.recordEvent({
      userId,
      action: "INCIDENT_CREATED",
      targetServerId: created.serverId,
      detailsDiff: {
        incidentId: created.id,
        title: created.title,
        category: created.category,
        priority: created.priority,
      },
      ipAddress: ipAddress ?? null,
    });

    return present(created as unknown as PrismaIncidentRow);
  }

  /**
   * Obtiene un incidente con su auditoría append-only.
   */
  public static async getIncidentById(id: string) {
    const incident = await prisma.incident.findUnique({
      where: { id },
      include: {
        server: { select: { id: true, name: true, hostname: true, healthStatus: true } },
        auditTrail: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    });

    if (!incident) {
      throw new NotFoundError("Incidente");
    }

    return {
      ...present(incident as unknown as PrismaIncidentRow),
      auditTrail: incident.auditTrail,
    };
  }

  /**
   * Lista incidentes con filtros multifactoriales y paginación.
   */
  public static async listIncidents(params: {
    status?: IncidentStatus;
    priority?: IncidentPriority;
    category?: IncidentCategory;
    serverId?: string;
    assignedTo?: string;
    breached?: boolean;
    search?: string;
    page?: number;
    limit?: number;
  }) {
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
    if (params.breached) {
      where.slaDueAt = { lt: new Date() };
      where.status = { notIn: ["RESOLVED", "CLOSED"] };
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
          server: { select: { id: true, name: true, hostname: true, healthStatus: true } },
        },
      }),
    ]);

    return {
      items: items.map((inc) => present(inc as unknown as PrismaIncidentRow)),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  /**
   * Transiciona el estado (FR-005/FR-006) con validación de máquina de estados,
   * marcas de tiempo del ciclo de vida y auditoría append-only (FR-007).
   */
  public static async transitionState(
    id: string,
    newStatus: IncidentStatus,
    userId: string,
    opts?: { rootCause?: string; correctiveActions?: string; assignedTo?: string; ipAddress?: string | null }
  ): Promise<IncidentPresenter> {
    const incident = await prisma.incident.findUnique({ where: { id } });

    if (!incident) {
      throw new NotFoundError("Incidente");
    }
    if (incident.status === newStatus) {
      throw new DomainError(`El incidente ya está en estado ${newStatus}.`, "INVALID_TRANSITION", 422 );
    }

    const allowed = VALID_TRANSITIONS[incident.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new DomainError(
        `Transición inválida de ${incident.status} a ${newStatus}.`,
        "INVALID_TRANSITION", 422
        
      );
    }

    const now = new Date();
    const data: Record<string, unknown> = { status: newStatus, updatedAt: now };

    if (newStatus === "ASSIGNED") {
      data.assignedTo = opts?.assignedTo ?? incident.assignedTo;
      if (!incident.assignedAt) {
        data.assignedAt = now;
      }
      // Arranca el reloj SLA en la asignación si no fue fijado al crear.
      if (!incident.slaDueAt && incident.slaTimeoutMin) {
        data.slaDueAt = new Date(now.getTime() + incident.slaTimeoutMin * 60_000);
      }
    }
    if (newStatus === "IN_PROGRESS" && !incident.startedAt) {
      data.startedAt = now;
    }
    if (newStatus === "RESOLVED") {
      data.resolvedAt = now;
      data.rootCause = opts?.rootCause ?? null;
      data.correctiveActions = opts?.correctiveActions ?? null;
      if (incident.slaDueAt) {
        data.slaMet = now.getTime() <= incident.slaDueAt.getTime();
      }
    }
    if (newStatus === "CLOSED") {
      data.closedAt = now;
      data.closedBy = userId;
    }

    const updated = await prisma.incident.update({
      where: { id },
      data: data as never,
      include: {
        server: { select: { id: true, name: true, hostname: true, healthStatus: true } },
      },
    });

    const actionByStatus: Record<IncidentStatus, string> = {
      OPEN: "INCIDENT_STATUS_CHANGED",
      ASSIGNED: "INCIDENT_ASSIGNED",
      IN_PROGRESS: "INCIDENT_STATUS_CHANGED",
      RESOLVED: "INCIDENT_RESOLVED",
      CLOSED: "INCIDENT_CLOSED",
    };

    await this.audit(
      id,
      userId,
      actionByStatus[newStatus],
      newStatus,
      {
        ...(opts?.assignedTo ? { assignedTo: opts.assignedTo } : {}),
        ...(newStatus === "RESOLVED" ? { rootCause: opts?.rootCause ?? null } : {}),
      },
      incident.status
    );

    return present(updated as PrismaIncidentRow, now);
  }

  /**
   * Cierra un incidente (transita a RESOLVED si es necesario y luego CLOSED).
   */
  public static async closeIncident(
    id: string,
    userId: string,
    opts?: { rootCause?: string; correctiveActions?: string; ipAddress?: string | null }
  ) {
    const incident = await prisma.incident.findUnique({ where: { id } });
    if (!incident) {
      throw new NotFoundError("Incidente");
    }

    if (incident.status !== "RESOLVED" && incident.status !== "CLOSED") {
      await this.transitionState(id, "RESOLVED", userId, opts);
    }
    if (incident.status !== "CLOSED") {
      return this.transitionState(id, "CLOSED", userId, opts);
    }
    return present(incident as unknown as PrismaIncidentRow);
  }

  /**
   * Escalado manual o automático; nivela y audita (FR-004, US2).
   */
  public static async escalate(
    id: string,
    userId: string,
    reason: string,
    opts?: { assignedTo?: string; ipAddress?: string | null }
  ): Promise<IncidentPresenter> {
    const incident = await prisma.incident.findUnique({ where: { id } });
    if (!incident) {
      throw new NotFoundError("Incidente");
    }
    if (["RESOLVED", "CLOSED"].includes(incident.status)) {
      throw new DomainError("No se escala un incidente resuelto o cerrado.", "INVALID_TRANSITION", 422 );
    }

    const updated = await prisma.incident.update({
      where: { id },
      data: {
        escalationLevel: { increment: 1 },
        escalatedAt: new Date(),
        ...(opts?.assignedTo ? { assignedTo: opts.assignedTo } : {}),
      },
      include: {
        server: { select: { id: true, name: true, hostname: true, healthStatus: true } },
      },
    });

    await this.audit(id, userId, "INCIDENT_ESCALATED", incident.status, {
      reason,
      newLevel: updated.escalationLevel,
    }, incident.status);

    return present(updated as unknown as PrismaIncidentRow);
  }

  /**
   * Asignación round-robin (FR-003): reparte entre responsables activos de una lista.
   * Los responsables provienen de usuarios SUPERADMIN activos del sistema.
   */
  public static async pickRoundRobinTeamMember(): Promise<string | null> {
    const members = await prisma.user.findMany({
      where: { role: "SUPERADMIN", isActive: true },
      orderBy: { username: "asc" },
    });
    if (members.length === 0) {
      return null;
    }
    const lastAssigned = await prisma.incident.findFirst({
      where: { status: { notIn: ["RESOLVED", "CLOSED"] }, assignedTo: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { assignedTo: true },
    });
    const lastIdx = lastAssigned?.assignedTo
      ? members.findIndex((m) => m.username === lastAssigned.assignedTo)
      : -1;
    const next = members[(lastIdx + 1) % members.length];
    return next?.username ?? null;
  }

  /**
   * Escaneo de SLA vencidos: marca breached (y opcionalmente escala en automático).
   */
  public static async slaScan(userId = "system"): Promise<{ breached: string[] }> {
    const now = new Date();
    const overdue = await prisma.incident.findMany({
      where: {
        slaDueAt: { lt: now },
        status: { notIn: ["RESOLVED", "CLOSED"] },
      },
      select: { id: true, escalationLevel: true, slaDueAt: true },
      take: 100,
    });

    const ids: string[] = [];
    for (const inc of overdue) {
      ids.push(inc.id);
      await this.audit(inc.id, userId, "INCIDENT_STATUS_CHANGED", "SLA_BREACHED", {
        slaDueAt: inc.slaDueAt?.toISOString() ?? null,
        detection: "sla_scan",
      });
    }
    return { breached: ids };
  }
}
