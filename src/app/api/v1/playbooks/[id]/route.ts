import { NextRequest, NextResponse } from "next/server";
import { PlaybookService } from "@/core/services/playbook.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    RbacGuard.extractUser(request);
    const { id } = await context.params;
    const playbook = await PlaybookService.getPlaybook(id);
    return NextResponse.json(playbook);
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    console.error("Error en GET /api/v1/playbooks/[id]:", error);
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al consultar el playbook." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = RbacGuard.extractUser(request);
    const { id } = await context.params;

    if (user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error_code: "FORBIDDEN_ACTION", message: "Solo SUPERADMIN puede actualizar playbooks." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const input: Parameters<typeof PlaybookService.updatePlaybook>[1] = {};
    if (typeof body?.name === "string") input.name = body.name;
    if (typeof body?.description === "string") input.description = body.description;
    if (body?.status === "ACTIVE" || body?.status === "DISABLED") input.status = body.status;
    if (body?.trigger && typeof body.trigger === "object") input.trigger = body.trigger;
    if (Array.isArray(body?.steps)) input.steps = body.steps;

    const updated = await PlaybookService.updatePlaybook(id, input, user.id, user.ipAddress);
    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    console.error("Error en PATCH /api/v1/playbooks/[id]:", error);
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al actualizar el playbook." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = RbacGuard.extractUser(request);
    const { id } = await context.params;

    if (user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error_code: "FORBIDDEN_ACTION", message: "Solo SUPERADMIN puede eliminar playbooks." },
        { status: 403 }
      );
    }

    await PlaybookService.deletePlaybook(id, user.id, user.ipAddress);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    console.error("Error en DELETE /api/v1/playbooks/[id]:", error);
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al eliminar el playbook." }, { status: 500 });
  }
}

/** POST /api/v1/playbooks/[id] — { action: "execute" } (solo SUPERADMIN, playbook activo). */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = RbacGuard.extractUser(request);
    const { id } = await context.params;

    if (user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error_code: "FORBIDDEN_ACTION", message: "Solo SUPERADMIN puede ejecutar playbooks." },
        { status: 403 }
      );
    }

    const result = await PlaybookService.execute(id, user.id, { automatic: false, context: { manual: true } });
    return NextResponse.json(result);
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    console.error("Error en POST /api/v1/playbooks/[id]:", error);
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al ejecutar el playbook." }, { status: 500 });
  }
}
