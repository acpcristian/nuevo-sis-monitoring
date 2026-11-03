import { NextRequest, NextResponse } from "next/server";
import { NotificationService, type ChannelStatus, type ChannelConfig } from "@/core/services/notification.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

/** PATCH /api/v1/channels/[id] — actualiza nombre/descripción/estado/config (solo SUPERADMIN). */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await RbacGuard.extractUser(request);
    const { id } = await context.params;

    if (user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error_code: "FORBIDDEN_ACTION", message: "Solo SUPERADMIN puede administrar canales." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const input: { name?: string; description?: string; status?: ChannelStatus; config?: ChannelConfig } = {};
    if (typeof body?.name === "string") input.name = body.name;
    if (typeof body?.description === "string") input.description = body.description;
    if (body?.status === "ACTIVE" || body?.status === "INACTIVE") input.status = body.status;
    if (body?.config && typeof body.config === "object") input.config = body.config as ChannelConfig;

    const channel = await NotificationService.updateChannel(id, input, user.id, user.ipAddress);
    return NextResponse.json(channel);
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    console.error("Error en PATCH /api/v1/channels/[id]:", error);
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al actualizar el canal." }, { status: 500 });
  }
}

/** DELETE /api/v1/channels/[id] — elimina el canal y sus entregas (solo SUPERADMIN). */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await RbacGuard.extractUser(request);
    const { id } = await context.params;

    if (user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error_code: "FORBIDDEN_ACTION", message: "Solo SUPERADMIN puede eliminar canales." },
        { status: 403 }
      );
    }

    await NotificationService.deleteChannel(id, user.id, user.ipAddress);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    console.error("Error en DELETE /api/v1/channels/[id]:", error);
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al eliminar el canal." }, { status: 500 });
  }
}

/** POST /api/v1/channels/[id] — { action: "test" | "process-retries" } (solo SUPERADMIN). */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await RbacGuard.extractUser(request);
    const { id } = await context.params;

    if (user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error_code: "FORBIDDEN_ACTION", message: "Solo SUPERADMIN puede probar canales o procesar reintentos." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const action = body?.action ?? "test";

    if (action === "test") {
      const result = await NotificationService.testChannel(id, user.id, user.ipAddress);
      return NextResponse.json(result, { status: result.ok ? 200 : 502 });
    }

    if (action === "process-retries") {
      const result = await NotificationService.processRetries();
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error_code: "VALIDATION_ERROR", message: "Acción no reconocida (test | process-retries)." },
      { status: 422 }
    );
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    console.error("Error en POST /api/v1/channels/[id]:", error);
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al ejecutar la acción del canal." }, { status: 500 });
  }
}
