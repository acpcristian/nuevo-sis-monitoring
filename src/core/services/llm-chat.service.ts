import { AgentProfileService } from "@/core/services/agent-profile.service";
import { AgentProviderService } from "@/core/services/agent-provider.service";
import { AgentGuardService } from "@/core/services/agent-guard.service";
import { AgentToolsService } from "@/core/services/agent-tools.service";

/**
 * Cliente de chat con proveedores LLM OpenAI-compatible (OpenRouter, Groq,
 * OpenAI, DeepSeek, Ollama local, custom) con streaming SSE y loop agéntico.
 *
 * Reglas operativas (CLAUDE.md): un solo hipo del proveedor nunca tumbará el
 * turno — los errores se transforman en eventos `error` del stream y el
 * timeout es estricto (60 s de lectura). El guardián (rate limit + circuit
 * breaker) se aplica ANTES de cada contacto con el proveedor.
 */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatStreamCallbacks {
  /** Fragmento incremental del texto final (se emite en vivo). */
  onDelta: (delta: string) => void;
  /** Resumen `nombre(arg=val)` de cada herramienta que el modelo invoca. */
  onTool?: (summary: string) => void;
}

export interface ChatTurnResult {
  /** Texto completo de la respuesta (para registro/depuración). */
  fullText: string;
  firstTokenMs: number | null;
  toolInvocations: string[];
  /** Caracteres del prompt enviado (para estimar tokens de entrada). */
  promptChars: number;
}

const READ_TIMEOUT_MS = 60_000;
/** Máximo de rondas tool→resultado→modelo por turno (anti-bucle). */
const MAX_TOOL_ROUNDS = 4;

interface ToolCallRequest {
  id: string;
  name: string;
  arguments: string;
}

interface ProviderTurnOutput {
  content: string;
  toolCalls: ToolCallRequest[];
  firstTokenMs: number | null;
}

type ProviderMessage = {
  role: string;
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
};

