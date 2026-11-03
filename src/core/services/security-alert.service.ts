import { prisma } from "@/infrastructure/db/prisma";
import { AuditService } from "@/core/services/audit.service";
import { NotificationService } from "@/core/services/notification.service";

/** Umbral de fallos de inicio de sesión para disparar una alerta. */
export const LOGIN_FAILURE_THRESHOLD = 5;
/** Ventana de observación de fallos de inicio de sesión, en minutos. */
export const LOGIN_FAILURE_WINDOW_MINUTES = 10;

export interface UnauthorizedAttemptInput {
  userId: string;
  username?: string | null;
  attemptedAction: string;
  targetId?: string | null;
  ipAddress?: string | null;
}

export interface LoginFailureInput {
  username: string;
  ipAddress?: string | null;
}

/**
 * Alertas de seguridad: reutiliza `NotificationService.sendNotification` (todos los
 * canales activos, con dedup anti-tormenta) y deja rastro en auditoría con
 * `SECURITY_ALERT_SENT`. Nunca incluye contraseñas ni secretos en el mensaje.
 */
export class SecurityAlertService {
  private static async deliver(params: {
    title: string;
    message: string;
    severity: "HIGH" | "CRITICAL";
    auditDetails: Record<string, unknown>;
    ipAddress?: string | null;
  }): Promise<void> {
    try {
      const results = await NotificationService.sendNotification({
        title: params.title,
        message: params.message,
        severity: params.severity,
      });

      const delivered = results.filter((result) => !result.deduplicated).length;

      await AuditService.recordEvent({
        userId: "sistema",
        action: "SECURITY_ALERT_SENT",
        detailsDiff: {
          ...params.auditDetails,
          severity: params.severity,
          channels: results.length,
          delivered,
        },
        ipAddress: params.ipAddress ?? null,
      });
    } catch (error) {
      // Una alerta que falla jamás debe romper la operación que la originó.
      console.error("Error enviando alerta de seguridad:", error);
    }
  }

  /**
   * Alerta inmediata cuando un usuario autenticado intenta una mutación sin permiso.
   */
  public static async onUnauthorizedAttempt(input: UnauthorizedAttemptInput): Promise<void> {
    let username = input.username ?? null;
    if (!username) {
      const actor = await prisma.user
        .findUnique({ where: { id: input.userId }, select: { username: true } })
        .catch(() => null);
      username = actor?.username ?? null;
    }

    await this.deliver({
      title: "Intento de modificación no autorizado",
      message:
        `El usuario ${username ?? input.userId} intentó ejecutar "${input.attemptedAction}" ` +
        `sin privilegios suficientes.` +
        (input.targetId ? ` Objetivo: ${input.targetId}.` : "") +
        (input.ipAddress ? ` IP de origen: ${input.ipAddress}.` : ""),
      severity: "HIGH",
      auditDetails: {
        kind: "UNAUTHORIZED_ATTEMPT",
        userId: input.userId,
        username,
        attemptedAction: input.attemptedAction,
        targetId: input.targetId ?? null,
      },
      ipAddress: input.ipAddress ?? null,
    });
  }

  /**
   * Alerta cuando un mismo usuario acumula `LOGIN_FAILURE_THRESHOLD` fallos dentro
   * de la ventana. Se emite en cada múltiplo del umbral (5, 10, 15…) para no inundar;
   * el servicio de notificaciones además deduplica por ventana de 5 minutos.
   */
  public static async onLoginFailed(input: LoginFailureInput): Promise<void> {
    try {
      const since = new Date(Date.now() - LOGIN_FAILURE_WINDOW_MINUTES * 60 * 1000);

      const failures = await prisma.inventoryAuditLog.count({
        where: {
          action: "LOGIN_FAILED",
          timestamp: { gte: since },
          detailsDiff: { path: ["username"], equals: input.username },
        },
      });

      if (failures < LOGIN_FAILURE_THRESHOLD) return;
      if (failures % LOGIN_FAILURE_THRESHOLD !== 0) return;

      await this.deliver({
        title: "Intentos de inicio de sesión fallidos repetidos",
        message:
          `Se detectaron ${failures} intentos fallidos para el usuario "${input.username}" ` +
          `en los últimos ${LOGIN_FAILURE_WINDOW_MINUTES} minutos. ` +
          `Verifica si se trata de un ataque de fuerza bruta o de un usuario bloqueado.` +
          (input.ipAddress ? ` Última IP de origen: ${input.ipAddress}.` : ""),
        severity: "CRITICAL",
        auditDetails: {
          kind: "REPEATED_LOGIN_FAILURES",
          username: input.username,
          failures,
          windowMinutes: LOGIN_FAILURE_WINDOW_MINUTES,
        },
        ipAddress: input.ipAddress ?? null,
      });
    } catch (error) {
      console.error("Error evaluando alerta de logins fallidos:", error);
    }
  }
}

/** Dispara la alerta sin bloquear la petición que la originó. */
export function notifyUnauthorizedAttempt(input: UnauthorizedAttemptInput): void {
  void SecurityAlertService.onUnauthorizedAttempt(input).catch((error) =>
    console.error("Error en alerta de intento no autorizado:", error)
  );
}

/** Dispara la evaluación de fallos de login sin bloquear la respuesta de autenticación. */
export function notifyLoginFailure(input: LoginFailureInput): void {
  void SecurityAlertService.onLoginFailed(input).catch((error) =>
    console.error("Error en alerta de login fallido:", error)
  );
}
