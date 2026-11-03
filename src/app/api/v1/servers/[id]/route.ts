import { NextRequest, NextResponse } from "next/server";
import { ServerQueryService } from "@/core/services/server-query.service";
import { ServerPresenter, RawServerWithRelations } from "@/core/services/server-presenter";
import { RbacGuard } from "@/infrastructure/security/rbac-guard";
import { DomainError } from "@/shared/errors/domain-errors";
import { prisma } from "@/infrastructure/db/prisma";
import { UpdateServerSchema, RetireServerSchema } from "@/shared/validations/server.schema";
import { SecretVault } from "@/infrastructure/crypto/secret-vault";
import { AuditService } from "@/core/services/audit.service";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await RbacGuard.extractUser(request);
    const { id } = await context.params;

    const server = await ServerQueryService.getServerById(id);
    const sanitized = ServerPresenter.toDto(server as RawServerWithRelations, user.role);

    return NextResponse.json({
      ...sanitized,
      recentChecks: server.checks,
    });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error_code: error.code, message: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error al consultar servidor." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await RbacGuard.extractUser(request);
    const { id } = await context.params;
    await RbacGuard.assertSuperAdmin(user, "UPDATE_SERVER", id);

    const body = await request.json();
    const validated = UpdateServerSchema.parse(body);

    const existing = await prisma.server.findUnique({
      where: { id },
      include: { credential: true },
    });

    if (!existing) {
      return NextResponse.json({ error_code: "NOT_FOUND", message: "Servidor no encontrado." }, { status: 404 });
    }

    // Actualizar datos del servidor
    const updated = await prisma.$transaction(async (tx) => {
      const server = await tx.server.update({
        where: { id },
        data: {
          name: validated.name ?? undefined,
          ipAddress: validated.ipAddress ?? undefined,
          hostname: validated.hostname !== undefined ? validated.hostname : undefined,
          environment: validated.environment ?? undefined,
          technicalOwner: validated.technicalOwner !== undefined ? validated.technicalOwner : undefined,
          description: validated.description !== undefined ? validated.description : undefined,
          connectionPort: validated.connectionPort ?? undefined,
        },
      });

      // Rotar credencial si se suministró una nueva (Principio III)
      if (validated.newCredential) {
        const encrypted = SecretVault.encryptSecret(validated.newCredential.secretValue);
        await tx.serverCredential.upsert({
          where: { serverId: id },
          update: {
            credentialType: validated.newCredential.credentialType,
            username: validated.newCredential.username,
            encryptedPayload: encrypted.encryptedPayload,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            keyFingerprint: encrypted.keyFingerprint,
            rotatedAt: new Date(),
          },
          create: {
            serverId: id,
            credentialType: validated.newCredential.credentialType,
            username: validated.newCredential.username,
            encryptedPayload: encrypted.encryptedPayload,
            iv: encrypted.iv,
            authTag: encrypted.authTag,
            keyFingerprint: encrypted.keyFingerprint,
          },
        });
      }

      return server;
    });

    await AuditService.recordEvent({
      userId: user.id,
      action: "METADATA_UPDATED",
      targetServerId: id,
      detailsDiff: {
        updatedFields: Object.keys(validated),
      },
      ipAddress: user.ipAddress,
    });

    const fullServer = await ServerQueryService.getServerById(id);
    return NextResponse.json(ServerPresenter.toDto(fullServer as RawServerWithRelations, user.role));
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al actualizar servidor." }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await RbacGuard.extractUser(request);
    const { id } = await context.params;
    await RbacGuard.assertSuperAdmin(user, "RETIRE_SERVER", id);

    const body = await request.json();
    const { confirmationName } = RetireServerSchema.parse(body);

    const server = await prisma.server.findUnique({
      where: { id },
    });

    if (!server) {
      return NextResponse.json({ error_code: "NOT_FOUND", message: "Servidor no encontrado." }, { status: 404 });
    }

    if (server.name !== confirmationName) {
      return NextResponse.json(
        { error_code: "CONFIRMATION_MISMATCH", message: "El nombre de confirmación no coincide con el servidor." },
        { status: 400 }
      );
    }

    // Desincorporar: marcar como RETIRED y purgar credenciales físicas en reposo (FR-014)
    await prisma.$transaction(async (tx) => {
      await tx.serverCredential.deleteMany({
        where: { serverId: id },
      });

      await tx.server.update({
        where: { id },
        data: {
          lifecycleState: "RETIRED",
          healthStatus: "UNREACHABLE",
        },
      });
    });

    await AuditService.recordEvent({
      userId: user.id,
      action: "SERVER_RETIRED",
      targetServerId: id,
      detailsDiff: {
        serverName: server.name,
        credentialsPurged: true,
      },
      ipAddress: user.ipAddress,
    });

    return NextResponse.json({ message: `Servidor '${server.name}' retirado y credenciales purgadas exitosamente.` });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json({ error_code: error.code, message: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error_code: "INTERNAL_ERROR", message: "Error al retirar servidor." }, { status: 500 });
  }
}

