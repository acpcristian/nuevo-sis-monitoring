import { NextRequest, NextResponse } from "next/server";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { AuditService } from "@/core/services/audit.service";
import {
  LlmChatService,
  LlmProviderError,
  NoProviderConfiguredError,
} from "@/core/services/llm-chat.service";
import { CircuitOpenError, RateLimitedError } from "@/core/services/agent-guard.service";
import { AgentConversationsService, estimateTokens } from "@/core/services/agent-conversations.service";
import { AgentChatRequestSchema } from "@/shared/validations/agent.schema";
import { DomainError } from "@/shared/errors/domain-errors";

/**
 * Chat de prueba del agente con streaming SSE y conversaciones persistidas.
 * Eventos del stream:
 *  - `delta`  { text }                                      → fragmento incremental
 *  - `tool`   { name, summary }                             → herramienta consultada
 *  - `done`   { latencyMs, chars, tools, conversationId, tokens } → turno completado
 *  - `error`  { message, code, retry_after? }               → fallo tolerado
 */
export async function POST(request: NextRequest) {
  let user;
  try {
    user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "USE_AGENT_CHAT");
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error de autenticación en POST /api/v1/agent/chat:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al validar la sesión." },
      { status: 500 }
    );
  }

  let validatedInput;
  try {
    const body = await request.json();
    validatedInput = AgentChatRequestSchema.parse(body);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "issues" in error) {
      return NextResponse.json(
        {
          error_code: "VALIDATION_FAILED",
          message: "Mensaje inválido para el chat del agente.",
          details: error,
        },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error_code: "BAD_REQUEST", message: "Cuerpo de la petición inválido." },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const started = Date.now();
      try {
        // Conversación persistida: nueva (desde el mensaje) o existente con
        // historial cargado de la BD (fuente de verdad; el cliente no manda historial).
        let conversationId = validatedInput.conversationId ?? null;
        if (conversationId && !(await AgentConversationsService.exists(conversationId))) {
          conversationId = null;
        }
        let history: Array<{ role: "user" | "assistant"; content: string }> = [];
        if (conversationId) {
          history = await AgentConversationsService.loadHistory(conversationId);
        } else {
          const created = await AgentConversationsService.createConversation(
            user.id,
            validatedInput.message
          );
          conversationId = created.id;
          await AuditService.recordEvent({
            userId: user.id,
            action: "AGENT_CONVERSATION_STARTED",
            detailsDiff: { conversationId, titleChars: validatedInput.message.trim().slice(0, 60).length },
            ipAddress: user.ipAddress,
          });
        }

        // El mensaje del usuario se persiste siempre (aunque el turno falle).
        await AgentConversationsService.appendUserMessage(conversationId, validatedInput.message);

        const result = await LlmChatService.streamChatTurn(validatedInput.message, history, {
          onDelta: (delta) => send("delta", { text: delta }),
          onTool: (summary) => send("tool", { name: summary.split("(")[0] ?? summary, summary }),
        });

        // Turno exitoso: persistir respuesta + totales (tokens estimados = chars/4).
        const inputTokens = estimateTokens(result.promptChars);
        const outputTokens = estimateTokens(result.fullText.length);
        const latencyMs = Date.now() - started;
        await AgentConversationsService.appendAssistantTurn(conversationId, {
          content: result.fullText,
          inputTokens,
          outputTokens,
          latencyMs,
          tools: result.toolInvocations,
        });

        send("done", {
          latencyMs,
          firstTokenMs: result.firstTokenMs,
          chars: result.fullText.length,
          tools: result.toolInvocations,
          conversationId,
          tokens: { input: inputTokens, output: outputTokens, estimated: true },
        });
      } catch (error: unknown) {
        if (error instanceof NoProviderConfiguredError) {
          send("error", { code: "NO_PROVIDER", message: "Configura primero un proveedor de IA en la sección Proveedor." });
        } else if (error instanceof RateLimitedError) {
          send("error", {
            code: "RATE_LIMITED",
            message: `Se alcanzó el límite de uso del agente (${error.limit} por ${error.window === "minute" ? "minuto" : "día"}). Reintenta en ${error.retryAfterSeconds} s.`,
            retry_after_seconds: error.retryAfterSeconds,
          });
        } else if (error instanceof CircuitOpenError) {
          send("error", {
            code: "CIRCUIT_OPEN",
            message: `El proveedor está fallando repetidamente: el circuito se abrió para proteger el turno. Reintenta en ${error.retryAfterSeconds} s.`,
            retry_after_seconds: error.retryAfterSeconds,
          });
        } else if (error instanceof LlmProviderError) {
          send("error", { code: `PROVIDER_${error.status}`, message: friendlyChatError(error.status, error.message) });
        } else if (error instanceof Error && error.name === "AbortError") {
          send("error", { code: "TIMEOUT", message: "El proveedor tardó demasiado en responder (más de 60 s). Intenta de nuevo." });
        } else {
          console.error("Error inesperado en el chat del agente:", error);
          send("error", { code: "INTERNAL_ERROR", message: "Error interno durante el turno del agente. Intenta de nuevo." });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/** Mensajes accionables sin secretos para el stream de error. */
function friendlyChatError(status: number, detail: string): string {
  switch (status) {
    case 401:
    case 403:
      return "La clave API del proveedor fue rechazada (401/403). Actualízala en la sección Proveedor.";
    case 404:
      return "El proveedor no reconoce la URL base o el modelo (404). Verifica la configuración.";
    case 429:
      return "El proveedor alcanzó su límite de uso (429). Espera unos minutos y reintenta.";
    default:
      return `El proveedor respondió ${status}: ${detail.slice(0, 240)}`;
  }
}
