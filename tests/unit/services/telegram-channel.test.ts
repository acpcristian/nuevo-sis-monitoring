import { describe, it, expect } from "vitest";
import { ChannelTypeSchema, ChannelCreateSchema } from "@/shared/validations/notification.schema";
import { NotificationService } from "@/core/services/notification.service";

describe("Canal TELEGRAM", () => {
  it("ChannelTypeSchema acepta TELEGRAM", () => {
    expect(ChannelTypeSchema.safeParse("TELEGRAM").success).toBe(true);
    expect(ChannelTypeSchema.safeParse("TELEGRAMA").success).toBe(false);
  });

  it("ChannelCreateSchema acepta config de Telegram con botToken y chatId", () => {
    const parsed = ChannelCreateSchema.safeParse({
      type: "TELEGRAM",
      name: "telegram-operaciones",
      config: { botToken: "123456:ABC-DEF", chatId: "884382309" },
      categories: [],
    });
    expect(parsed.success).toBe(true);
  });

  it("formatTelegramMessage arma el encabezado de severidad + título + cuerpo", () => {
    const text = NotificationService.formatTelegramMessage("Pool de conexiones agotado", {
      text: "El servidor DB-01 reporta 45 eventos ERROR en 5 minutos.",
      severity: "CRITICAL",
    });
    expect(text).toContain("[CRITICAL]");
    expect(text).toContain("Pool de conexiones agotado");
    expect(text).toContain("El servidor DB-01 reporta");
  });

  it("formatTelegramMessage sin cuerpo devuelve solo el encabezado", () => {
    const text = NotificationService.formatTelegramMessage("Chequeo programado", {
      text: "",
      severity: "INFO",
    });
    expect(text).toBe("[INFO] Chequeo programado");
  });
});
