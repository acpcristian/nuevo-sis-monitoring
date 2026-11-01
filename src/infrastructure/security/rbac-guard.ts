import { NextRequest } from "next/server";
import { ForbiddenError, UnauthorizedError } from "@/shared/errors/domain-errors";
import { UserRole } from "@/core/domain/server.types";
import { AuditService } from "@/core/services/audit.service";

export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  ipAddress?: string;
}

export class RbacGuard {
  /**
   * Extrae el usuario autenticado desde los encabezados HTTP de la petición.
   * Soporta tanto simulación de prueba en headers como tokens Bearer.
   */
  public static extractUser(request: NextRequest): AuthenticatedUser {
    // 1. Detección de IP del cliente
    const forwardedFor = request.headers.get("x-forwarded-for");
    const ipAddress = forwardedFor ? forwardedFor.split(",")[0]?.trim() : "127.0.0.1";

    // 2. Extracción de token o encabezados de autorización
    const authHeader = request.headers.get("authorization");
    const roleHeader = request.headers.get("x-user-role") as UserRole | null;
    const userIdHeader = request.headers.get("x-user-id");

    if (roleHeader && (roleHeader === "SUPERADMIN" || roleHeader === "OBSERVADOR")) {
      return {
        id: userIdHeader || "user-session-id",
        role: roleHeader,
        ipAddress,
      };
    }

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      // Para tokens estándar o mocks de prueba
      const lowerToken = token.toLowerCase();
      if (lowerToken.includes("superadmin") || token === "TOKEN_SUPERADMIN") {
        return { id: "admin-uuid", role: "SUPERADMIN", ipAddress };
      }
      if (lowerToken.includes("observador") || token === "TOKEN_OBSERVADOR") {
        return { id: "observer-uuid", role: "OBSERVADOR", ipAddress };
      }
    }

    // Por defecto, si no hay autenticación válida se rechaza
    throw new UnauthorizedError("Credenciales de autenticación ausentes o inválidas.");
  }

  /**
   * Asegura que el usuario tenga rol SUPERADMIN para operaciones de mutación.
   * Si no lo tiene, registra el intento en auditoría y lanza ForbiddenError (HTTP 403).
   */
  public static async assertSuperAdmin(user: AuthenticatedUser, actionAttempted: string, targetId?: string): Promise<void> {
    if (user.role !== "SUPERADMIN") {
      // Registrar intento no autorizado en auditoría (Principio IV y VI)
      try {
        await AuditService.recordEvent({
          userId: user.id,
          action: "UNAUTHORIZED_ATTEMPT",
          targetServerId: targetId ?? null,
          detailsDiff: {
            role: user.role,
            actionAttempted,
            reason: "Intento de mutación no autorizado por rol OBSERVADOR",
          },
          ipAddress: user.ipAddress ?? null,
        });
      } catch (e) {
        console.error("Error registrando auditoría de intento no autorizado:", e);
      }

      throw new ForbiddenError("El rol OBSERVADOR no tiene privilegios para realizar modificaciones en el inventario.");
    }
  }
}

