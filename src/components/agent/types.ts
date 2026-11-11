import type { LlmProviderPreset, LlmModelPreset, LlmProviderType } from "@/core/domain/llm-providers";

export { LLM_PROVIDER_PRESETS, getProviderPreset, detectProviderType } from "@/core/domain/llm-providers";
export type { LlmProviderPreset, LlmModelPreset, LlmProviderType } from "@/core/domain/llm-providers";

/** Proveedor tal como lo entrega la API (sin secretos). */
export interface AgentProviderDto {
  id: string;
  providerType: string;
  name: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  /** Rate limiting del guardián: null = sin límite. */
  rateLimitPerMinute: number | null;
  rateLimitPerDay: number | null;
  requiresApiKey: boolean;
  hasApiKey: boolean;
  keyFingerprint: string | null;
  apiKeyLast4: string | null;
  isActive: boolean;
  lastTestAt: string | null;
  lastTestStatus: string | null;
  lastTestLatencyMs: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentProfileDto {
  enabled: boolean;
  toolsEnabled: boolean;
  name: string;
  tone: string | null;
  instructions: string | null;
  escalationRules: string | null;
  greeting: string | null;
  updatedAt: string;
}

export interface ProviderTestResult {
  ok: boolean;
  message: string;
  latencyMs: number | null;
  model?: string;
}

export interface ChatMessageItem {
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  /** Resúmenes de herramientas consultadas durante el turno. */
  tools?: string[];
}

// ── Knowledge Base (013) ──────────────────────────────────────────────────

export interface AgentKbEntryDto {
  id: string;
  kind: "QA" | "BLOQUE";
  question: string | null;
  answer: string | null;
  title: string | null;
  content: string | null;
  enabled: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentKbListDto {
  items: AgentKbEntryDto[];
  usedChars: number;
  budget: number;
}

// ── Historial y métricas (013) ────────────────────────────────────────────

export interface AgentConversationListItemDto {
  id: string;
  title: string;
  startedAt: string;
  lastMessageAt: string;
  turnCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
}

export interface AgentMessageDto {
  id: string;
  role: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number | null;
  tools: string[] | null;
  createdAt: string;
}

export interface AgentConversationDetailDto extends AgentConversationListItemDto {
  messages: AgentMessageDto[];
}

export interface AgentMetricsDto {
  conversations: number;
  turns: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgLatencyMs: number | null;
}
