export type UserRole = "SUPERADMIN" | "OBSERVADOR";

export type OsType = "LINUX" | "WINDOWS" | "OTHER";

export type Environment = "PROD" | "STAGING" | "DEV" | "QA";

export type LifecycleState = "ACTIVE" | "MAINTENANCE" | "DISABLED" | "RETIRED";

export type HealthStatus = "ONLINE" | "DEGRADED" | "UNREACHABLE" | "AUTH_FAILED" | "PENDING";

/**
 * Estado agregado que consume la UI del panel de servidores.
 * No reemplaza a `HealthStatus`: lo traduce a los tres semáforos del dashboard.
 */
export type GlobalServerStatus = "ONLINE" | "WARNING" | "OFFLINE" | "PENDING";

export type CredentialType = "SSH_KEY" | "PASSWORD" | "AGENT_TOKEN";

export type CheckResultStatus = "SUCCESS" | "TIMEOUT" | "REFUSED" | "AUTH_ERROR" | "ERROR";

export interface ServerTag {
  key: string;
  value: string;
}

/**
 * Deriva el semáforo global del servidor a partir de su salud de red y del
 * estado real de sus servicios. Es una función pura para poder probarla sin BD.
 *
 * Reglas:
 * - Un servidor fuera de ciclo ACTIVE no se monitorea (PENDING).
 * - UNREACHABLE/AUTH_FAILED => OFFLINE (rojo).
 * - DEGRADED o cualquier servicio que no esté RUNNING => WARNING (amarillo).
 * - Todo RUNNING y servidor ONLINE => ONLINE (verde).
 */
export function deriveGlobalStatus(input: {
  healthStatus: HealthStatus | string;
  lifecycleState?: LifecycleState | string;
  services?: Array<{ status: string }>;
}): GlobalServerStatus {
  const { healthStatus, lifecycleState, services = [] } = input;

  if (lifecycleState && lifecycleState !== "ACTIVE") {
    return "PENDING";
  }

  if (healthStatus === "UNREACHABLE" || healthStatus === "AUTH_FAILED") {
    return "OFFLINE";
  }

  if (healthStatus === "PENDING") {
    return "PENDING";
  }

  if (healthStatus === "DEGRADED") {
    return "WARNING";
  }

  if (services.some((service) => service.status !== "RUNNING")) {
    return "WARNING";
  }

  return "ONLINE";
}

export interface ManagedServer {
  id: string;
  name: string;
  ipAddress: string;
  hostname?: string | null;
  osType: OsType;
  osVersion?: string | null;
  environment: Environment;
  connectionPort: number;
  technicalOwner?: string | null;
  description?: string | null;
  lifecycleState: LifecycleState;
  healthStatus: HealthStatus;
  createdAt: Date;
  updatedAt: Date;
  lastCheckedAt?: Date | null;
  lastSeenAt?: Date | null;
  tags?: ServerTag[];
}

export interface CredentialSummary {
  type: CredentialType;
  username: string;
  keyFingerprint?: string | null;
  rotatedAt: Date;
}

