import { NextRequest, NextResponse } from "next/server";

/** Payload esperado en el body de la petición. */
interface TelegramNotificationPayload {
  /** Texto del mensaje a enviar (máx 4096 caracteres según API de Telegram). */
  message: string;
  /** Nombre opcional del usuario/emisor para incluir en el mensaje. */
  userName?: string;
}

/** Respuesta de la API de Telegram. */
interface TelegramApiResponse {
  ok: boolean;
  result?: {
    message_id: number;
    date: number;
    chat: { id: number; type: string };
  };
  error_code?: number;
  description?: string;
}

/**
 * POST /api/telegram
 * Envía una notificación a Telegram usando la API oficial de Bot.
 * Requiere variables de entorno: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Validar variables de entorno requeridas
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
      console.error("[Telegram] Variables de entorno faltantes: TELEGRAM_BOT_TOKEN y/o TELEGRAM_CHAT_ID");
      return NextResponse.json(
        {
          error_code: "CONFIGURATION_ERROR",
          message: "Servicio de Telegram no configurado. Contacte al administrador.",
        },
        { status: 500 }
      );
    }

    // 2. Parsear y validar body
    let payload: TelegramNotificationPayload;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json(
        { error_code: "INVALID_JSON", message: "Cuerpo de la petición inválido (JSON mal formado)." },
        { status: 400 }
      );
    }

    const { message, userName } = payload;

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json(
        { error_code: "VALIDATION_ERROR", message: "El campo 'message' es obligatorio y no puede estar vacío." },
        { status: 400 }
      );
    }

    if (message.length > 4096) {
      return NextResponse.json(
        { error_code: "VALIDATION_ERROR", message: "El mensaje excede el límite de 4096 caracteres de Telegram." },
        { status: 400 }
      );
    }

    // 3. Construir texto final con nombre de usuario opcional
    const finalMessage = userName ? `🔔 <b>${escapeHtml(userName)}</b>:\n${escapeHtml(message)}` : escapeHtml(message);

    // 4. Llamar a la API de Telegram
    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await fetch(telegramUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: finalMessage,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const data: TelegramApiResponse = await response.json();

    if (!data.ok) {
      console.error("[Telegram] Error de API:", data.description, `(code: ${data.error_code})`);
      return NextResponse.json(
        {
          error_code: "TELEGRAM_API_ERROR",
          message: `Error al enviar a Telegram: ${data.description ?? "Error desconocido"}`,
        },
        { status: 502 }
      );
    }

    // 5. Respuesta exitosa
    return NextResponse.json(
      {
        success: true,
        messageId: data.result?.message_id,
        timestamp: data.result?.date,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    // 6. Manejo de errores inesperados (red, timeout, etc.)
    const errorMessage = error instanceof Error ? error.message : "Error desconocido";
    console.error("[Telegram] Excepción no controlada:", errorMessage, error);

    return NextResponse.json(
      { error_code: "INTERNAL_ERROR", message: "Error interno al procesar la notificación." },
      { status: 500 }
    );
  }
}

/**
 * Escapa caracteres HTML para prevenir inyección en parse_mode=HTML.
 * Telegram requiere escapar: < > & "
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}