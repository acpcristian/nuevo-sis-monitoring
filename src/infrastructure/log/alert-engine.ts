/**
 * Motor de detección de patrones anómalos y deduplicación de alertas.
 *
 * Implementa el Principio VIII (Alertas Útiles y Gestión del Ciclo de Incidente):
 * - Deduplicación por tormenta de eventos (server + category + pattern).
 * - Correlación temporal para eventos concurrentes.
 * - Control de frecuencia (anti-flapping): una tormenta genera una única alerta agrupada.
 */

import { prisma } from "@/infrastructure/db/prisma";
import { AuditService } from "@/core/services/audit.service";
import type { Prisma, LogCategory } from "@prisma/client";

export interface AlertPatternInput {
  serverId?: string | null;
  category?: LogCategory | null;
  patternType: string;
  severity: "INFO" | "WARN" | "ERROR" | "CRITICAL";
  windowStart: Date;
  windowEnd: Date;
  eventCount: number;
}

export interface AlertMergeResult {
  alertId: string;
  eventCount: number;
  wasMerged: boolean;
}

export interface LogCategoryInfo {
  code: LogCategory;
  name: string;
  description?: string | null;
  priority: number;
}

/**
 * Devuelve la información de una categoría de log (nombre, descripción, prioridad).
 */
export function getCategoryInfo(category: LogCategory): LogCategoryInfo {
  const infoMap: Record<LogCategory, LogCategoryInfo> = {
    SYS_KERNEL: {
      code: "SYS_KERNEL",
      name: "Sistema operativo y kernel",
      description: "Eventos del núcleo del sistema operativo, panics, fallos de página, arranque y apagado.",
      priority: 3,
    },
    AUTH_ACCESS: {
      code: "AUTH_ACCESS",
      name: "Autenticación, sesiones y accesos",
      description: "Eventos de inicio de sesión, autenticación, sesiones SSH, credenciales y PAM.",
      priority: 2,
    },
    SSH_NETWORK: {
      code: "SSH_NETWORK",
      name: "SSH y conectividad de red",
      description: "Conexiones SSH, tiempo de espera, puertos rechazados, resolución DNS.",
      priority: 3,
    },
    SYSTEM_SERVICE: {
      code: "SYSTEM_SERVICE",
      description: "Servicios del sistema, demonios, procesos, systemd.",
      name: "Servicios del sistema y procesos",
      priority: 4,
    },
    WEB_APP: {
      code: "WEB_APP",
      name: "Aplicaciones y servidores web",
      description: "Servidores HTTP (nginx, Apache, IIS), solicitudes, respuestas, endpoints.",
      priority: 4,
    },
    DATABASE: {
      code: "DATABASE",
      name: "Motores de bases de datos",
      description: "Consultas SQL, conexiones, bloqueos, transacciones, motores de BD.",
      priority: 2,
    },
    STORAGE_HW: {
      code: "STORAGE_HW",
      name: "Almacenamiento, sistemas de archivos y hardware",
      description: "Discos, particiones, sistemas de archivos, errores I/O, SMART.",
      priority: 4,
    },
    BACKUP_TASK: {
      code: "BACKUP_TASK",
      name: "Copias de seguridad y tareas programadas",
      description: "Backups, restauraciones, snapshots, retención, archivos.",
      priority: 5,
    },
    SECURITY_AUDIT: {
      code: "SECURITY_AUDIT",
      name: "Seguridad, auditoría y eventos sospechosos",
      description: "Alertas de seguridad, intrusiones, acceso denegado, fuerza bruta.",
      priority: 1,
    },
    AGENT_ERROR: {
      code: "AGENT_ERROR",
      name: "Errores de agentes, conectividad y canal de telemetría",
      description: "Errores de agentes de telemetría, canal de ingestión, latidos, datos caducos.",
      priority: 5,
    },
  };

  return infoMap[category];
}

/**
 * Agrupa un lote de eventos idénticos en una alerta deduplicada.
 * Si ya existe una alerta ACTIVA con el mismo server+category+pattern y
 * ventanas solapadas, incrementa su conteo y extiende la ventana.
 * Si no, crea una nueva alerta.
 */
export async function recordAlertPattern(
  input: AlertPatternInput,
  userId: string,
  userIp?: string
): Promise<AlertMergeResult> {
  const { serverId, category, patternType, severity, windowStart, windowEnd, eventCount } = input;

  // Buscar alerta activa con el mismo fingerprint y ventanas solapadas
  const existing = await prisma.logAlert.findFirst({
    where: {
      serverId: serverId ?? null,
      category: category ?? null,
      patternType,
      status: "ACTIVE",
      windowStart: { lte: windowEnd },
      windowEnd: { gte: windowStart },
    },
    orderBy: { windowStart: "desc" },
  });

  if (existing) {
    // Deduplicar: fusionar conteo y extender la ventana temporal
    const newCount = existing.eventCount + eventCount;
    const newWindowStart = existing.windowStart < windowStart ? existing.windowStart : windowStart;
    const newWindowEnd = existing.windowEnd > windowEnd ? existing.windowEnd : windowEnd;

    const updated = await prisma.logAlert.update({
      where: { id: existing.id },
      data: {
        eventCount: newCount,
        windowStart: newWindowStart,
        windowEnd: newWindowEnd,
        // La severidad se conserva como la más alta observada
        severity: severityRank(severity) > severityRank(existing.severity) ? severity : existing.severity,
      },
    });

    await AuditService.recordEvent({
      userId,
      action: "LOG_ALERT_MERGED",
      targetServerId: serverId ?? undefined,
      detailsDiff: {
        alertId: updated.id,
        patternType,
        mergedCount: eventCount,
        totalCount: newCount,
        windowStart: newWindowStart.toISOString(),
        windowEnd: newWindowEnd.toISOString(),
      },
      ipAddress: userIp,
    });

    return { alertId: updated.id, eventCount: newCount, wasMerged: true };
  }

  // Crear nueva alerta agrupada
  const created = await prisma.logAlert.create({
    data: {
      serverId: serverId ?? undefined,
      category: category ?? undefined,
      patternType,
      eventCount,
      windowStart,
      windowEnd,
      severity,
      status: "ACTIVE",
    },
  });

  await AuditService.recordEvent({
    userId,
    action: "LOG_ALERT_CREATED",
    targetServerId: serverId ?? undefined,
    detailsDiff: {
      alertId: created.id,
      patternType,
      eventCount,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      severity,
    },
    ipAddress: userIp,
  });

  return { alertId: created.id, eventCount, wasMerged: false };
}

function severityRank(s: "INFO" | "WARN" | "ERROR" | "CRITICAL"): number {
  switch (s) {
    case "CRITICAL":
      return 4;
    case "ERROR":
      return 3;
    case "WARN":
      return 2;
    case "INFO":
    default:
      return 1;
  }
}