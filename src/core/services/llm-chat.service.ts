import { AgentProfileService } from "@/core/services/agent-profile.service";
import { AgentProviderService } from "@/core/services/agent-provider.service";

/**
 * Cliente de chat con proveedores LLM OpenAI-compatible (OpenRouter, Groq,
 * OpenAI, DeepSeek, Ollama local, custom) con streaming SSE.
 *
 * Reglas operativas (CLAUDE.md): un solo hipo del proveedor nunca tumbará el
 * turno — los errores se transforman en eventos `error` del stream y el
 * timeout es estricto (60 s de lectura).
 */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatTurnResult {
  /** Texto completo de la respuesta (para registro/depuración). */
  fullText: string;
  firstTokenMs: number | null;
}

const READ_TIMEOUT_MS = 60_000;

export class LlmChatService {
  /**
   * Ejecuta un turno de chat contra el proveedor activo y entrega los deltas
   * al callback a medida que llegan (streaming real, no acumulado al final).
   * Devuelve el texto completo del turno.
   */
  public static async streamChatTurn(
    userMessage: string,
    history: ChatMessage[],
    onDelta: (delta: string) => void
  ): Promise<ChatTurnResult> {
    const credentials = await AgentProviderService.getActiveCredentials();
    if (!credentials) {
      throw new NoProviderConfiguredError();
    }

    const systemPrompt = await AgentProfileService.assembleSystemPrompt();
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
      ...history.slice(-20).map((message) => ({ role: message.role, content: message.content })),
      { role: "user", content: userMessage },
    ];

    const baseUrl = credentials.baseUrl.replace(/\/+$/, "");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (credentials.apiToken) {
      headers.Authorization = `Bearer ${credentials.apiToken}`;
    }

    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), READ_TIMEOUT_MS);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        signal: controller.signal,
        body: JSON.stringify({
          model: credentials.model,
          messages,
          stream: true,
          temperature: credentials.temperature,
          max_tokens: credentials.maxOutputTokens,
        }),
      });

      if (!response.ok || !response.body) {
        const detail = response.body ? await response.text().catch(() => "") : "";
        throw new LlmProviderError(
          response.status || 502,
          detail || "El proveedor devolvió una respuesta vacía."
        );
      }

      let fullText = "";
      let firstTokenMs: number | null = null;

      // SSE: líneas "data: {...}", terminadas por "data: [DONE]".
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;

          try {
            const chunk = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const delta = chunk.choices?.[0]?.delta?.content;
            if (delta) {
              if (firstTokenMs === null) firstTokenMs = Date.now() - started;
              fullText += delta;
              onDelta(delta);
            }
          } catch {
            // Fragmento no-JSON: se ignora sin tumbar el turno.
          }
        }
      }

      if (!fullText.trim()) {
        throw new LlmProviderError(502, "El proveedor no generó contenido para este turno.");
      }

      return { fullText, firstTokenMs };
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** No hay proveedor activo configurado todavía. */
export class NoProviderConfiguredError extends Error {
  constructor() {
    super("Aún no hay proveedor de IA configurado.");
    this.name = "NoProviderConfiguredError";
  }
}

/** Error traducido y sin secretos, listo para mostrar en el stream. */
export class LlmProviderError extends Error {
  public readonly status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.name = "LlmProviderError";
    this.status = status;
  }
}
