import { prisma } from "@/infrastructure/db/prisma";
import { NotFoundError, ValidationError } from "@/shared/errors/domain-errors";
import { AuditService } from "./audit.service";

export class ServerDecommissionService {
  /**
   * Ejecuta el retiro y desincorporación formal de un servidor del inventario (FR-014).
   * Purgado físico e irrecuperable de secretos en reposo (claves/passwords) y
   * conservación inmutable del historial de auditoría e incidentes (Principio VI y XIII).
   */
  public static async decommissionServer(
    serverId: string,
    confirmationName: string,
    userId: string,
    userIp?: string
  ) {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
    });

    if (!server) {
      throw new NotFoundError("Servidor");
    }

    if (server.name !== confirmationName) {
      throw new ValidationError("El nombre de confirmación no coincide exactamente con el nombre del servidor.");
    }

    // Transacción atómica: purga de credenciales + cambio a RETIRED
    await prisma.$transaction(async (tx) => {
      // 1. Purgar físicamente credenciales en reposo (Principio XIII)
      await tx.serverCredential.deleteMany({
        where: { serverId },
      });

      // 2. Marcar servidor como RETIRED
      await tx.server.update({
        where: { id: serverId },
        data: {
          lifecycleState: "RETIRED",
          healthStatus: "UNREACHABLE",
        },
      });
    });

    // 3. Registrar auditoría permanente
    await AuditService.recordEvent({
      userId,
      action: "SERVER_RETIRED",
      targetServerId: serverId,
      detailsDiff: {
        serverName: server.name,
        credentialsPurged: true,
        reason: "Desincorporación formal del inventario",
      },
      ipAddress: userIp,
    });

    return {
      serverId,
      serverName: server.name,
      status: "RETIRED",
      credentialsPurged: true,
    };
  }
}

