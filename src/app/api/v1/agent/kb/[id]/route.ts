import { NextRequest, NextResponse } from "next/server";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { AuditService } from "@/core/services/audit.service";
import { AgentKbService } from "@/core/services/agent-kb.service";
import { AgentKbEntryUpdateSchema } from "@/shared/validations/agent.schema";
import { DomainError } from "@/shared/errors/domain-errors";

type Context = { params: Promise<{ id: string }> };

/** Actualiza (contenido o toggle habilitado) una entrada de la Knowledge Base. */
export async function PUT(request: NextRequest, context: Context) {
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "UPDATE_AGENT_KB");
    const { id } = await context.params;

    const body = await request.json();
    const input = AgentKbEntryUpdateSchema.parse(body);
    const entry = await AgentKbService.updateEntry(id, input);

    await AuditService.recordEvent({
      userId: user.id,
      action: "AGENT_KB_UPDATED",
      detailsDiff: {
        op: "updated",
        kind: entry.kind,
        enabled: entry.enabled,
        sectionsUpdated: Object.keys(input),
      },
      ipAddress: user.ipAddress,
    });

    const data = await AgentKbService.listEntries();
    return NextResponse.json({ entry, ...data });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }
    if (error && typeof error === "object" && "issues" in error) {
      return NextResponse.json(
        { error_code: "VALIDATION_FAILED", message: "Entrada de conocimiento inválida.", details: error },
        { status: 400 }
      );
    }
    console.error("Error en PUT /api/v1/agent/kb/[id]:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al actualizar la entrada." },
      { status: 500 }
    );
  }
}

/** Elimina una entrada de la Knowledge Base. */
export async function DELETE(request: NextRequest, context: Context) {
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "UPDATE_AGENT_KB");
    const { id } = await context.params;

    await AgentKbService.deleteEntry(id);

    await AuditService.recordEvent({
      userId: user.id,
      action: "AGENT_KB_UPDATED",
      detailsDiff: { op: "deleted", entryId: id },
      ipAddress: user.ipAddress,
    });

    const data = await AgentKbService.listEntries();
    return NextResponse.json(data);
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error en DELETE /api/v1/agent/kb/[id]:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al eliminar la entrada." },
      { status: 500 }
    );
  }
}
