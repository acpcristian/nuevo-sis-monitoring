import { NextRequest, NextResponse } from "next/server";
import { NotificationService } from "@/core/services/notification.service";
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
    const { title, message, severity, ruleId, metadata } = body;

    const results = await NotificationService.sendNotification(
      title,
      message,
      severity as "CRITICAL" | "MAJOR" | "MINOR",
      ruleId,
      metadata
    );

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