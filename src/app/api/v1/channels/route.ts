import { NextRequest, NextResponse } from "next/server";
import { NotificationService, type ChannelType, type ChannelConfig, type ChannelStatus } from "@/core/services/notification.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

/** GET /api/v1/channels — lista de canales SIN secretos (configSummary) (Principio III). */
export async function GET(request: NextRequest) {
  try {
    RbacGuard.extractUser(request);
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
    const user = RbacGuard.extractUser(request);
    if (user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error_code: "FORBIDDEN_ACTION", message: "Solo SUPERADMIN puede administrar canales de notificación." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { type, name, description, config } = body ?? {};

    const validTypes: ChannelType[] = ["EMAIL", "SLACK", "WEBHOOK", "PAGERDUTY"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error_code: "VALIDATION_ERROR", message: `type debe ser uno de: ${validTypes.join(", ")}.` },
        { status: 422 }
      );
    }
    if (typeof name !== "string" || name.trim().length < 3) {
      return NextResponse.json(
        { error_code: "VALIDATION_ERROR", message: "name es obligatorio (mínimo 3 caracteres)." },
        { status: 422 }
      );
    }
    if (!config || typeof config !== "object") {
      return NextResponse.json(
        { error_code: "VALIDATION_ERROR", message: "config es obligatorio (webhookUrl/routingKey o SMTP)." },
        { status: 422 }
      );
    }

    const channel = await NotificationService.createChannel(
      {
        type: type as ChannelType,
        name: name.trim(),
        description: typeof description === "string" ? description : undefined,
        config: config as ChannelConfig,
      },
      user.id,
      user.ipAddress
    );

    return NextResponse.json(channel, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    console.error("Error en POST /api/v1/channels:", error);
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al crear el canal." }, { status: 500 });
  }
}
