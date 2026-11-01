import { prisma } from "@/infrastructure/db/prisma";
import { CreateServerInput } from "@/shared/validations/server.schema";
import { ConflictError, NotFoundError } from "@/shared/errors/domain-errors";
import { SecretVault } from "@/infrastructure/crypto/secret-vault";
import { SshProbe } from "@/infrastructure/network/ssh-probe";
import { WinrmProbe } from "@/infrastructure/network/winrm-probe";
import { AuditService } from "./audit.service";
import { HealthStatus, CheckResultStatus } from "../domain/server.types";

export class ServerService {
  /**
   * Crea un nuevo servidor en el inventario con cifrado de secretos en reposo,
   * sondeo de conectividad no intrusivo y registro de auditoría inmutable.
   */
  public static async createServer(input: CreateServerInput, userId: string, userIp?: string) {
    // 1. Verificar unicidad de nombre (FR-001)
    const existing = await prisma.server.findUnique({
      where: { name: input.name },
    });
    if (existing) {
      throw new ConflictError(`Ya existe un servidor registrado con el nombre '${input.name}'.`);
    }

    // 2. Cifrar credencial si fue proporcionada (Principio III)
    let encryptedSecretData = null;
    if (input.credential) {
      encryptedSecretData = SecretVault.encryptSecret(input.credential.secretValue);
    }

    // 3. Crear registro en base de datos con transacción atómica
    const newServer = await prisma.$transaction(async (tx) => {
      const server = await tx.server.create({
        data: {
          name: input.name,
          ipAddress: input.ipAddress,
          hostname: input.hostname,
          osType: input.osType,
          osVersion: input.osVersion,
          environment: input.environment,
          connectionPort: input.connectionPort,
          technicalOwner: input.technicalOwner,
          description: input.description,
          lifecycleState: "ACTIVE",
          healthStatus: "PENDING",
        },
      });

      // Crear credencial cifrada
      if (input.credential && encryptedSecretData) {
        await tx.serverCredential.create({
          data: {
            serverId: server.id,
            credentialType: input.credential.credentialType,
            username: input.credential.username,
            encryptedPayload: encryptedSecretData.encryptedPayload,
            iv: encryptedSecretData.iv,
            authTag: encryptedSecretData.authTag,
            keyFingerprint: encryptedSecretData.keyFingerprint,
          },
        });
      }

      // Asociar etiquetas
      if (input.tags && input.tags.length > 0) {
        for (const tagInput of input.tags) {
          const tag = await tx.tag.upsert({
            where: { key_value: { key: tagInput.key, value: tagInput.value } },
            update: {},
            create: { key: tagInput.key, value: tagInput.value },
          });

          await tx.serverTag.create({
            data: {
              serverId: server.id,
              tagId: tag.id,
            },
          });
        }
      }

      return server;
    });

    // 4. Ejecutar sondeo no intrusivo inicial (solo lectura, timeout 5s)
    let probeResult = null;
    let computedHealth: HealthStatus = "PENDING";

    try {
      if (input.credential && input.osType === "LINUX" && input.credential.credentialType === "SSH_KEY") {
        probeResult = await SshProbe.probe({
          host: input.ipAddress,
          port: input.connectionPort || 22,
          username: input.credential.username,
          privateKey: input.credential.secretValue,
          passphrase: input.credential.passphrase,
          timeoutMs: 5000,
        });
      } else if (input.osType === "WINDOWS") {
        probeResult = await WinrmProbe.probe({
          host: input.ipAddress,
          port: input.connectionPort || 5986,
          timeoutMs: 5000,
        });
      }

      if (probeResult) {
        if (probeResult.status === "SUCCESS") {
          computedHealth = probeResult.durationMs >= 3000 ? "DEGRADED" : "ONLINE";
        } else if (probeResult.status === "TIMEOUT" || probeResult.status === "REFUSED") {
          computedHealth = "UNREACHABLE";
        } else if (probeResult.status === "AUTH_ERROR") {
          computedHealth = "AUTH_FAILED";
        } else {
          computedHealth = "UNREACHABLE";
        }

        // Registrar resultado de sondeo y actualizar salud del servidor
        await prisma.connectivityCheck.create({
          data: {
            serverId: newServer.id,
            durationMs: probeResult.durationMs,
            resultStatus: probeResult.status as CheckResultStatus,
            diagnosticSummary: probeResult.diagnosticSummary,
          },
        });

        await prisma.server.update({
          where: { id: newServer.id },
          data: {
            healthStatus: computedHealth,
            lastCheckedAt: new Date(),
            lastSeenAt: computedHealth === "ONLINE" || computedHealth === "DEGRADED" ? new Date() : undefined,
          },
        });
      }
    } catch (e) {
      console.error("Error en sondeo inicial no intrusivo:", e);
    }

    // 5. Emitir registro de auditoría (Principio VI)
    await AuditService.recordEvent({
      userId,
      action: "SERVER_CREATED",
      targetServerId: newServer.id,
      detailsDiff: {
        name: input.name,
        ipAddress: input.ipAddress,
        osType: input.osType,
        environment: input.environment,
        hasCredential: !!input.credential,
        initialHealth: computedHealth,
      },
      ipAddress: userIp,
    });

    // 6. Retornar servidor actualizado
    return prisma.server.findUniqueOrThrow({
      where: { id: newServer.id },
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
      },
    });
  }

  /**
   * Ejecuta una prueba de conectividad bajo demanda para un servidor existente.
   */
  public static async testConnection(serverId: string) {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
      include: { credential: true },
    });

    if (!server) {
      throw new NotFoundError("Servidor");
    }

    let probeResult;
    if (server.osType === "LINUX" && server.credential) {
      // Descifrar credencial solo en memoria para el handshake (Principio III)
      const decryptedSecret = SecretVault.decryptSecret(
        server.credential.encryptedPayload,
        server.credential.iv,
        server.credential.authTag
      );

      probeResult = await SshProbe.probe({
        host: server.ipAddress,
        port: server.connectionPort,
        username: server.credential.username,
        privateKey: server.credential.credentialType === "SSH_KEY" ? decryptedSecret : undefined,
        password: server.credential.credentialType === "PASSWORD" ? decryptedSecret : undefined,
        timeoutMs: 5000,
      });
    } else {
      probeResult = await WinrmProbe.probe({
        host: server.ipAddress,
        port: server.connectionPort,
        timeoutMs: 5000,
      });
    }

    let computedHealth: HealthStatus = "UNREACHABLE";
    if (probeResult.status === "SUCCESS") {
      computedHealth = probeResult.durationMs >= 3000 ? "DEGRADED" : "ONLINE";
    } else if (probeResult.status === "AUTH_ERROR") {
      computedHealth = "AUTH_FAILED";
    }

    // Persistir histórico de sondeo
    await prisma.connectivityCheck.create({
      data: {
        serverId: server.id,
        durationMs: probeResult.durationMs,
        resultStatus: probeResult.status,
        diagnosticSummary: probeResult.diagnosticSummary,
      },
    });

    // Actualizar estado si no está en mantenimiento o deshabilitado
    if (server.lifecycleState === "ACTIVE") {
      await prisma.server.update({
        where: { id: server.id },
        data: {
          healthStatus: computedHealth,
          lastCheckedAt: new Date(),
          lastSeenAt: computedHealth === "ONLINE" || computedHealth === "DEGRADED" ? new Date() : undefined,
        },
      });
    }

    return {
      serverId: server.id,
      status: probeResult.status,
      durationMs: probeResult.durationMs,
      diagnosticSummary: probeResult.diagnosticSummary,
      checkedAt: new Date(),
    };
  }
}

