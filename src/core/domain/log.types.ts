export type LogCategory =
  | "SYS_KERNEL"
  | "AUTH_ACCESS"
  | "SSH_NETWORK"
  | "SYSTEM_SERVICE"
  | "WEB_APP"
  | "DATABASE"
  | "STORAGE_HW"
  | "BACKUP_TASK"
  | "SECURITY_AUDIT"
  | "AGENT_ERROR";

export type LogSeverity = "INFO" | "WARN" | "ERROR" | "CRITICAL";

export type FreshnessState = "FRESH" | "STALE" | "AGENT_DISCONNECTED" | "UNREACHABLE";

export type DiagnosisStatus = "DRAFT" | "FINAL" | "SUPERSEDED";

export type ConfidenceLevel = "LOW" | "MEDIUM" | "HIGH";

export type AlertStatus = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";

export interface LogCategoryInfo {
  code: LogCategory;
  name: string;
  description?: string | null;
  priority: number;
}

export interface LogEventInput {
  serverId?: string | null;
  category: LogCategory;
  eventTimestamp: Date;
  eventType?: string | null;
  severity: LogSeverity;
  message: string;
  rawLog?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface LogEventEntity {
  id: string;
  serverId: string | null;
  category: LogCategory;
  eventTimestamp: Date;
  ingestionTimestamp: Date;
  processedTimestamp?: Date | null;
  eventType: string | null;
  severity: LogSeverity;
  sanitizedMessage: string;
  rawLog: string;
  metadata: Record<string, unknown> | null;
  isUntrusted: boolean;
}

export interface IncidentDiagnosisInput {
  eventIds: string[];
  observedFacts: string;
  probableCause: string;
  evidenceSupport?: Record<string, unknown> | null;
  alternativeDiagnoses?: string | null;
  impactPotential?: string | null;
  verificationSteps?: string | null;
  remediationRecommendations?: string | null;
  confidenceLevel: ConfidenceLevel;
}

export interface IncidentDiagnosisEntity {
  id: string;
  generatedBy: string;
  generatedAt: Date;
  eventIds: string[];
  observedFacts: string;
  probableCause: string;
  evidenceSupport: Record<string, unknown>;
  alternativeDiagnoses: string | null;
  impactPotential: string | null;
  verificationSteps: string | null;
  remediationRecommendations: string | null;
  confidenceLevel: ConfidenceLevel;
  status: DiagnosisStatus;
}

export interface DataFreshnessStateEntity {
  id: string;
  serverId: string;
  freshnessState: FreshnessState;
  lastTelemetryAt?: Date | null;
  updatedAt: Date;
}

export interface LogAlertEntity {
  id: string;
  serverId: string | null;
  category: LogCategory | null;
  patternType: string;
  eventCount: number;
  windowStart: Date;
  windowEnd: Date;
  severity: LogSeverity;
  status: AlertStatus;
  acknowledgedBy: string | null;
  acknowledgedAt: Date | null;
}
