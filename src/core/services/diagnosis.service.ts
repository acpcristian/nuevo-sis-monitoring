import { prisma } from "@/infrastructure/db/prisma";
import { AuditService } from "./audit.service";
import { NotFoundError } from "@/shared/errors/domain-errors";
import { CreateDiagnosisInput } from "@/shared/validations/log.schema";
import { ConfidenceLevel, DiagnosisStatus } from "@/core/domain/log.types";
import type { Prisma } from "@prisma/client";

export class DiagnosisService {
  /**
   * Genera un diagnóstico estructurado de incidente basado en eventos de log
   * relacionados. Implementa el Principio VII (Análisis de Logs Responsable):
   * diferencia hechos de inferencias, exige evidencias de soporte verificables,
   * y no permite cerrar incidentes sin telemetría de recuperación.
   */
  public static async createDiagnosis(
    input: CreateDiagnosisInput,
    userId: string,
    userIp?: string
  ) {
    // 1. Verificar que todos los eventos de log existan
    const events = await prisma.logEvent.findMany({
      where: {
        id: { in: input.eventIds },
      },
    });

    if (events.length !== input.eventIds.length) {
      const foundIds = events.map((e) => e.id);
      const missingIds = input.eventIds.filter((id) => !foundIds.includes(id));
      throw new NotFoundError(
        `Eventos de log no encontrados: ${missingIds.join(", ")}`
      );
    }

    // 2. Crear el diagnóstico con todas las secciones obligatorias
    const diagnosis = await prisma.incidentDiagnosis.create({
      data: {
        generatedBy: userId,
        observedFacts: input.observedFacts,
        probableCause: input.probableCause,
        evidenceSupport: (input.evidenceSupport as Prisma.InputJsonValue | undefined) ?? {},
        alternativeDiagnoses: input.alternativeDiagnoses ?? undefined,
        impactPotential: input.impactPotential ?? undefined,
        verificationSteps: input.verificationSteps ?? undefined,
        remediationRecommendations: input.remediationRecommendations ?? undefined,
        confidenceLevel: input.confidenceLevel as ConfidenceLevel,
        status: "DRAFT" as DiagnosisStatus,
        events: {
          connect: input.eventIds.map((id) => ({ id })),
        },
      },
      include: {
        events: {
          select: {
            id: true,
            category: true,
            severity: true,
            eventTimestamp: true,
            sanitizedMessage: true,
          },
        },
      },
    });

    // 3. Emitir registro de auditoría (Principio VI)
    await AuditService.recordEvent({
      userId,
      action: "DIAGNOSIS_CREATED",
      targetServerId: events[0]?.serverId ?? undefined,
      detailsDiff: {
        diagnosisId: diagnosis.id,
        eventCount: input.eventIds.length,
        confidenceLevel: input.confidenceLevel,
        eventIds: input.eventIds,
      },
      ipAddress: userIp,
    });

    return {
      id: diagnosis.id,
      generatedBy: diagnosis.generatedBy,
      generatedAt: diagnosis.generatedAt,
      eventIds: input.eventIds,
      observedFacts: diagnosis.observedFacts,
      probableCause: diagnosis.probableCause,
      evidenceSupport: diagnosis.evidenceSupport as Record<string, unknown>,
      alternativeDiagnoses: diagnosis.alternativeDiagnoses,
      impactPotential: diagnosis.impactPotential,
      verificationSteps: diagnosis.verificationSteps,
      remediationRecommendations: diagnosis.remediationRecommendations,
      confidenceLevel: diagnosis.confidenceLevel as ConfidenceLevel,
      status: diagnosis.status as DiagnosisStatus,
      events: diagnosis.events.map((e) => ({
        id: e.id,
        category: (e.category as { code: string }).code,
        severity: e.severity as string,
        eventTimestamp: e.eventTimestamp,
        sanitizedMessage: e.sanitizedMessage,
      })),
    };
  }

  /**
   * Obtiene el detalle de un diagnóstico estructurado con sus eventos asociados.
   */
  public static async getDiagnosisById(id: string) {
    const diagnosis = await prisma.incidentDiagnosis.findUnique({
      where: { id },
      include: {
        events: {
          select: {
            id: true,
            category: true,
            severity: true,
            eventTimestamp: true,
            sanitizedMessage: true,
            server: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!diagnosis) {
      throw new NotFoundError("Diagnóstico");
    }

    return {
      id: diagnosis.id,
      generatedBy: diagnosis.generatedBy,
      generatedAt: diagnosis.generatedAt,
      eventIds: diagnosis.events.map((e) => e.id),
      observedFacts: diagnosis.observedFacts,
      probableCause: diagnosis.probableCause,
      evidenceSupport: diagnosis.evidenceSupport as Record<string, unknown>,
      alternativeDiagnoses: diagnosis.alternativeDiagnoses,
      impactPotential: diagnosis.impactPotential,
      verificationSteps: diagnosis.verificationSteps,
      remediationRecommendations: diagnosis.remediationRecommendations,
      confidenceLevel: diagnosis.confidenceLevel as ConfidenceLevel,
      status: diagnosis.status as DiagnosisStatus,
      events: diagnosis.events.map((e) => ({
        id: e.id,
        serverId: e.server?.id ?? null,
        serverName: e.server?.name ?? null,
        category: (e.category as { code: string }).code,
        severity: e.severity as string,
        eventTimestamp: e.eventTimestamp,
        sanitizedMessage: e.sanitizedMessage,
      })),
    };
  }

  /**
   * Lista diagnósticos con filtros opcionales.
   */
  public static async listDiagnoses(params?: {
    serverId?: string;
    status?: DiagnosisStatus;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params?.page || 1);
    const limit = Math.min(100, Math.max(1, params?.limit || 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (params?.status) {
      where.status = params.status;
    }

    // Filtrar por servidor a través de los eventos asociados
    if (params?.serverId) {
      where.events = {
        some: {
          serverId: params.serverId,
        },
      };
    }

    const [total, items] = await Promise.all([
      prisma.incidentDiagnosis.count({ where }),
      prisma.incidentDiagnosis.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ generatedAt: "desc" }],
        include: {
          events: {
            take: 5,
            orderBy: { eventTimestamp: "desc" },
            select: {
              id: true,
              category: true,
              severity: true,
              eventTimestamp: true,
            },
          },
        },
      }),
    ]);

    return {
      items: items.map((d) => ({
        id: d.id,
        generatedBy: d.generatedBy,
        generatedAt: d.generatedAt,
        eventCount: d.events.length,
        confidenceLevel: d.confidenceLevel as ConfidenceLevel,
        status: d.status as DiagnosisStatus,
        observedFacts: d.observedFacts.substring(0, 200) + "...",
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit) || 1,
    };
  }
}
