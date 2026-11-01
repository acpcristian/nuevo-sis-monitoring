export type IncidentStatus = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";

export type IncidentPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type IncidentCategory =
  | "INCIDENT_CRITICAL"
  | "INCIDENT_MAJOR"
  | "INCIDENT_MINOR"
  | "INCIDENT_MAINTENANCE";

export interface IncidentEntity {
  id: string;
  title: string;
  description: string;
  category: IncidentCategory;
  priority: IncidentPriority;
  status: IncidentStatus;
  serverId?: string | null;
  eventId?: string | null;
  assignedTo?: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date | null;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  slaTimeout?: number | null;
  slaMet?: boolean | null;
  assignedAt?: Date | null;
  closedBy?: string | null;
  details?: Record<string, unknown> | null;
}