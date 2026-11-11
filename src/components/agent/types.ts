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
}
