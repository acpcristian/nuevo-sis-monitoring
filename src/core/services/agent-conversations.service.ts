import { prisma } from "@/infrastructure/db/prisma";
import { NotFoundError } from "@/shared/errors/domain-errors";

/**
 * Historial de conversaciones del chat de prueba del agente, con métricas de
 * uso. Los tokens son ESTIMADOS (chars/4) hasta incorporar pricing por modelo.
 */
const PAGE_SIZE = 10;

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

export interface AgentConversationListItemDto {
  id: string;
  title: string;
  startedAt: string;
  lastMessageAt: string;
  turnCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
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

/** Tokens estimados a partir de caracteres (≈ chars/4). */
export function estimateTokens(chars: number): number {
  return Math.ceil(chars / 4);
}

export class AgentConversationsService {
  /** Crea la conversación (título = primer mensaje recortado). */
  public static async createConversation(userId: string, firstMessage: string): Promise<{ id: string }> {
    const title = firstMessage.trim().slice(0, 60) || "Conversación del agente";
    const row = await prisma.agentConversation.create({
      data: { userId, title },
      select: { id: true },
    });
    return row;
  }

  /** Persiste el mensaje del usuario (siempre, aunque el turno falle). */
  public static async appendUserMessage(conversationId: string, content: string): Promise<void> {
    await prisma.agentMessage.create({
      data: {
        conversationId,
        role: "user",
        content,
        inputTokens: estimateTokens(content.length),
      },
    });
    await prisma.agentConversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
    });
  }

  /**
   * Persiste el turno exitoso del assistant y actualiza los totales de la
   * conversación en una transacción.
   */
  public static async appendAssistantTurn(
    conversationId: string,
    turn: {
      content: string;
      inputTokens: number;
      outputTokens: number;
      latencyMs: number;
      tools: string[];
    }
  ): Promise<void> {
    await prisma.$transaction([
      prisma.agentMessage.create({
        data: {
          conversationId,
          role: "assistant",
          content: turn.content,
          inputTokens: turn.inputTokens,
          outputTokens: turn.outputTokens,
          latencyMs: turn.latencyMs,
          ...(turn.tools.length ? { tools: turn.tools } : {}),
        },
      }),
      prisma.agentConversation.update({
        where: { id: conversationId },
        data: {
          turnCount: { increment: 1 },
          totalInputTokens: { increment: turn.inputTokens },
          totalOutputTokens: { increment: turn.outputTokens },
          lastMessageAt: new Date(),
        },
      }),
    ]);
  }

  /** Historial de la conversación (últimos N mensajes) para el prompt. */
  public static async loadHistory(conversationId: string, limit = 20): Promise<Array<{ role: "user" | "assistant"; content: string }>> {
    const rows = await prisma.agentMessage.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });
    const relevant = rows.slice(-limit).filter((row) => row.role === "user" || row.role === "assistant");
    return relevant.map((row) => ({ role: row.role as "user" | "assistant", content: row.content }));
  }

  public static async exists(id: string): Promise<boolean> {
    const row = await prisma.agentConversation.findUnique({ where: { id }, select: { id: true } });
    return Boolean(row);
  }

  /** Lista paginada de conversaciones (más recientes primero). */
  public static async listConversations(page = 1): Promise<{
    items: AgentConversationListItemDto[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  }> {
    const safePage = Math.max(1, page);
    const [rows, total] = await Promise.all([
      prisma.agentConversation.findMany({
        orderBy: { lastMessageAt: "desc" },
        skip: (safePage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.agentConversation.count(),
    ]);
    return {
      items: rows.map((row) => this.toListItem(row)),
      page: safePage,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    };
  }

  public static async getConversation(id: string): Promise<AgentConversationDetailDto> {
    const row = await prisma.agentConversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!row) throw new NotFoundError("La conversación no existe.");
    return {
      ...this.toListItem(row),
      messages: row.messages.map((message) => this.toMessage(message)),
    };
  }

  public static async deleteConversation(id: string): Promise<void> {
    const existing = await prisma.agentConversation.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError("La conversación no existe.");
    await prisma.agentConversation.delete({ where: { id } });
  }

  /** Métricas totales de uso del agente. */
  public static async getMetrics(): Promise<AgentMetricsDto> {
    const [conversations, turns, tokens, latency] = await Promise.all([
      prisma.agentConversation.count(),
      prisma.agentConversation.aggregate({ _sum: { turnCount: true } }),
      prisma.agentConversation.aggregate({ _sum: { totalInputTokens: true, totalOutputTokens: true } }),
      prisma.agentMessage.aggregate({ _avg: { latencyMs: true }, where: { role: "assistant" } }),
    ]);
    return {
      conversations,
      turns: turns._sum.turnCount ?? 0,
      totalInputTokens: tokens._sum.totalInputTokens ?? 0,
      totalOutputTokens: tokens._sum.totalOutputTokens ?? 0,
      avgLatencyMs: latency._avg.latencyMs !== null ? Math.round(latency._avg.latencyMs) : null,
    };
  }

  private static toListItem(row: {
    id: string;
    title: string;
    startedAt: Date;
    lastMessageAt: Date;
    turnCount: number;
    totalInputTokens: number;
    totalOutputTokens: number;
  }): AgentConversationListItemDto {
    return {
      id: row.id,
      title: row.title,
      startedAt: row.startedAt.toISOString(),
      lastMessageAt: row.lastMessageAt.toISOString(),
      turnCount: row.turnCount,
      totalInputTokens: row.totalInputTokens,
      totalOutputTokens: row.totalOutputTokens,
    };
  }

  private static toMessage(row: {
    id: string;
    role: string;
    content: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number | null;
    tools: unknown;
    createdAt: Date;
  }): AgentMessageDto {
    return {
      id: row.id,
      role: row.role,
      content: row.content,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      latencyMs: row.latencyMs,
      tools: Array.isArray(row.tools) ? (row.tools as string[]) : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
