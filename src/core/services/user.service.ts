import { prisma } from "@/infrastructure/db/prisma";
import { hashPassword, verifyPassword } from "@/core/services/auth.service";
import { AuditService } from "@/core/services/audit.service";
import { ConflictError, NotFoundError, ValidationError } from "@/shared/errors/domain-errors";
import type { UserRole } from "@/core/domain/server.types";
import type { CreateUserInput, UpdateUserInput } from "@/shared/validations/user.schema";

export interface UserSummary {
  id: string;
  username: string;
  displayName: string | null;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActorContext {
  id: string;
  ipAddress?: string | null;
}

const USER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

type UserRow = {
  id: string;
  username: string;
  displayName: string | null;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toSummary(user: UserRow): UserSummary {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export class UserService {
  /** Lista de usuarios sin datos sensibles (nunca passwordHash) — Principio III. */
  public static async list(): Promise<UserSummary[]> {
    const users = await prisma.user.findMany({
      select: USER_SELECT,
      orderBy: [{ isActive: "desc" }, { role: "asc" }, { username: "asc" }],
      take: 200,
    });
    return users.map(toSummary);
  }

  public static async get(id: string): Promise<UserSummary> {
    const user = await prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    if (!user) throw new NotFoundError("Usuario");
    return toSummary(user);
  }

  /** Alta de usuario con hash scrypt y auditoría (Principios III y VI). */
  public static async create(input: CreateUserInput, actor: ActorContext): Promise<UserSummary> {
    const existing = await prisma.user.findUnique({
      where: { username: input.username },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictError(`El usuario «${input.username}» ya existe.`);
    }

    const passwordHash = await hashPassword(input.password);

    let created: UserRow;
    try {
      created = await prisma.user.create({
        data: {
          username: input.username,
          displayName: input.displayName?.trim() ? input.displayName.trim() : null,
          role: input.role,
          passwordHash,
          isActive: true,
        },
        select: USER_SELECT,
      });
    } catch (error: unknown) {
      if (typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002") {
        throw new ConflictError(`El usuario «${input.username}» ya existe.`);
      }
      throw error;
    }

    await AuditService.recordEvent({
      userId: actor.id,
      action: "USER_CREATED",
      detailsDiff: {
        targetUserId: created.id,
        username: created.username,
        role: created.role,
        displayName: created.displayName,
        isActive: created.isActive,
      },
      ipAddress: actor.ipAddress ?? null,
    });

    return toSummary(created);
  }

  /**
   * Actualiza nombre visible, rol y estado con dos invariantes:
   * 1. Un SUPERADMIN no puede desactivarse ni degradar su propio rol (autobloqueo).
   * 2. La plataforma no puede quedar sin SUPERADMIN activo.
   */
  public static async update(
    id: string,
    input: UpdateUserInput,
    actor: ActorContext
  ): Promise<UserSummary> {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Usuario");

    if (id === actor.id && input.isActive === false) {
      throw new ConflictError("No puedes desactivar tu propia cuenta.");
    }
    if (id === actor.id && input.role !== undefined && input.role !== existing.role) {
      throw new ConflictError("No puedes cambiar tu propio rol.");
    }

    const nextRole = input.role ?? existing.role;
    const nextActive = input.isActive ?? existing.isActive;
    const removesActiveSuperadmin =
      existing.role === "SUPERADMIN" &&
      existing.isActive &&
      (nextRole !== "SUPERADMIN" || !nextActive);

    if (removesActiveSuperadmin) {
      const otherActiveSuperadmins = await prisma.user.count({
        where: { role: "SUPERADMIN", isActive: true, id: { not: id } },
      });
      if (otherActiveSuperadmins === 0) {
        throw new ConflictError(
          "Debe existir al menos un SUPERADMIN activo. Asigna ese rol a otro usuario antes de continuar."
        );
      }
    }

    // Cambiar rol o estado invalida de inmediato las sesiones abiertas del usuario.
    const invalidatesSessions =
      (input.role !== undefined && input.role !== existing.role) ||
      (input.isActive !== undefined && input.isActive !== existing.isActive);

    const updated = await prisma.user.update({
      where: { id },
      data: {
        ...(input.displayName !== undefined
          ? { displayName: input.displayName.trim() ? input.displayName.trim() : null }
          : {}),
        ...(input.role !== undefined ? { role: input.role } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(invalidatesSessions ? { sessionVersion: { increment: 1 } } : {}),
      },
      select: USER_SELECT,
    });

    await AuditService.recordEvent({
      userId: actor.id,
      action: "USER_UPDATED",
      detailsDiff: {
        targetUserId: updated.id,
        username: updated.username,
        before: {
          displayName: existing.displayName,
          role: existing.role,
          isActive: existing.isActive,
        },
        after: {
          displayName: updated.displayName,
          role: updated.role,
          isActive: updated.isActive,
        },
      },
      ipAddress: actor.ipAddress ?? null,
    });

    return toSummary(updated);
  }

  /** Restablecimiento administrativo de contraseña (sin conocer la anterior). */
  public static async resetPassword(
    id: string,
    newPassword: string,
    actor: ActorContext
  ): Promise<void> {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Usuario");

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });

    await AuditService.recordEvent({
      userId: actor.id,
      action: "USER_PASSWORD_RESET",
      detailsDiff: { targetUserId: existing.id, username: existing.username },
      ipAddress: actor.ipAddress ?? null,
    });
  }

  /** Cambio de contraseña propio: exige la actual y prohíbe reutilizarla. */
  public static async changeOwnPassword(
    id: string,
    currentPassword: string,
    newPassword: string,
    actor: ActorContext
  ): Promise<{ sessionVersion: number; username: string; role: UserRole }> {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Usuario");

    const currentOk = await verifyPassword(currentPassword, existing.passwordHash);
    if (!currentOk) {
      throw new ValidationError("La contraseña actual no es correcta.");
    }

    const reused = await verifyPassword(newPassword, existing.passwordHash);
    if (reused) {
      throw new ConflictError("La nueva contraseña debe ser distinta de la actual.");
    }

    const passwordHash = await hashPassword(newPassword);
    const updated = await prisma.user.update({
      where: { id },
      data: { passwordHash, sessionVersion: { increment: 1 } },
      select: { sessionVersion: true, username: true, role: true },
    });

    await AuditService.recordEvent({
      userId: actor.id,
      action: "USER_PASSWORD_CHANGED",
      detailsDiff: { targetUserId: existing.id, username: existing.username },
      ipAddress: actor.ipAddress ?? null,
    });

    return updated;
  }
}
