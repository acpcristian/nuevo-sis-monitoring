"use client";

/** Tipos compartidos de la sección Notificaciones (canal, entrega, categoría). */

export type ChannelType = "EMAIL" | "SLACK" | "WEBHOOK" | "PAGERDUTY";

export interface Channel {
  id: string;
  type: ChannelType;
  name: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  categories: string[];
  configSummary: Record<string, unknown> | null;
  lastTestAt: string | null;
  lastTestStatus: string | null;
  lastTestDetail: string | null;
  failureCount: number;
  lastFailureAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Delivery {
  id: string;
  channelId: string;
  channelName: string;
  title: string;
  severity: string;
  category: string | null;
  status: "SENT" | "FAILED" | "RETRYING";
  attempts: number;
  error: string | null;
  deliveredAt: string | null;
  lastAttemptAt: string;
}

export interface NotificationCategory {
  id: string;
  code: string;
  name: string;
  section: string;
  description: string | null;
  triggerInfo: string | null;
  defaultSeverity: string;
  recommendedActions: string | null;
  priority: number;
  channelCount: number;
}

export const CHANNEL_TYPE_LABELS: Record<ChannelType, string> = {
  EMAIL: "Correo SMTP",
  SLACK: "Slack",
  WEBHOOK: "Webhook HTTP",
  PAGERDUTY: "PagerDuty",
};

/** Split multilinea (CRUD) a lista de acciones. */
export function splitActions(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" }) : "—";
}
