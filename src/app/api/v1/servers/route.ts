import { NextRequest, NextResponse } from "next/server";
import { CreateServerSchema } from "@/shared/validations/server.schema";
import { ServerService } from "@/core/services/server.service";
import { ServerQueryService } from "@/core/services/server-query.service";
import { ServerPresenter, RawServerWithRelations } from "@/core/services/server-presenter";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";
import { Environment, OsType, HealthStatus, LifecycleState } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const user = await RbacGuard.extractUser(request);
    const { searchParams } = new URL(request.url);

    const environment = searchParams.get("environment") as Environment | undefined;
    const osType = searchParams.get("osType") as OsType | undefined;
    const healthStatus = searchParams.get("healthStatus") as HealthStatus | undefined;
    const lifecycleState = searchParams.get("lifecycleState") as LifecycleState | undefined;
    const search = searchParams.get("search") || undefined;
    const page = searchParams.get("page") ? parseInt(searchParams.get("page")!) : 1;
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : 50;

    const result = await ServerQueryService.listServers({
      environment,
      osType,
      healthStatus,
      lifecycleState,
      search,
      page,
      limit,
    });

    const sanitizedItems = ServerPresenter.toListDto(result.items as RawServerWithRelations[], user.role);

    return NextResponse.json({
      items: sanitizedItems,
      total: result.total,
      page: result.page,
      limit: result.limit,
      pages: result.pages,
    });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Error en GET /api/v1/servers:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al consultar inventario." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "CREATE_SERVER");

    const body = await request.json();
    const validatedInput = CreateServerSchema.parse(body);

    const createdServer = await ServerService.createServer(validatedInput, user.id, user.ipAddress);
    const sanitizedResponse = ServerPresenter.toDto(createdServer as RawServerWithRelations, user.role);

    return NextResponse.json(sanitizedResponse, { status: 201 });
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
          message: "Datos de entrada inválidos para el registro del servidor.",
          details: error,
        },
        { status: 400 }
      );
    }

    console.error("Error inesperado en POST /api/v1/servers:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno procesando la solicitud." },
      { status: 500 }
    );
  }
}
