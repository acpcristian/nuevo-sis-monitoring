import { NextRequest, NextResponse } from "next/server";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { AuditService } from "@/core/services/audit.service";
import { AgentKbService } from "@/core/services/agent-kb.service";
import { AgentKbEntryCreateSchema } from "@/shared/validations/agent.schema";
import { DomainError } from "@/shared/errors/domain-errors";

/** Knowledge Base del agente: listado con presupuesto y creación de entradas. */
export async function GET(request: NextRequest) {
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "VIEW_AGENT_KB");
    const data = await AgentKbService.listEntries();
    return NextResponse.json(data);
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error en GET /api/v1/agent/kb:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al consultar la base de conocimiento." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "UPDATE_AGENT_KB");

    const body = await request.json();
    const input = AgentKbEntryCreateSchema.parse(body);
    const entry = await AgentKbService.createEntry(input);

    // Auditoría de estructura y tamaños, no del contenido completo.
    await AuditService.recordEvent({
      userId: user.id,
      action: "AGENT_KB_UPDATED",
      detailsDiff: {
        op: "created",
        kind: entry.kind,
        sizes: { question: entry.question?.length ?? 0, answer: entry.answer?.length ?? 0, title: entry.title?.length ?? 0, content: entry.content?.length ?? 0 },
      },
      ipAddress: user.ipAddress,
    });

    const data = await AgentKbService.listEntries();
    return NextResponse.json({ entry, ...data }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }
    if (error && typeof error === "object" && "issues" in error) {
      return NextResponse.json(
        {
          error_code: "VALIDATION_FAILED",
          message: "Entrada de conocimiento inválida.",
          details: error,
        },
        { status: 400 }
      );
    }
    console.error("Error en POST /api/v1/agent/kb:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al crear la entrada." },
      { status: 500 }
    );
  }
}
