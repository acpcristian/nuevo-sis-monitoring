import { NextRequest, NextResponse } from "next/server";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { AgentConversationsService } from "@/core/services/agent-conversations.service";
import { DomainError } from "@/shared/errors/domain-errors";

type Context = { params: Promise<{ id: string }> };

/** Detalle completo de una conversación (para expandir y exportar JSON). */
export async function GET(request: NextRequest, context: Context) {
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "VIEW_AGENT_HISTORY");
    const { id } = await context.params;

    const data = await AgentConversationsService.getConversation(id);
    return NextResponse.json(data);
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error en GET /api/v1/agent/conversations/[id]:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al consultar la conversación." },
      { status: 500 }
    );
  }
}

/** Elimina una conversación y sus mensajes. */
export async function DELETE(request: NextRequest, context: Context) {
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "UPDATE_AGENT_HISTORY");
    const { id } = await context.params;

    await AgentConversationsService.deleteConversation(id);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error en DELETE /api/v1/agent/conversations/[id]:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al eliminar la conversación." },
      { status: 500 }
    );
  }
}
