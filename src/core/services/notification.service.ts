import { prisma } from "@/infrastructure/db/prisma";
import { AuditService } from "@/core/services/audit.service";

export interface NotificationChannel {
  type: "email" | "slack" | "webhook" | "pagerduty";
  name: string;
  config: Record<string, unknown>;
  status: "ACTIVE" | "INACTIVE";
  lastTest?: Date;
  failureCount?: number;
  lastFailure?: Date;
}

export interface NotificationResult {
  channel: string;
  status: "SENT" | "FAILED" | "RETRYING";
  messageId?: string;
  error?: string;
  deliveredAt?: Date;
}

export interface NotificationRule {
  id: string;
  name: string;
  condition: "ALWAYS" | "ONLY_CRITICAL" | "ONLY_MAJOR" | "CUSTOM";
  severityThreshold?: "CRITICAL" | "MAJOR" | "MINOR";
  customCondition?: string;
  enabled: boolean;
  coolingMinutes?: number;
  createdAt: Date;
  createdBy: string;
}

export class NotificationService {
  /**
   * Envía una notificación a todos los canales activos configurados.
   */
  public static async sendNotification(
    title: string,
    message: string,
    severity: "CRITICAL" | "MAJOR" | "MINOR",
    ruleId?: string,
    metadata?: Record<string, unknown>
  ): Promise<NotificationResult[]> {
    // Obtener canales activos
    const channels = await prisma.notificationChannel.findMany({
      where: { status: "ACTIVE" },
    });

    if (channels.length === 0) {
      return [];
    }

    // Aplicar regla de deduplicación si corresponde
    const filteredChannels = await this.applyDeduplicationRule(
      channels,
      severity,
      ruleId
    );

    // Enviar a cada canal
    const results: NotificationResult[] = [];

    for (const channel of filteredChannels) {
      const result = await this.sendToChannel(channel, title, message, severity, metadata);
      results.push(result);
    }

    return results;
  }

  /**
   * Aplica la regla de deduplicación.
   */
  private static async applyDeduplicationRule(
    channels: NotificationChannel[],
    severity: "CRITICAL" | "MAJOR" | "MINOR",
    ruleId?: string
  ): Promise<NotificationChannel[]> {
    // Si hay regla de deduplicación, filtrar canales
    // Por ahora, enviar a todos los canales activos
    // En una implementación completa, aquí se verificaría si ya fue enviado
    // un evento similar en los últimos minutos
    return channels;
  }

  /**
   * Envía una notificación a un canal específico.
   */
  private static async sendToChannel(
    channel: NotificationChannel,
    title: string,
    message: string,
    severity: "CRITICAL" | "MAJOR" | "MINOR",
    metadata?: Record<string, unknown>
  ): Promise<NotificationResult> {
    switch (channel.type) {
      case "email":
        return this.sendEmailNotification(channel, title, message, severity, metadata);
      case "slack":
        return this.sendSlackNotification(channel, title, message, severity, metadata);
      case "webhook":
        return this.sendWebhookNotification(channel, title, message, severity, metadata);
      case "pagerduty":
        return this.sendPagerDutyNotification(channel, title, message, severity, metadata);
      default:
        return {
          channel: channel.name,
          status: "FAILED",
          error: "Tipo de canal no soportado",
        };
    }
  }

  /**
   * Envía notificación por email.
   */
  private static async sendEmailNotification(
    channel: NotificationChannel,
    title: string,
    message: string,
    severity: "CRITICAL" | "MAJOR" | "MINOR",
    metadata?: Record<string, unknown>
  ): Promise<NotificationResult> {
    // En una implementación completa, usarían nodemailer o servicio de email transaccional
    // Por ahora, registramos y simulamos el envío
    await AuditService.recordEvent({
      userId: "system",
      action: "NOTIFICATION_SENT",
      detailsDiff: {
        channel: channel.name,
        type: "email",
        severity,
        title,
      },
    });

    return {
      channel: channel.name,
      status: "SENT",
      messageId: `email-${Date.now()}`,
      deliveredAt: new Date(),
    };
  }

  /**
   * Envía notificación por Slack.
   */
  private static async sendSlackNotification(
    channel: NotificationChannel,
    title: string,
    message: string,
    severity: "CRITICAL" | "MAJOR" | "MINOR",
    metadata?: Record<string, unknown>
  ): Promise<NotificationResult> {
    // En una implementación completa, usarían el webhook de Slack
    // Por ahora, registramos y simulamos el envío
    await AuditService.recordEvent({
      userId: "system",
      action: "NOTIFICATION_SENT",
      detailsDiff: {
        channel: channel.name,
        type: "slack",
        severity,
        title,
      },
    });

    return {
      channel: channel.name,
      status: "SENT",
      messageId: `slack-${Date.now()}`,
      deliveredAt: new Date(),
    };
  }

  /**
   * Envía notificación por webhook.
   */
  private static async sendWebhookNotification(
    channel: NotificationChannel,
    title: string,
    message: string,
    severity: "CRITICAL" | "MAJOR" | "MINOR",
    metadata?: Record<string, unknown>
  ): Promise<NotificationResult> {
    // En una implementación completa, harían POST al endpoint configurado
    // Por ahora, registramos y simulamos el envío
    await AuditService.recordEvent({
      userId: "system",
      action: "NOTIFICATION_SENT",
      detailsDiff: {
        channel: channel.name,
        type: "webhook",
        severity,
        title,
      },
    });

    return {
      channel: channel.name,
      status: "SENT",
      messageId: `webhook-${Date.now()}`,
      deliveredAt: new Date(),
    };
  }

  /**
   * Envía notificación por PagerDuty.
   */
  private static async sendPagerDutyNotification(
    channel: NotificationChannel,
    title: string,
    message: string,
    severity: "CRITICAL" | "MAJOR" | "MINOR",
    metadata?: Record<string, unknown>
  ): Promise<NotificationResult> {
    // En una implementación completa, usarían la API de PagerDuty
    // Por ahora, registramos y simulamos el envío
    await AuditService.recordEvent({
      userId: "system",
      action: "NOTIFICATION_SENT",
      detailsDiff: {
        channel: channel.name,
        type: "pagerduty",
        severity,
        title,
      },
    });

    return {
      channel: channel.name,
      status: "SENT",
      messageId: `pagerduty-${Date.now()}`,
      deliveredAt: new Date(),
    };
  }

  /**
   * Programa un reintento para una notificación fallida.
   */
  public static async scheduleRetry(
    notificationId: string,
    channelId: string
  ): Promise<void> {
    // En una implementación completa, usarían una cola de trabajos (Bull, RabbitMQ, etc.)
    // Por ahora, registramos la solicitud de reintento
    await AuditService.recordEvent({
      userId: "system",
      action: "NOTIFICATION_RETRY_SCHEDULED",
      detailsDiff: {
        notificationId,
        channelId,
        scheduledAt: new Date().toISOString(),
      },
    });
  }
}