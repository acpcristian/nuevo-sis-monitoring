import { NextRequest, NextResponse } from "next/server";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { prisma } from "@/infrastructure/db/prisma";
import { DomainError } from "@/shared/errors/domain-errors";
import { CreateServiceSchema, UpdateServiceSchema } from "@/shared/validations/service.schema";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = RbacGuard.extractUser(request);
    const { id } = await context.params;

    const server = await prisma.server.findUnique({ where: { id } });
    if (!server) {
      return NextResponse.json({ error_code: "NOT_FOUND", message: "Servidor no encontrado." }, { status: 404 });
    }

    const services = await prisma.serverService.findMany({
      where: { serverId: id },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ items: services, total: services.length });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    console.error("Error en GET /api/v1/servers/[id]/services:", error);
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al consultar servicios." }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "CREATE_SERVICE", (await context.params).id);

    const { id } = await context.params;
    const body = await request.json();
    const validated = CreateServiceSchema.parse({ ...body, serverId: id });

    const server = await prisma.server.findUnique({ where: { id } });
    if (!server) {
      return NextResponse.json({ error_code: "NOT_FOUND", message: "Servidor no encontrado." }, { status: 404 });
    }

    const service = await prisma.serverService.create({
      data: {
        serverId: id,
        name: validated.name,
        description: validated.description,
        port: validated.port,
        endpoint: validated.endpoint,
        processName: validated.processName,
      },
    });

    return NextResponse.json(service, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    if (error && typeof error === "object" && "issues" in error) {
      return NextResponse.json({ error_code: "VALIDATION_FAILED", message: "Datos de servicio inválidos.", details: error }, { status: 400 });
    }
    console.error("Error en POST /api/v1/servers/[id]/services:", error);
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al crear servicio." }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "UPDATE_SERVICE", (await context.params).id);

    const { id } = await context.params;
    const body = await request.json();
    const { serviceId, ...updateData } = body;
    if (!serviceId) {
      return NextResponse.json({ error_code: "BAD_REQUEST", message: "serviceId requerido." }, { status: 400 });
    }
    const validated = UpdateServiceSchema.parse(updateData);

    const service = await prisma.serverService.update({
      where: { id: serviceId, serverId: id },
      data: validated,
    });

    return NextResponse.json(service);
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    console.error("Error en PUT /api/v1/servers/[id]/services:", error);
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al actualizar servicio." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = RbacGuard.extractUser(request);
    await RbacGuard.assertSuperAdmin(user, "DELETE_SERVICE", (await context.params).id);

    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get("serviceId");
    if (!serviceId) {
      return NextResponse.json({ error_code: "BAD_REQUEST", message: "serviceId requerido." }, { status: 400 });
    }

    await prisma.serverService.delete({
      where: { id: serviceId, serverId: id },
    });

    return NextResponse.json({ message: "Servicio eliminado." });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    console.error("Error en DELETE /api/v1/servers/[id]/services:", error);
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al eliminar servicio." }, { status: 500 });
  }
}