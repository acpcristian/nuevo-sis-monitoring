import type { GlobalServerStatus } from "@/core/domain/server.types";

/**
 * Forma que devuelve GET /api/v1/servers y que consumen la grilla y la tabla.
 * `globalStatus` y los conteos son opcionales para tolerar respuestas antiguas.
 */
export interface ServerListItem {
  id: string;
  name: string;
  ipAddress: string;
  hostname?: string | null;
  osType: "LINUX" | "WINDOWS" | "OTHER" | string;
  osVersion?: string | null;
  environment: "PROD" | "STAGING" | "DEV" | "QA" | string;
  connectionPort: number;
  lifecycleState: "ACTIVE" | "MAINTENANCE" | "DISABLED" | "RETIRED" | string;
  healthStatus: "ONLINE" | "DEGRADED" | "UNREACHABLE" | "AUTH_FAILED" | "PENDING" | string;
  hasCredential: boolean;
  lastCheckedAt?: string | null;
  tags?: Array<{ key: string; value: string }>;
  globalStatus?: GlobalServerStatus;
  serviceCount?: number;
  servicesRunning?: number;
  servicesDown?: number;
  servicesUnknown?: number;
}
