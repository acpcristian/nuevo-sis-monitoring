import { prisma } from "@/infrastructure/db/prisma";
import { NotFoundError, ConflictError } from "@/shared/errors/domain-errors";
import { AuditService } from "@/core/services/audit.service";
import { NotificationService } from "@/core/services/notification.service";

export type ActionKind =
  | "RESTART_SERVICE"
  | "APPLY_CONFIG"
  | "RUN_COMMAND"
  | "NOTIFY_TEAM"
  | "CHECK_STATE"
  | "WAIT_SECONDS";

export interface PlaybookStep {
  kind: ActionKind;
  params: Record<string, unknown>;
  /* Acciones seguras que el motor ejecuta de verdad */
  /* RESTART_SERVICE/RUN_COMMAND/APPLY_CONFIG exigen aprobación human-in-the-loop */
}

export interface PlaybookStepLog {
  step: number;
  kind: ActionKind;
  status: "OK" | "SKIPPED_APPROVAL" | "FAILED";
  detail: string;
  durationMs: number;
}

/** Acciones seguras (Principio V: read-only-first, human-in-the-loop para mutaciones). */
const SAFE_ACTIONS: ActionKind[] = ["CHECK_STATE", "WAIT_SECONDS", "NOTIFY_TEAM"];

export class PlaybookService {
  // ===========================================================================
  // CRUD
  // ===========================================================================

  public static async listPlaybooks() {
    const items = await prisma.playbook.findMany({
      orderBy: { createdAt: "desc" },
      include: { executions: { orderBy: { startedAt: "desc" }, take: 1 } },
    });
    return { items, total: items.length };
  }

  public static async getPlaybook(id: string) {
    const playbook = await prisma.playbook.findUnique({
      where: { id },
      include: { executions: { orderBy: { startedAt: "desc" }, take: 20 } },
    });
    if (!playbook) throw new NotFoundError("Playbook");
    return playbook;
  }

