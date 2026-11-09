import { NextRequest, NextResponse } from "next/server";
import { NotificationService } from "@/core/services/notification.service";
import { ChannelCreateSchema } from "@/shared/validations/notification.schema";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

/** GET /api/v1/channels — lista de canales SIN secretos (configSummary) (Principio III). */
export async function GET(request: NextRequest) {
  try {
    await RbacGuard.extractUser(request);
    const channels = await NotificationService.listChannels();
    return NextResponse.json({ items: channels, total: channels.length });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    console.error("Error en GET /api/v1/channels:", error);
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al listar canales." }, { status: 500 });
  }
}

/** POST /api/v1/channels — crea canal con configuración cifrada AES-256-GCM (solo SUPERADMIN). */
export async function POST(request: NextRequest) {
  try {
    const user = await RbacGuard.extractUser(request);
    if (user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error_code: "FORBIDDEN_ACTION", message: "Solo SUPERADMIN puede administrar canales de notificación." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const input = ChannelCreateSchema.parse(body);

    const channel = await NotificationService.createChannel(
      {
        type: input.type,
        name: input.name.trim(),
        description: input.description,
        config: input.config as never,
        categories: input.categories ?? [],
      },
      user.id,
      user.ipAddress
    );

    return NextResponse.json(channel, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    if (error && typeof error === "object" && "issues" in error) {
      return NextResponse.json(
        { error_code: "VALIDATION_FAILED", message: "Datos de entrada inválidos para el canal." },
        { status: 400 }
      );
    }
    console.error("Error en POST /api/v1/channels:", error);
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al crear el canal." }, { status: 500 });
  }
}
