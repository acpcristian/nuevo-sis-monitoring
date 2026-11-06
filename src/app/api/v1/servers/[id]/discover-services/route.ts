import { NextRequest, NextResponse } from "next/server";
import { AgentDiscoveryService } from "@/core/services/agent-discovery.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";
import { AuditService } from "@/core/services/audit.service";

/**
 * Escaneo manual de servicios con el agente SSH de solo lectura.
 * Dispara `scripts/nexo_agent.sh` en el servidor remoto y persiste los
 * servicios descubiertos (doble upsert por serverId+name).
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await RbacGuard.extractUser(request);
    const { id } = await context.params;
    await RbacGuard.assertSuperAdmin(user, "DISCOVER_SERVICES", id);

    const outcome = await AgentDiscoveryService.discoverForServer(id);

    await AuditService.recordEvent({
      userId: user.id,
      action: "SERVICES_DISCOVERED",
      targetServerId: id,
      detailsDiff: {
        outcomeOk: outcome.ok,
        motivo: outcome.motivo,
        docker: outcome.metricas.docker,
        systemd: outcome.metricas.systemd,
        persistidos: outcome.metricas.persistidos,
      },
      ipAddress: user.ipAddress,
    });

    return NextResponse.json(outcome, { status: 200 });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Error en descubrimiento manual de servicios:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error al ejecutar el escaneo del agente." },
      { status: 500 }
    );
  }
}
