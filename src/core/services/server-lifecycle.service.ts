import { prisma } from "@/infrastructure/db/prisma";
import { NotFoundError } from "@/shared/errors/domain-errors";
import { LifecycleState } from "@prisma/client";
import { AuditService } from "./audit.service";

export class ServerLifecycleService {
  /**
   * Cambia el estado del ciclo de vida del servidor (ACTIVE, MAINTENANCE, DISABLED).
   * Al entrar en MAINTENANCE o DISABLED, se silencian alertas y sondeos automáticos (Principio VIII).
   */
  public static async changeLifecycleState(
    serverId: string,
    newState: LifecycleState,
    reason?: string,
    userId: string = "system",
    userIp?: string
  ) {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      throw new NotFoundError("Servidor");
    }

    const previousState = server.lifecycleState;

    const updated = await prisma.server.update({
      where: { id: serverId },
      data: {
        lifecycleState: newState,
        // Si sale de mantenimiento a ACTIVE, se deja en PENDING hasta el próximo sondeo
        healthStatus: newState === "ACTIVE" && previousState === "MAINTENANCE" ? "PENDING" : server.healthStatus,
      },
    });

    // Registrar en auditoría con motivo (FR-012)
    await AuditService.recordEvent({
      userId,
      action: "STATUS_CHANGED",
      targetServerId: serverId,
      detailsDiff: {
        previousState,
        newState,
        reason: reason || "Sin motivo especificado",
      },
      ipAddress: userIp,
    });

    return updated;
  }
}

