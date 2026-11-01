export type UserRole = "SUPERADMIN" | "OBSERVADOR";

export type OsType = "LINUX" | "WINDOWS" | "OTHER";

export type Environment = "PROD" | "STAGING" | "DEV" | "QA";

export type LifecycleState = "ACTIVE" | "MAINTENANCE" | "DISABLED" | "RETIRED";

export type HealthStatus = "ONLINE" | "DEGRADED" | "UNREACHABLE" | "AUTH_FAILED" | "PENDING";

export type CredentialType = "SSH_KEY" | "PASSWORD" | "AGENT_TOKEN";

export type CheckResultStatus = "SUCCESS" | "TIMEOUT" | "REFUSED" | "AUTH_ERROR" | "ERROR";

export interface ServerTag {
  key: string;
  value: string;
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

