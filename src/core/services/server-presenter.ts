import { UserRole, deriveGlobalStatus } from "../domain/server.types";

export interface RawServerWithRelations {
  id: string;
  name: string;
  ipAddress: string;
  hostname?: string | null;
  osType: string;
  osVersion?: string | null;
  environment: string;
  connectionPort: number;
  technicalOwner?: string | null;
  description?: string | null;
  lifecycleState: string;
  healthStatus: string;
  createdAt: Date;
  updatedAt: Date;
  lastCheckedAt?: Date | null;
  lastSeenAt?: Date | null;
  credential?: {
    credentialType: string;
    username: string;
    keyFingerprint?: string | null;
    rotatedAt: Date;
  } | null;
  tags?: Array<{
    tag: {
      key: string;
      value: string;
    };
  }>;
  services?: Array<{ status: string }>;
}

export class ServerPresenter {
  /**
   * Sanitiza y estructura la entidad Servidor para su exposición en la API.
   * Garantiza que NINGÚN secreto en reposo o clave privada sea devuelta al cliente (Principio III).
   */
  public static toDto(server: RawServerWithRelations, _role: UserRole) {
    const services = server.services ?? [];
    const servicesRunning = services.filter((service) => service.status === "RUNNING").length;
    const servicesDown = services.filter(
      (service) => service.status === "STOPPED" || service.status === "ERROR"
    ).length;
    const servicesUnknown = services.filter((service) => service.status === "UNKNOWN").length;

    return {
      id: server.id,
      name: server.name,
      ipAddress: server.ipAddress,
      hostname: server.hostname,
      osType: server.osType,
      osVersion: server.osVersion,
      environment: server.environment,
      connectionPort: server.connectionPort,
      technicalOwner: server.technicalOwner,
      description: server.description,
      lifecycleState: server.lifecycleState,
      healthStatus: server.healthStatus,
      createdAt: server.createdAt,
      updatedAt: server.updatedAt,
      lastCheckedAt: server.lastCheckedAt,
      lastSeenAt: server.lastSeenAt,
      hasCredential: !!server.credential,
      credentialSummary: server.credential
        ? {
            type: server.credential.credentialType,
            username: server.credential.username,
            keyFingerprint: server.credential.keyFingerprint,
            lastRotatedAt: server.credential.rotatedAt,
          }
        : null,
      tags: server.tags ? server.tags.map((t) => ({ key: t.tag.key, value: t.tag.value })) : [],
      // Estado agregado para el semáforo del dashboard, sin alterar el enum de salud.
      globalStatus: deriveGlobalStatus({
        healthStatus: server.healthStatus,
        lifecycleState: server.lifecycleState,
        services,
      }),
      serviceCount: services.length,
      servicesRunning,
      servicesDown,
      servicesUnknown,
    };
  }

  public static toListDto(servers: RawServerWithRelations[], role: UserRole) {
    return servers.map((s) => this.toDto(s, role));
  }
}

