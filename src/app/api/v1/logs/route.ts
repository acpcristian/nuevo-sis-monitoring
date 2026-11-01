import { NextRequest, NextResponse } from "next/server";
import { IngestLogSchema, LogListFilterSchema } from "@/shared/validations/log.schema";
import { LogIngestionService } from "@/core/services/log-ingestion.service";
import { LogQueryService } from "@/core/services/log-query.service";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";

export async function GET(request: NextRequest) {
  try {
    const user = RbacGuard.extractUser(request);
    const { searchParams } = new URL(request.url);

    const filterInput = LogListFilterSchema.parse({
      serverId: searchParams.get("server_id") || undefined,
      category: searchParams.get("category") || undefined,
      severity: searchParams.get("severity") || undefined,
      from: searchParams.get("from") || undefined,
      to: searchParams.get("to") || undefined,
      search: searchParams.get("search") || undefined,
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "50",
    });

    const filter: Parameters<typeof LogQueryService.listLogEvents>[0] = {
      serverId: filterInput.serverId,
      category: filterInput.category,
      severity: filterInput.severity,
      from: filterInput.from ? new Date(filterInput.from) : undefined,
      to: filterInput.to ? new Date(filterInput.to) : undefined,
      search: filterInput.search,
      page: filterInput.page,
      limit: filterInput.limit,
    };

    const result = await LogQueryService.listLogEvents(filter);

    return NextResponse.json({
      items: result.items,
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

    console.error("Error en GET /api/v1/logs:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al consultar logs." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = RbacGuard.extractUser(request);

    // Ingesta de logs: SUPERADMIN o agentes de recolección autorizados
    if (user.role !== "SUPERADMIN") {
      return NextResponse.json(
        { error_code: "FORBIDDEN_ACTION", message: "Solo SUPERADMIN puede ingestar logs." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedInput = IngestLogSchema.parse(body);
    validatedInput.serverId ??= undefined;
    validatedInput.rawLog ??= undefined;
    validatedInput.metadata ??= undefined;

    const ingested = await LogIngestionService.ingestLog(
      {
        ...validatedInput,
        serverId: validatedInput.serverId as string | undefined,
        eventTimestamp: new Date(validatedInput.eventTimestamp),
        rawLog: validatedInput.rawLog ?? undefined,
        metadata: (validatedInput.metadata ?? undefined) as Record<string, unknown> | undefined,
      },
      user.id,
      user.ipAddress
    );

    return NextResponse.json(ingested, { status: 201 });
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
          message: "Datos de entrada inválidos para el evento de log.",
          details: error,
        },
        { status: 400 }
      );
    }

    console.error("Error inesperado en POST /api/v1/logs:", error);
    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al ingestar log." },
      { status: 500 }
    );
  }
}