export class LlmChatService {
  /**
   * Ejecuta un turno de chat contra el proveedor activo: streaming real de
   * deltas, con soporte de herramientas de dominio (function calling). Si el
   * modelo pide tools, se ejecutan server-side (read-only), se devuelven los
   * resultados al modelo y el ciclo continúa hasta obtener la respuesta final.
   */
  public static async streamChatTurn(
    userMessage: string,
    history: ChatMessage[],
    callbacks: ChatStreamCallbacks
  ): Promise<ChatTurnResult> {
    const credentials = await AgentProviderService.getActiveCredentials();
    if (!credentials) {
      throw new NoProviderConfiguredError();
    }

    // Guardián: límites ANTES de tocar la red; luego el breaker.
    AgentGuardService.checkAndRecordRateLimit(credentials.id, {
      rateLimitPerMinute: credentials.rateLimitPerMinute,
      rateLimitPerDay: credentials.rateLimitPerDay,
    });
    AgentGuardService.assertBreakerAllows(credentials.id);

    const profile = await AgentProfileService.getProfile();
    const systemPrompt = await AgentProfileService.assembleSystemPrompt();
    const tools = profile.toolsEnabled ? AgentToolsService.getToolDefinitions() : null;

    const baseUrl = credentials.baseUrl.replace(/\/+$/, "");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (credentials.apiToken) {
      headers.Authorization = `Bearer ${credentials.apiToken}`;
    }

    const messages: ProviderMessage[] = [
      { role: "system", content: systemPrompt },
      ...history.slice(-20).map((message) => ({ role: message.role, content: message.content })),
      { role: "user", content: userMessage },
    ];
    // Prompt inicial (para estimar tokens de entrada; las tools agregan después).
    const promptChars = messages.reduce((total, message) => total + (message.content?.length ?? 0), 0);

    const toolInvocations: string[] = [];
    let fullText = "";
    let firstTokenMs: number | null = null;

    try {
      // Máximo MAX_TOOL_ROUNDS + 1 llamadas al proveedor por turno.
      for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
        const allowTools = tools !== null && round < MAX_TOOL_ROUNDS;
        const turn = await this.callProviderTurn(
          baseUrl,
          headers,
          credentials,
          messages,
          allowTools ? tools : null,
          callbacks.onDelta
        );

        if (turn.firstTokenMs !== null && firstTokenMs === null) {
          firstTokenMs = turn.firstTokenMs;
        }
        fullText += turn.content;

        if (!turn.toolCalls.length) {
          if (!turn.content.trim()) {
            throw new LlmProviderError(502, "El proveedor no generó contenido para este turno.");
          }
          AgentGuardService.recordSuccess(credentials.id);
          return { fullText, firstTokenMs, toolInvocations, promptChars };
        }

        // El modelo pidió herramientas. En la última ronda ya no volvemos a
        // llamarlo: devolvemos lo que haya o cerramos con error honesto.
        if (round === MAX_TOOL_ROUNDS) {
          if (turn.content.trim()) {
            AgentGuardService.recordSuccess(credentials.id);
            return { fullText, firstTokenMs, toolInvocations, promptChars };
          }
          throw new LlmProviderError(
            502,
            "El agente agotó el máximo de consultas de herramientas sin producir una respuesta."
          );
        }

        messages.push({
          role: "assistant",
          content: turn.content || null,
          tool_calls: turn.toolCalls.map((call) => ({
            id: call.id,
            type: "function" as const,
            function: { name: call.name, arguments: call.arguments },
          })),
        });

        // Ejecutar cada herramienta (read-only) y responder a cada tool_call_id.
        for (const call of turn.toolCalls) {
          const summary = AgentToolsService.summarizeInvocation(call.name, call.arguments);
          toolInvocations.push(summary);
          callbacks.onTool?.(summary);

          let result: unknown;
          try {
            result = AgentToolsService.isKnownTool(call.name)
              ? await AgentToolsService.execute(call.name, call.arguments)
              : { error: "Herramienta desconocida para el agente." };
          } catch (toolError: unknown) {
            const message = toolError instanceof Error ? toolError.message : "Error al ejecutar la herramienta.";
            result = { error: message.slice(0, 300) };
          }

          messages.push({
            role: "tool",
            content: JSON.stringify(result).slice(0, 12_000),
            // La API espera tool_call_id en el mensaje de resultado.
            ...({ tool_call_id: call.id } as object),
          });
        }
      }

      throw new LlmProviderError(502, "El agente no pudo completar el turno.");
    } catch (error: unknown) {
      // Alimentamos el breaker solo con fallos de red/timeout/5xx del proveedor.
      if (error instanceof LlmProviderError) {
        if (AgentGuardService.countsForBreaker(error.status)) {
          AgentGuardService.recordFailure(credentials.id);
        }
      } else if (error instanceof Error && error.name !== "NoProviderConfiguredError") {
        // Error de red/abort/parseo: status desconocido → cuenta para el breaker.
        AgentGuardService.recordFailure(credentials.id);
      }
      throw error;
    }
  }

  /** Una llamada de streaming al proveedor. Devuelve contenido + tool_calls. */
  private static async callProviderTurn(
    baseUrl: string,
    headers: Record<string, string>,
    credentials: { model: string; temperature: number; maxOutputTokens: number },
    messages: ProviderMessage[],
    tools: unknown | null,
    onDelta?: (delta: string) => void
  ): Promise<ProviderTurnOutput> {
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
          ...(tools ? { tools, tool_choice: "auto" } : {}),
        }),
      });

      if (!response.ok || !response.body) {
        const detail = response.body ? await response.text().catch(() => "") : "";
        throw new LlmProviderError(
          response.status || 502,
          detail || "El proveedor devolvió una respuesta vacía."
        );
      }

      let content = "";
      let firstTokenMs: number | null = null;

      // tool_calls llegan fragmentados por índice: id/name/arguments por partes.
      const pendingCalls = new Map<number, { id?: string; name?: string; arguments: string }>();

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
              choices?: Array<{
                delta?: {
                  content?: string;
                  tool_calls?: Array<{
                    index?: number;
                    id?: string;
                    function?: { name?: string; arguments?: string };
                  }>;
                };
              }>;
            };
            const delta = chunk.choices?.[0]?.delta;
            if (delta?.content) {
              if (firstTokenMs === null) firstTokenMs = Date.now() - started;
              content += delta.content;
              onDelta?.(delta.content);
            }
            if (delta?.tool_calls?.length) {
              for (const fragment of delta.tool_calls) {
                const index = fragment.index ?? 0;
                const current = pendingCalls.get(index) ?? { arguments: "" };
                if (fragment.id) current.id = fragment.id;
                if (fragment.function?.name) current.name = fragment.function.name;
                if (fragment.function?.arguments) current.arguments += fragment.function.arguments;
                pendingCalls.set(index, current);
              }
            }
          } catch {
            // Fragmento no-JSON: se ignora sin tumbar el turno.
          }
        }
      }

      const toolCalls: ToolCallRequest[] = [...pendingCalls.entries()]
        .sort(([a], [b]) => a - b)
        .map(([index, call]) => ({
          id: call.id ?? `call_${index}_${Date.now()}`,
          name: call.name ?? "unknown",
          arguments: call.arguments,
        }));

      return { content, toolCalls, firstTokenMs };
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
