import { prisma } from "@/infrastructure/db/prisma";
import { SecretVault } from "@/infrastructure/crypto/secret-vault";
import { AgentGuardService } from "@/core/services/agent-guard.service";
import { DomainError, NotFoundError } from "@/shared/errors/domain-errors";
import {
  getProviderPreset,
  detectProviderType,
  type LlmProviderType,
} from "@/core/domain/llm-providers";
import type { AgentProviderUpsertInput, AgentProviderTestInput } from "@/shared/validations/agent.schema";

/**
 * Configuración del proveedor LLM del agente (MVP: un solo proveedor activo).
 * La clave API se cifra en reposo con AES-256-GCM (SecretVault) y JAMÁS se
 * devuelve al cliente: solo su huella pública y los últimos 4 caracteres.
 */
export interface AgentProviderDto {
  id: string;
  providerType: string;
  name: string;
  baseUrl: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
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

export interface ProviderTestResult {
  ok: boolean;
  message: string;
  latencyMs: number | null;
  model?: string;
}

export class AgentProviderService {
  /** Lista los proveedores configurados (sin secretos). */
  public static async listProviders(): Promise<{ items: AgentProviderDto[]; activeId: string | null }> {
    const rows = await prisma.agentProviderConfig.findMany({
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });
    return {
      items: rows.map((row) => this.toDto(row)),
      activeId: rows.find((row) => row.isActive)?.id ?? null,
    };
  }

  /** Devuelve el proveedor activo o null si aún no se configura. */
  public static async getActive(): Promise<AgentProviderDto | null> {
    const row = await prisma.agentProviderConfig.findFirst({ where: { isActive: true } });
    return row ? this.toDto(row) : null;
  }

  /**
   * Crea o actualiza el proveedor activo. La clave, si viene, se cifra;
   * si no viene y el registro ya tenía clave, se conserva (rotación opt-in).
   */
  public static async upsertProvider(
    input: AgentProviderUpsertInput,
    userId: string,
    ipAddress?: string
  ): Promise<AgentProviderDto> {
    const preset = getProviderPreset(input.providerType);
    const requiresApiKey = preset?.requiresApiKey ?? true;

    const existing = await prisma.agentProviderConfig.findFirst({ where: { isActive: true } });

    // Exigir clave la primera vez si el proveedor la requiere.
    if (requiresApiKey && !existing?.keyFingerprint && !input.apiToken?.trim()) {
      throw new DomainError(
        "Este proveedor requiere una clave API: ingrésala para guardar la configuración.",
        "REQUIRES_API_KEY",
        400
      );
    }

    const cipher = input.apiToken?.trim()
      ? SecretVault.encryptSecret(input.apiToken.trim())
      : undefined;

    const data = {
      providerType: input.providerType as string,
      name: input.name,
      baseUrl: input.baseUrl.trim().replace(/\/+$/, ""),
      model: input.model.trim(),
      temperature: input.temperature ?? existing?.temperature ?? 0.4,
      maxOutputTokens: input.maxOutputTokens ?? existing?.maxOutputTokens ?? 2048,
      rateLimitPerMinute:
        input.rateLimitPerMinute === undefined
          ? existing?.rateLimitPerMinute ?? null
          : input.rateLimitPerMinute,
      rateLimitPerDay:
        input.rateLimitPerDay === undefined ? existing?.rateLimitPerDay ?? null : input.rateLimitPerDay,
      ...(cipher
        ? {
            encryptedPayload: cipher.encryptedPayload,
            iv: cipher.iv,
            authTag: cipher.authTag,
            keyFingerprint: cipher.keyFingerprint,
          }
        : {}),
      isActive: true,
      updatedAt: new Date(),
    };

    const saved = await prisma.$transaction(async (tx) => {
      // Un solo activo a la vez.
      await tx.agentProviderConfig.updateMany({
        where: { isActive: true, id: { not: existing?.id ?? "" } },
        data: { isActive: false },
      });

      if (existing) {
        return tx.agentProviderConfig.update({ where: { id: existing.id }, data });
      }
      return tx.agentProviderConfig.create({ data });
    });

    // Nueva configuración → estado fresco del guardián (rate limit + breaker).
    AgentGuardService.reset(saved.id);

    return this.toDto(saved);
  }

