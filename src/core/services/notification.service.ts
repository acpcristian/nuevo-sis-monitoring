import { createHash } from "node:crypto";
import { prisma } from "@/infrastructure/db/prisma";
import { SecretVault } from "@/infrastructure/crypto/secret-vault";
import { NotFoundError, ConflictError } from "@/shared/errors/domain-errors";
import { AuditService } from "@/core/services/audit.service";
import type { Prisma } from "@prisma/client";

export type ChannelType = "EMAIL" | "SLACK" | "WEBHOOK" | "PAGERDUTY" | "TELEGRAM";
export type ChannelStatus = "ACTIVE" | "INACTIVE";
export type DeliveryStatus = "SENT" | "FAILED" | "RETRYING";

/** Config en claro (solo existe en memoria durante el envío; NUNCA se devuelve por API — Principio III). */
export interface ChannelConfig {
  // EMAIL: SMTP
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpSecure?: boolean;
  fromAddress?: string;
  toAddresses?: string[];
  // SLACK / WEBHOOK / PAGERDUTY
  webhookUrl?: string;
  routingKey?: string;
  headers?: Record<string, string>;
  // TELEGRAM: Bot API directa (botToken + chatId destino)
  botToken?: string;
  chatId?: string;
}

export interface ChannelPresenter {
  id: string;
  type: ChannelType;
  name: string;
  description: string | null;
  status: ChannelStatus;
  /** Categorías a las que está suscrito; vacío = todas. */
  categories: string[];
  configSummary: Record<string, unknown> | null;
  lastTestAt: Date | null;
  lastTestStatus: string | null;
  lastTestDetail: string | null;
  failureCount: number;
  lastFailureAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ChannelRow {
  id: string;
  type: "EMAIL" | "SLACK" | "WEBHOOK" | "PAGERDUTY" | "TELEGRAM";
  name: string;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  categories: string[];
  encryptedPayload: string;
  iv: string;
  authTag: string;
  configSummary: unknown;
  lastTestAt: Date | null;
  lastTestStatus: string | null;
  lastTestDetail: string | null;
  failureCount: number;
  lastFailureAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SendResult {
  channel: string;
  channelId: string;
  status: DeliveryStatus;
  messageId?: string;
  error?: string;
  deliveredAt?: Date;
  deduplicated?: boolean;
}

const MAX_ATTEMPTS = 10;
const BASE_RETRY_SECONDS = 30;
const MAX_RETRY_SECONDS = 600;
const DEDUP_WINDOW_SECONDS = 300;

function presentChannel(row: ChannelRow): ChannelPresenter {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    description: row.description,
    status: row.status,
    categories: row.categories ?? [],
    configSummary: (row.configSummary as Record<string, unknown> | null) ?? null,
    lastTestAt: row.lastTestAt,
    lastTestStatus: row.lastTestStatus,
    lastTestDetail: row.lastTestDetail,
    failureCount: row.failureCount,
    lastFailureAt: row.lastFailureAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function decryptConfig(row: ChannelRow): ChannelConfig {
  const plain = SecretVault.decryptSecret(row.encryptedPayload, row.iv, row.authTag);
  return JSON.parse(plain) as ChannelConfig;
}

function dedupKey(channelId: string, title: string, severity: string): string {
  const bucket = Math.floor(Date.now() / (DEDUP_WINDOW_SECONDS * 1000));
  const seed = `${channelId}|${title}|${severity}|${bucket}`;
  return bucketId(seed);
}

function bucketId(seed: string): string {
  // sha256 hex truncado — determinista dentro de la ventana de dedup
  return createHash("sha256").update(seed).digest("hex").substring(0, 40);
}

function backoffSeconds(attempts: number): number {
  const seconds = BASE_RETRY_SECONDS * Math.pow(2, attempts - 1);
  return Math.min(seconds, MAX_RETRY_SECONDS);
}

export class NotificationService {
  // ==========================================================================
  // CRUD de canales (cifrado AES-256-GCM en reposo — Principio III)
  // ==========================================================================

  /**
   * Resumen público de la configuración SIN secretos (p.ej. host SMTP, destino,
   * dominio del webhook) — nunca el valor del secreto.
   */
  private static buildConfigSummary(type: ChannelType, config: ChannelConfig): Record<string, unknown> {
    const summary: Record<string, unknown> = {};
    if (type === "EMAIL") {
      summary.smtpHost = config.smtpHost ?? null;
      summary.toAddresses = config.toAddresses ?? [];
      summary.fromAddress = config.fromAddress ?? null;
    }
    if (type === "SLACK" || type === "WEBHOOK" || type === "PAGERDUTY") {
      const url = config.webhookUrl ?? config.routingKey ?? "";
      try {
        const u = new URL(url);
        summary.host = u.host;
      } catch {
        summary.host = "(configurado)";
      }
    }
    if (type === "TELEGRAM") {
      // El botToken NUNCA aparece en el resumen (Principio III).
      summary.chatId = config.chatId ?? null;
    }
    return summary;
  }

  public static async listChannels(): Promise<ChannelPresenter[]> {
    const rows = await prisma.notificationChannel.findMany({ orderBy: { createdAt: "asc" } });
    return rows.map((r) => presentChannel(r as ChannelRow));
  }

  public static async createChannel(
    input: { type: ChannelType; name: string; description?: string; config: ChannelConfig; categories?: string[] },
    userId: string,
    ipAddress?: string | null
  ): Promise<ChannelPresenter> {
    const existing = await prisma.notificationChannel.findUnique({ where: { name: input.name } });
    if (existing) {
      throw new ConflictError(`Ya existe un canal con el nombre "${input.name}".`);
    }

    const enc = SecretVault.encryptSecret(JSON.stringify(input.config), `channel:${input.name}`);
    const created = await prisma.notificationChannel.create({
      data: {
        type: input.type,
        name: input.name,
        description: input.description ?? null,
        status: "ACTIVE",
        categories: input.categories ?? [],
        encryptedPayload: enc.encryptedPayload,
        iv: enc.iv,
        authTag: enc.authTag,
        configSummary: this.buildConfigSummary(input.type, input.config) as unknown as Prisma.InputJsonValue,
      },
    });

    await AuditService.recordEvent({
      userId,
      action: "CHANNEL_CREATED",
      detailsDiff: { channelId: created.id, name: created.name, type: created.type },
      ipAddress: ipAddress ?? null,
    });

    return presentChannel(created as ChannelRow);
  }

  public static async updateChannel(
    id: string,
    input: { name?: string; description?: string | null; status?: ChannelStatus; config?: ChannelConfig; categories?: string[] },
    userId: string,
    ipAddress?: string | null
  ): Promise<ChannelPresenter> {
    const channel = await prisma.notificationChannel.findUnique({ where: { id } });
    if (!channel) {
      throw new NotFoundError("Canal de notificación");
    }

    const data: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.status !== undefined) data.status = input.status;
    if (input.categories !== undefined) data.categories = input.categories ?? [];
    if (input.config !== undefined) {
      const mergedConfig = this.mergeConfigPreservingSecrets(channel as ChannelRow, input.config);
      const enc = SecretVault.encryptSecret(JSON.stringify(mergedConfig), `channel:${channel.id}`);
      data.encryptedPayload = enc.encryptedPayload;
      data.iv = enc.iv;
      data.authTag = enc.authTag;
      data.configSummary = this.buildConfigSummary(channel.type as ChannelType, mergedConfig);
    }

    const updated = await prisma.notificationChannel.update({ where: { id }, data: data as never });

    await AuditService.recordEvent({
      userId,
      action: "CHANNEL_UPDATED",
      detailsDiff: { channelId: id, fields: Object.keys(input) },
      ipAddress: ipAddress ?? null,
    });

    return presentChannel(updated as ChannelRow);
  }

  /**
   * Al re-cifrar config en una edición, conserva los secretos que la UI no
   * reenvió (p.ej. la contraseña SMTP no se re-escribe al editar el host):
   * el valor omitido/vacío NO significa "borrar el secreto".
   */
  private static mergeConfigPreservingSecrets(current: ChannelRow, incoming: ChannelConfig): ChannelConfig {
    const previous = decryptConfig(current);
    const merged: ChannelConfig = { ...previous };
    for (const [key, value] of Object.entries(incoming)) {
      if (value === undefined) continue;
      if (key === "smtpPassword" && (value === "" || value === null)) continue;
      if (key === "smtpSecure" && value === undefined) continue;
      (merged as Record<string, unknown>)[key] = value;
    }
    return merged;
  }

  public static async deleteChannel(id: string, userId: string, ipAddress?: string | null): Promise<void> {
    const channel = await prisma.notificationChannel.findUnique({ where: { id } });
    if (!channel) {
      throw new NotFoundError("Canal de notificación");
    }
    await prisma.notificationChannel.delete({ where: { id } });
    await AuditService.recordEvent({
      userId,
      action: "CHANNEL_DELETED",
      detailsDiff: { channelId: id, name: channel.name, type: channel.type },
      ipAddress: ipAddress ?? null,
    });
  }

  /**
   * Envía una notificación de prueba a un canal y guarda el resultado (FR de canales).
   */
  public static async testChannel(
    id: string,
    userId: string,
    ipAddress?: string | null
  ): Promise<{ ok: boolean; detail: string }> {
    const row = await prisma.notificationChannel.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundError("Canal de notificación");
    }

    let ok = false;
    let error: string | undefined;
    try {
      const config = decryptConfig(row as ChannelRow);
      await this.deliverToChannel(row as ChannelRow, config, "Prueba de canal", {
        text: "Mensaje de prueba del sistema de monitoreo.",
        severity: "INFO",
      });
      ok = true;
    } catch (e) {
      error = e instanceof Error ? e.message : "Error desconocido";
    }

    await prisma.notificationChannel.update({
      where: { id },
      data: {
        lastTestAt: new Date(),
        lastTestStatus: ok ? "SENT" : "FAILED",
        lastTestDetail: ok ? "Envío de prueba correcto." : (error ?? "Error desconocido").substring(0, 500),
      },
    });

    await AuditService.recordEvent({
      userId,
      action: "CHANNEL_TESTED",
      detailsDiff: { channelId: id, name: row.name, result: ok ? "SENT" : "FAILED" },
      ipAddress: ipAddress ?? null,
    });

    return { ok, detail: ok ? "Envío de prueba correcto." : (error ?? "Error desconocido") };
  }

  // ==========================================================================
  // Envío de notificaciones (US2/US4: envío, dedup, reintentos con backoff)
  // ==========================================================================

  /**
   * Notifica un evento a los canales activos suscritos a la categoría indicada
   * (un canal sin suscripciones recibe todas), con deduplicación por ventana
   * (anti-tormenta) y persistencia de entregabilidad (FR-002/FR-004).
   */
  public static async sendNotification(params: {
    title: string;
    message: string;
    severity: "CRITICAL" | "MAJOR" | "MINOR" | "HIGH" | "MEDIUM" | "LOW" | "INFO" | string;
    /** Categoría del sistema que originó la alerta (SERVER_OFFLINE, LOG_ALERT…). */
    category?: string;
    incidentId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<SendResult[]> {
    const channels = await prisma.notificationChannel.findMany({ where: { status: "ACTIVE" } });
    const results: SendResult[] = [];
    const targetCategory = params.category ?? null;

    for (const row of channels) {
      // Enrutamiento por suscripción: canal vacío = suscrito a todo;
      // con suscripciones, solo recibe las categorías que incluye.
      const subscribes = row.categories.length === 0 || (targetCategory !== null && row.categories.includes(targetCategory));
      if (targetCategory && !subscribes) continue;
      const key = dedupKey(row.id, params.title, params.severity);

      // Dedup dentro de la ventana (mismo canal + mismo título + bucket temporal)
      const existing = await prisma.notificationDelivery.findUnique({
        where: { channelId_dedupKey: { channelId: row.id, dedupKey: key } },
      });
      if (existing && existing.status !== "FAILED") {
        results.push({ channel: row.name, channelId: row.id, status: existing.status, deduplicated: true });
        continue;
      }

      let sendRecord = existing;
      if (!sendRecord) {
        sendRecord = await prisma.notificationDelivery.create({
          data: {
            channelId: row.id,
            dedupKey: key,
            title: params.title,
            message: params.message,
            severity: params.severity,
            category: targetCategory,
            incidentId: params.incidentId ?? null,
            status: "RETRYING",
          },
        });
      }

      const result = await this.attemptDelivery(sendRecord.id, row as ChannelRow, {
        title: params.title,
        message: params.message,
        severity: params.severity,
      });
      results.push({ channel: row.name, channelId: row.id, ...result });
    }

    return results;
  }

  private static async attemptDelivery(
    deliveryId: string,
    row: ChannelRow,
    payload: { title: string; message: string; severity: string }
  ): Promise<Omit<SendResult, "channel" | "channelId">> {
    try {
      const config = decryptConfig(row);
      const messageId = await this.deliverToChannel(row, config, payload.title, {
        text: payload.message,
        severity: payload.severity,
      });

      await prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "SENT",
          attempts: { increment: 1 },
          deliveredAt: new Date(),
          messageId: messageId ?? null,
          nextRetryAt: null,
          error: null,
          lastAttemptAt: new Date(),
        },
      });

      await AuditService.recordEvent({
        userId: "system",
        action: "NOTIFICATION_SENT",
        detailsDiff: { channel: row.name, deliveryId, title: payload.title, severity: payload.severity },
      });

      return { status: "SENT", messageId };
    } catch (e) {
      const delivery = await prisma.notificationDelivery.findUnique({ where: { id: deliveryId } });
      const attempts = (delivery?.attempts ?? 0) + 1;
      const exhausted = attempts >= MAX_ATTEMPTS;
      const delay = backoffSeconds(attempts);
      const nextRetryAt = exhausted ? null : new Date(Date.now() + delay * 1000);
      const error = e instanceof Error ? e.message : "Error desconocido";

      await prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status: exhausted ? "FAILED" : "RETRYING",
          attempts,
          nextRetryAt,
          error: error.substring(0, 500),
          lastAttemptAt: new Date(),
        },
      });

      await AuditService.recordEvent({
        userId: "system",
        action: exhausted ? "NOTIFICATION_FAILED" : "NOTIFICATION_RETRY_SCHEDULED",
        detailsDiff: {
          channel: row.name,
          deliveryId,
          attempts,
          nextRetryAt: nextRetryAt?.toISOString() ?? null,
          error,
        },
      });

      return { status: exhausted ? "FAILED" : "RETRYING", error };
    }
  }

  /**
   * Barrido de reintentos vencidos (llamable desde cron/n8n o manual SUPERADMIN).
   */
  public static async processRetries(): Promise<{ processed: number; results: SendResult["status"][] }> {
    const due = await prisma.notificationDelivery.findMany({
      where: { status: "RETRYING", nextRetryAt: { lte: new Date() } },
      take: 50,
      include: { channel: true },
    });

    const statuses: SendResult["status"][] = [];
    let processed = 0;
    for (const delivery of due) {
      const result = await this.attemptDelivery(delivery.id, delivery.channel as ChannelRow, {
        title: delivery.title,
        message: delivery.message,
        severity: delivery.severity,
      });
      statuses.push(result.status);
      processed += 1;
    }
    return { processed, results: statuses };
  }

  // ==========================================================================
  // Emisores reales por tipo de canal
  // ==========================================================================

  private static async deliverToChannel(
    row: ChannelRow,
    config: ChannelConfig,
    title: string,
    body: { text: string; severity: string }
  ): Promise<string | undefined> {
    switch (row.type) {
      case "SLACK":
        return this.deliverSlack(config, title, body);
      case "WEBHOOK":
        return this.deliverWebhook(config, title, body);
      case "PAGERDUTY":
        return this.deliverPagerDuty(config, title, body);
      case "EMAIL":
        return this.deliverEmail(config, title, body);
      case "TELEGRAM":
        return this.deliverTelegram(config, title, body);
      default:
        throw new Error("Tipo de canal no soportado.");
    }
  }

  private static async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private static async deliverSlack(
    config: ChannelConfig,
    title: string,
    body: { text: string; severity: string }
  ): Promise<string | undefined> {
    if (!config.webhookUrl) throw new Error("webhookUrl no configurado para el canal Slack.");
    const res = await this.fetchWithTimeout(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(config.headers ?? {}) },
      body: JSON.stringify({
        text: `*[${body.severity}]* ${title}\n${body.text}`,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Slack respondió ${res.status}: ${txt.substring(0, 200)}`);
    }
    return `slack-${Date.now()}`;
  }

  private static async deliverWebhook(
    config: ChannelConfig,
    title: string,
    body: { text: string; severity: string }
  ): Promise<string | undefined> {
    if (!config.webhookUrl) throw new Error("webhookUrl no configurado para el canal Webhook.");
    const res = await this.fetchWithTimeout(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(config.headers ?? {}) },
      body: JSON.stringify({
        title,
        message: body.text,
        severity: body.severity,
        sentAt: new Date().toISOString(),
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Webhook respondió ${res.status}: ${txt.substring(0, 200)}`);
    }
    return `webhook-${Date.now()}`;
  }

  private static async deliverPagerDuty(
    config: ChannelConfig,
    title: string,
    body: { text: string; severity: string }
  ): Promise<string | undefined> {
    if (!config.routingKey) throw new Error("routingKey no configurada para el canal PagerDuty.");
    const severity = body.severity === "CRITICAL" ? "critical" : body.severity === "MAJOR" ? "error" : "warning";
    const res = await this.fetchWithTimeout("https://events.pagerduty.com/v2/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(config.headers ?? {}) },
      body: JSON.stringify({
        routing_key: config.routingKey,
        event_action: "trigger",
        dedup_key: bucketId(`${config.routingKey}|${title}`),
        payload: {
          summary: `${title} — ${body.text}`.substring(0, 1024),
          source: "nuevo-sis-monitoring",
          severity,
        },
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`PagerDuty respondió ${res.status}: ${txt.substring(0, 200)}`);
    }
    const json = (await res.json()) as { dedup_key?: string };
    return json.dedup_key;
  }

  /**
   * Cuerpo del mensaje Telegram (texto plano sin parse_mode para no requerir
   * escapado de markdown/HTML en títulos ni contenido dinámico).
   */
  public static formatTelegramMessage(title: string, body: { text: string; severity: string }): string {
    const header = `[${body.severity}] ${title}`;
    return body.text ? `${header}\n${body.text}` : header;
  }

  private static async deliverTelegram(
    config: ChannelConfig,
    title: string,
    body: { text: string; severity: string }
  ): Promise<string | undefined> {
    if (!config.botToken || !config.chatId) {
      throw new Error("Configuración Telegram incompleta (botToken y chatId requeridos).");
    }
    const res = await this.fetchWithTimeout(`https://api.telegram.org/bot${config.botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.chatId,
        text: this.formatTelegramMessage(title, body),
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Telegram respondió ${res.status}: ${txt.substring(0, 200)}`);
    }
    const json = (await res.json()) as { result?: { message_id?: number } };
    return json.result?.message_id ? `telegram-${json.result.message_id}` : `telegram-${Date.now()}`;
  }

  private static async deliverEmail(
    config: ChannelConfig,
    title: string,
    body: { text: string; severity: string }
  ): Promise<string | undefined> {
    const nodemailer = await import("nodemailer");
    if (!config.smtpHost || !config.toAddresses?.length) {
      throw new Error("Configuración SMTP incompleta (host y toAddresses requeridos).");
    }
    const transporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort ?? 587,
      secure: config.smtpSecure ?? false,
      auth: config.smtpUser
        ? { user: config.smtpUser, pass: config.smtpPassword ?? "" }
        : undefined,
    });
    const info = await transporter.sendMail({
      from: config.fromAddress ?? config.smtpUser ?? "monitoreo@localhost",
      to: config.toAddresses.join(", "),
      subject: `[${body.severity}] ${title}`,
      text: body.text,
    });
    return info.messageId;
  }
}
