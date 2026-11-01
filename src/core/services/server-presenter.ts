import { UserRole } from "../domain/server.types";

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
}

export class ServerPresenter {
  /**
   * Sanitiza y estructura la entidad Servidor para su exposición en la API.
   * Garantiza que NINGÚN secreto en reposo o clave privada sea devuelta al cliente (Principio III).
   */
  public static toDto(server: RawServerWithRelations, _role: UserRole) {
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
    };
  }

  public static toListDto(servers: RawServerWithRelations[], role: UserRole) {
    return servers.map((s) => this.toDto(s, role));
  }
}

