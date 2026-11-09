import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";
import { NotificationService } from "@/core/services/notification.service";

export async function POST(request: NextRequest) {
  try {
    const user = await RbacGuard.extractUser(request);

    // Solo SUPERADMIN puede enviar notificaciones manualmente (Principio IV)
    if (user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error_code: "FORBIDDEN_ACTION", message: "Solo SUPERADMIN puede enviar notificaciones." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, message, severity, category, incidentId, metadata, action } = body ?? {};

    // Acción operativa: barrer entregas RETRYING con reintento vencido.
    if (action === "process-retries") {
      const result = await NotificationService.processRetries();
      return NextResponse.json(result, { status: 200 });
    }

    const results = await NotificationService.sendNotification({
      title,
      message,
      severity,
      category: typeof category === "string" ? category : undefined,
      incidentId,
      metadata,
    });

    return NextResponse.json({ results }, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Error inesperado en POST /api/v1/notifications:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al enviar notificación." },
      { status: 500 }
    );
  }
}

/** GET /api/v1/notifications — historial de entregas recientes (entregabilidad US4). */
export async function GET(request: NextRequest) {
  try {
    await RbacGuard.extractUser(request);
    const { searchParams } = new URL(request.url);
    const take = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")));
    const status = searchParams.get("status");
    const channelId = searchParams.get("channel_id");
    const category = searchParams.get("category");

    const where: {
      status?: "SENT" | "FAILED" | "RETRYING";
      channelId?: string;
      category?: string;
    } =
      status === "SENT" || status === "FAILED" || status === "RETRYING" ? { status } : {};
    if (channelId) where.channelId = channelId;
    if (category) where.category = category;

    const items = await prisma.notificationDelivery.findMany({
      where,
      orderBy: { lastAttemptAt: "desc" },
      take,
      include: { channel: { select: { id: true, name: true, type: true } } },
    });

    return NextResponse.json({ items, total: items.length });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }
    console.error("Error en GET /api/v1/notifications:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error al consultar entregas." },
      { status: 500 }
    );
  }
}