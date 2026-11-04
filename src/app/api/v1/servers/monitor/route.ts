import { NextRequest, NextResponse } from "next/server";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { ServerMonitoringService } from "@/core/services/server-monitoring.service";
import { MonitorServersSchema } from "@/shared/validations/server.schema";
import { DomainError } from "@/shared/errors/domain-errors";

/**
 * POST /api/v1/servers/monitor
 *
 * Ejecuta sondeos reales (TCP/HTTP) desde el backend y devuelve el estado
 * agregado de los servidores. Es una operación de solo lectura: cualquier
 * usuario autenticado puede consultarla, incluido OBSERVADOR.
 *
 * Body: { ids?: string[], force?: boolean }
 * - Sin `ids`: monitorea hasta 100 servidores en ciclo ACTIVE.
 * - `force`: ignora la ventana de coalescencia de 5 s.
 */
export async function POST(request: NextRequest) {
  try {
    await RbacGuard.extractUser(request);

    const body = await request.json().catch(() => ({}));
    const validated = MonitorServersSchema.parse(body);

    const result = await ServerMonitoringService.monitorServers(validated.ids, {
      force: validated.force,
    });

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        ...result,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
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
          message: "Parámetros de monitoreo inválidos.",
          details: error,
        },
        { status: 400 }
      );
    }

    console.error("Error en POST /api/v1/servers/monitor:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error al ejecutar el monitoreo de servidores." },
      { status: 500 }
    );
  }
}