  public static async createPlaybook(
    input: { name: string; description?: string; trigger?: Record<string, unknown>; steps: PlaybookStep[] },
    userId: string,
    ipAddress?: string | null
  ) {
    const existing = await prisma.playbook.findUnique({ where: { name: input.name } });
    if (existing) {
      throw new ConflictError(`Ya existe un playbook con el nombre "${input.name}".`);
    }
    if (!Array.isArray(input.steps) || input.steps.length === 0) {
      throw new ConflictError("Un playbook requiere al menos un paso.");
    }
    for (const step of input.steps) {
      if (!step?.kind) throw new ConflictError("Cada paso requiere kind.");
    }

    const created = await prisma.playbook.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        status: "DISABLED", // nace deshabilitado: activación consciente (human-in-the-loop)
        trigger: (input.trigger ?? { type: "MANUAL" }) as Record<string, unknown>,
        steps: input.steps as Record<string, unknown>[],
        createdBy: userId,
      },
    });

    await AuditService.recordEvent({
      userId,
      action: "PLAYBOOK_CREATED",
      detailsDiff: { playbookId: created.id, name: created.name, steps: input.steps.length },
      ipAddress: ipAddress ?? null,
    });

    return created;
  }

  public static async updatePlaybook(
    id: string,
    input: { name?: string; description?: string; status?: "ACTIVE" | "DISABLED"; trigger?: Record<string, unknown>; steps?: PlaybookStep[] },
    userId: string,
    ipAddress?: string | null
  ) {
    const playbook = await prisma.playbook.findUnique({ where: { id } });
    if (!playbook) throw new NotFoundError("Playbook");

    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.status !== undefined) data.status = input.status;
    if (input.trigger !== undefined) data.trigger = input.trigger;
    if (input.steps !== undefined) data.steps = input.steps;

    const updated = await prisma.playbook.update({
      where: { id },
      data: data as never,
      include: { executions: { orderBy: { startedAt: "desc" }, take: 20 } },
    });

    await AuditService.recordEvent({
      userId,
      action: "PLAYBOOK_UPDATED",
      detailsDiff: { playbookId: id, fields: Object.keys(input) },
      ipAddress: ipAddress ?? null,
    });

    return updated;
  }

  public static async deletePlaybook(id: string, userId: string, ipAddress?: string | null) {
    const playbook = await prisma.playbook.findUnique({ where: { id } });
    if (!playbook) throw new NotFoundError("Playbook");
    await prisma.playbook.delete({ where: { id } });
    await AuditService.recordEvent({
      userId,
      action: "PLAYBOOK_DELETED",
      detailsDiff: { playbookId: id, name: playbook.name },
      ipAddress: ipAddress ?? null,
    });
  }

  // ===========================================================================
  // Ejecución secuencial auditada (solo acciones seguras sin aprobación)
  // ===========================================================================

  public static async execute(
    id: string,
    userId: string,
    opts?: { automatic?: boolean; context?: Record<string, unknown> }
  ) {
    const playbook = await prisma.playbook.findUnique({ where: { id } });
    if (!playbook) throw new NotFoundError("Playbook");
    if (playbook.status !== "ACTIVE") {
      throw new ConflictError("El playbook está deshabilitado; actívalo antes de ejecutarlo.");
    }

    const execution = await prisma.playbookExecution.create({
      data: {
        playbookId: id,
        trigger: (opts?.context ?? {}) as Record<string, unknown>,
        status: "RUNNING",
        automatic: opts?.automatic ?? false,
        stepsLog: [],
      },
    });

    const steps = (playbook.steps as unknown as PlaybookStep[]) ?? [];
    const logs: PlaybookStepLog[] = [];
    let failed = false;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const start = Date.now();
      try {
        const detail = await this.runStep(step, i + 1);
        logs.push({
          step: i + 1,
          kind: step.kind,
          status: detail.status,
          detail: detail.detail,
          durationMs: Date.now() - start,
        });
        if (detail.status === "FAILED") {
          failed = true;
          break; // fail-fast con registro completo
        }
      } catch (e) {
        logs.push({
          step: i + 1,
          kind: step.kind,
          status: "FAILED",
          detail: e instanceof Error ? e.message : "Error desconocido",
          durationMs: Date.now() - start,
        });
        failed = true;
        break;
      }
    }

    const finishedAt = new Date();
    await prisma.playbookExecution.update({
      where: { id: execution.id },
      data: {
        status: failed ? "FAILED" : "SUCCESS",
        stepsLog: logs as unknown[],
        finishedAt,
        error: failed ? `Fallo en el paso ${logs.length}` : null,
      },
    });

    await prisma.playbook.update({ where: { id }, data: { lastRunAt: finishedAt } });

    await AuditService.recordEvent({
      userId,
      action: failed ? "PLAYBOOK_FAILED" : "PLAYBOOK_EXECUTED",
      detailsDiff: {
        playbookId: id,
        name: playbook.name,
        executionId: execution.id,
        automatic: opts?.automatic ?? false,
        steps: logs.map((l) => ({ step: l.step, kind: l.kind, status: l.status })),
      },
    });

    return { executionId: execution.id, status: failed ? "FAILED" : "SUCCESS", stepsLog: logs, finishedAt };
  }

  private static async runStep(step: PlaybookStep, n: number) {
    const params = (step.params ?? {}) as Record<string, unknown>;

    if (!SAFE_ACTIONS.includes(step.kind)) {
      // Principio V: las acciones mutantes se registran como pendientes de
      // aprobación humana; el operador las ejecuta de forma manual y audita.
      return {
        status: "SKIPPED_APPROVAL" as const,
        detail: `Acción ${step.kind} requiere aprobación/aplicación manual del operador (human-in-the-loop). Parámetros: ${JSON.stringify(params)}`,
      };
    }

    if (step.kind === "WAIT_SECONDS") {
      const seconds = Math.min(120, Math.max(1, Number(params.seconds ?? 5)));
      await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
      return { status: "OK" as const, detail: `Espera de ${seconds} segundo(s) completada.` };
    }

    if (step.kind === "CHECK_STATE") {
      const serverId = String(params.serverId ?? "");
      if (serverId) {
        const server = await prisma.server.findUnique({ where: { id: serverId } });
        if (!server) {
          return { status: "FAILED" as const, detail: `Servidor ${serverId} no encontrado.` };
        }
        return {
          status: "OK" as const,
          detail: `Servidor ${server.name}: estado operativo ${server.status}, salud ${server.healthStatus}, latencia actual desconocida (solo verificación pasiva).`,
        };
      }
      return { status: "OK" as const, detail: "Verificación pasiva sin servidor objetivo (no-op). Agrega params.serverId." };
    }

    if (step.kind === "NOTIFY_TEAM") {
      const title = String(params.title ?? `Playbook paso ${n}`);
      const message = String(params.message ?? "Notificación originada por un playbook.");
      const results = await NotificationService.sendNotification({
        title,
        message,
        severity: String(params.severity ?? "MAJOR"),
        metadata: { origin: "playbook", playbookStep: n },
      });
      const sent = results.filter((r) => r.status === "SENT").length;
      return {
        status: "OK" as const,
        detail: `Notificación despachada a ${results.length} canal(es); ${sent} entregada(s).`,
      };
    }

    return { status: "FAILED" as const, detail: `Acción ${step.kind} no implementada en el motor.` };
  }
}
