import { prisma } from "@/infrastructure/db/prisma";
import { DomainError, NotFoundError } from "@/shared/errors/domain-errors";
import type { AgentKbEntryCreateInput, AgentKbEntryUpdateInput } from "@/shared/validations/agent.schema";

/**
 * Knowledge Base del agente (entrenamiento documental del operador):
 * pares Pregunta→Respuesta y bloques de conocimiento libre que se inyectan
 * al prompt de sistema como fuente de verdad del negocio.
 *
 * Presupuesto de contexto: 24000 chars de entradas habilitadas (igual que el
 * CRM de referencia). Excederlo rechaza la operación con mensaje claro.
 */
export const KB_CONTEXT_BUDGET = 24_000;

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

/** Formato exacto con el que una entrada entra al prompt (define el presupuesto). */
function formatEntry(entry: {
  kind: string;
  question: string | null;
  answer: string | null;
  title: string | null;
  content: string | null;
}): string {
  if (entry.kind === "QA") {
    return `P: ${entry.question ?? ""}\nR: ${entry.answer ?? ""}`;
  }
  return `## ${entry.title ?? ""}\n${entry.content ?? ""}`;
}

export class AgentKbService {
  /** Lista todas las entradas (habilitadas y no), ordenadas por posición. */
  public static async listEntries(): Promise<{
    items: AgentKbEntryDto[];
    usedChars: number;
    budget: number;
  }> {
    const rows = await prisma.agentKbEntry.findMany({ orderBy: { position: "asc" } });
    const usedChars = rows
      .filter((row) => row.enabled)
      .reduce((total, row) => total + formatEntry(row).length + 2, 0);
    return {
      items: rows.map((row) => this.toDto(row)),
      usedChars,
      budget: KB_CONTEXT_BUDGET,
    };
  }

  /** Contexto formateado de las entradas habilitadas (para el prompt de sistema). */
  public static async getEnabledContext(): Promise<string> {
    const rows = await prisma.agentKbEntry.findMany({
      where: { enabled: true },
      orderBy: { position: "asc" },
    });
    if (!rows.length) return "";
    return rows.map((row) => formatEntry(row)).join("\n\n");
  }

  public static async createEntry(input: AgentKbEntryCreateInput): Promise<AgentKbEntryDto> {
    const candidate = {
      kind: input.kind,
      question: input.question ?? null,
      answer: input.answer ?? null,
      title: input.title ?? null,
      content: input.content ?? null,
    };
    await this.assertBudgetFits(candidate, null);

    const last = await prisma.agentKbEntry.findFirst({ orderBy: { position: "desc" } });
    const row = await prisma.agentKbEntry.create({
      data: { ...candidate, position: (last?.position ?? 0) + 1 },
    });
    return this.toDto(row);
  }

  public static async updateEntry(id: string, input: AgentKbEntryUpdateInput): Promise<AgentKbEntryDto> {
    const existing = await prisma.agentKbEntry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("La entrada de conocimiento no existe.");

    const candidate = {
      kind: existing.kind,
      question: input.question === undefined ? existing.question : input.question,
      answer: input.answer === undefined ? existing.answer : input.answer,
      title: input.title === undefined ? existing.title : input.title,
      content: input.content === undefined ? existing.content : input.content,
      enabled: input.enabled === undefined ? existing.enabled : input.enabled,
    };

    // El presupuesto solo aplica a entradas habilitadas.
    if (candidate.enabled) {
      await this.assertBudgetFits(candidate, existing.id);
    }

    const row = await prisma.agentKbEntry.update({
      where: { id },
      data: {
        question: candidate.question,
        answer: candidate.answer,
        title: candidate.title,
        content: candidate.content,
        enabled: candidate.enabled,
      },
    });
    return this.toDto(row);
  }

  public static async deleteEntry(id: string): Promise<void> {
    const existing = await prisma.agentKbEntry.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundError("La entrada de conocimiento no existe.");
    await prisma.agentKbEntry.delete({ where: { id } });
  }

  /** Verifica que el contexto habilitado (con el candidato) no exceda el presupuesto. */
  private static async assertBudgetFits(
    candidate: { kind: string; question: string | null; answer: string | null; title: string | null; content: string | null },
    excludedId: string | null
  ): Promise<void> {
    const others = await prisma.agentKbEntry.findMany({
      where: { enabled: true, ...(excludedId ? { id: { not: excludedId } } : {}) },
      orderBy: { position: "asc" },
    });
    const total =
      others.reduce((sum, row) => sum + formatEntry(row).length + 2, 0) + formatEntry(candidate).length + 2;
    if (total > KB_CONTEXT_BUDGET) {
      throw new DomainError(
        `Presupuesto de conocimiento excedido: con esta entrada el total sería ${total} de ${KB_CONTEXT_BUDGET} caracteres permitidos. Elimina o deshabilita entradas antes de agregar esta.`,
        "KB_BUDGET_EXCEEDED",
        400
      );
    }
  }

  private static toDto(row: {
    id: string;
    kind: string;
    question: string | null;
    answer: string | null;
    title: string | null;
    content: string | null;
    enabled: boolean;
    position: number;
    createdAt: Date;
    updatedAt: Date;
  }): AgentKbEntryDto {
    return {
      id: row.id,
      kind: row.kind === "QA" ? "QA" : "BLOQUE",
      question: row.question,
      answer: row.answer,
      title: row.title,
      content: row.content,
      enabled: row.enabled,
      position: row.position,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
