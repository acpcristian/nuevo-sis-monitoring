import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/infrastructure/db/prisma";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

export async function POST(request: NextRequest) {
  try {
    const user = RbacGuard.extractUser(request);

    // Solo SUPERADMIN puede enviar notificaciones manualmente (Principio IV)
    if (user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error_code: "FORBIDDEN_ACTION", message: "Solo SUPERADMIN puede enviar notificaciones." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, message, severity, incidentId, metadata } = body;

    const results = await NotificationService.sendNotification({
      title,
      message,
      severity,
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
    RbacGuard.extractUser(request);
    const { searchParams } = new URL(request.url);
    const take = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")));
    const status = searchParams.get("status");

    const where =
      status === "SENT" || status === "FAILED" || status === "RETRYING" ? { status } : {};
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