  /**
   * Prueba de conexión con un proveedor OpenAI-compatible: un chat completion
   * mínimo. Si no se pasa token y hay proveedor activo con clave, usa esa.
   * Nunca incluye la clave en el mensaje de error.
   */
  public static async testConnection(input: AgentProviderTestInput): Promise<ProviderTestResult> {
    let token = input.apiToken?.trim() || null;
    if (!token) {
      const stored = await prisma.agentProviderConfig.findFirst({ where: { isActive: true } });
      token = stored?.encryptedPayload && stored.iv && stored.authTag
        ? SecretVault.decryptSecret(stored.encryptedPayload, stored.iv, stored.authTag)
        : null;
    }

    const baseUrl = input.baseUrl.trim().replace(/\/+$/, "");
    const providerType = detectProviderType(baseUrl);
    const requiresApiKey = getProviderPreset(providerType)?.requiresApiKey ?? true;
    if (requiresApiKey && !token) {
      return {
        ok: false,
        message: "Este proveedor requiere una clave API: ingrésala para probar la conexión.",
        latencyMs: null,
      };
    }

    const started = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: input.model.trim(),
          messages: [{ role: "user", content: "ping" }],
          // Suficiente para que los modelos de razonamiento (que primero
          // consumen tokens en reasoning) lleguen a emitir contenido.
          max_tokens: 200,
          temperature: 0,
        }),
      });
      clearTimeout(timeout);

      const latencyMs = Date.now() - started;
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        return {
          ok: false,
          message: this.friendlyProviderError(response.status, detail),
          latencyMs,
        };
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string | null; reasoning?: string | null } }>;
      };
      const message = payload.choices?.[0]?.message;
      const replied = Boolean(message?.content || message?.reasoning);
      if (!replied) {
        return {
          ok: false,
          message: "El proveedor respondió sin contenido utilizable. Revisa el modelo seleccionado.",
          latencyMs,
        };
      }

      return {
        ok: true,
        message: `Conexión exitosa con ${input.model.trim()} (${latencyMs}ms)`,
        latencyMs,
        model: input.model.trim(),
      };
    } catch (error) {
      const latencyMs = Date.now() - started;
      const aborted = error instanceof Error && error.name === "AbortError";
      return {
        ok: false,
        message: aborted
          ? "El proveedor no respondió en 15 segundos. Revisa la URL base o la disponibilidad del servicio."
          : "No se pudo conectar con el proveedor. Verifica la URL base y tu conectividad.",
        latencyMs,
      };
    }
  }

  /** Registra el resultado del test en el proveedor activo (auditable desde UI). */
  public static async recordTestResult(result: ProviderTestResult): Promise<void> {
    const active = await prisma.agentProviderConfig.findFirst({ where: { isActive: true } });
    if (!active) return;
    await prisma.agentProviderConfig.update({
      where: { id: active.id },
      data: {
        lastTestAt: new Date(),
        lastTestStatus: result.ok ? "OK" : "FAILED",
        lastTestLatencyMs: result.latencyMs,
      },
    });
  }

  /** Descifra y devuelve el token del proveedor activo (uso interno del chat). */
  public static async getActiveCredentials(): Promise<{
    id: string;
    baseUrl: string;
    model: string;
    temperature: number;
    maxOutputTokens: number;
    rateLimitPerMinute: number | null;
    rateLimitPerDay: number | null;
    apiToken: string | null;
  } | null> {
    const active = await prisma.agentProviderConfig.findFirst({ where: { isActive: true } });
    if (!active) return null;
    const apiToken =
      active.encryptedPayload && active.iv && active.authTag
        ? SecretVault.decryptSecret(active.encryptedPayload, active.iv, active.authTag)
        : null;
    return {
      id: active.id,
      baseUrl: active.baseUrl,
      model: active.model,
      temperature: active.temperature,
      maxOutputTokens: active.maxOutputTokens,
      rateLimitPerMinute: active.rateLimitPerMinute,
      rateLimitPerDay: active.rateLimitPerDay,
      apiToken,
    };
  }

  private static toDto(row: {
    id: string;
    providerType: string;
    name: string;
    baseUrl: string;
    model: string;
    temperature: number;
    maxOutputTokens: number;
    rateLimitPerMinute: number | null;
    rateLimitPerDay: number | null;
    keyFingerprint: string | null;
    encryptedPayload: string | null;
    isActive: boolean;
    lastTestAt: Date | null;
    lastTestStatus: string | null;
    lastTestLatencyMs: number | null;
    createdAt: Date;
    updatedAt: Date;
  }): AgentProviderDto {
    // Últimos 4 caracteres de la huella: suficiente para reconocer la clave sin exponerla.
    const apiKeyLast4 = row.encryptedPayload && row.keyFingerprint
      ? row.keyFingerprint.slice(-4)
      : null;
    return {
      id: row.id,
      providerType: row.providerType,
      name: row.name,
      baseUrl: row.baseUrl,
      model: row.model,
      temperature: row.temperature,
      maxOutputTokens: row.maxOutputTokens,
      rateLimitPerMinute: row.rateLimitPerMinute,
      rateLimitPerDay: row.rateLimitPerDay,
      requiresApiKey: getProviderPreset(row.providerType)?.requiresApiKey ?? true,
      hasApiKey: Boolean(row.encryptedPayload),
      keyFingerprint: row.keyFingerprint,
      apiKeyLast4,
      isActive: row.isActive,
      lastTestAt: row.lastTestAt?.toISOString() ?? null,
      lastTestStatus: row.lastTestStatus,
      lastTestLatencyMs: row.lastTestLatencyMs,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /** Traduce códigos HTTP del proveedor a mensajes accionables (sin secretos). */
  private static friendlyProviderError(status: number, detail: string): string {
    const trimmed = detail.replace(/\s+/g, " ").slice(0, 300);
    switch (status) {
      case 401:
      case 403:
        return "La clave API fue rechazada por el proveedor (401/403): revísala o genera una nueva.";
      case 404:
        return "El proveedor no reconoce la URL base o el modelo (404): verifica ambos valores.";
      case 429:
        return "El proveedor alcanzó el límite de uso (429): espera unos minutos o usa un modelo con más cuota.";
      default: {
        if (trimmed.includes("model")) {
          return `El modelo no está disponible en el proveedor (${status}). ${trimmed}`;
        }
        return `El proveedor respondió ${status}. ${trimmed || "Sin detalle adicional."}`;
      }
    }
  }
}
