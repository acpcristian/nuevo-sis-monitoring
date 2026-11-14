import { NextRequest, NextResponse } from "next/server";
import { McpService } from "@/core/services/mcp.service";
import { IntegrationKeyService } from "@/core/services/integration-key.service";
import { AuditService } from "@/core/services/audit.service";

/**
 * POST /api/v1/mcp — Servidor MCP (HTTP Streamable, estadoless).
 *
 * Autenticación: `Authorization: Bearer nxs_...` (clave de servicio, hash
 * SHA-256 en BD). Sin cookie de sesión: está pensado para agentes externos.
 * Registra UNAUTHORIZED_ATTEMPT solo cuando se presentó una clave inválida
 * (no cuando simplemente falta el header), para no llenar la auditoría de
 * ruido de bots que escanean endpoints públicos.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await authenticate(request);
    if ("response" in auth) {
      return auth.response;
    }

    const rawBody = await request.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody.length ? rawBody : "{}");
    } catch {
      return NextResponse.json(
        { jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido." } },
        { status: 400 }
      );
    }

    const result = await McpService.handleRequest(parsed, { keyName: auth.keyName });
    return NextResponse.json(result.body, { status: result.httpStatus });
  } catch (error) {
    console.error("Error en POST /api/v1/mcp:", error);
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32603, message: "Error interno del servidor MCP." } },
      { status: 500 }
    );
  }
}

/** GET no soportado: el servidor es estadoless (no expone stream SSE). */
export async function GET() {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32000, message: "Servidor MCP estadoless: use POST con JSON-RPC 2.0." },
    },
    { status: 405 }
  );
}

/** DELETE de sesión no aplica (estadoless). */
export async function DELETE() {
  return new NextResponse(null, { status: 204 });
}

async function authenticate(
  request: NextRequest
): Promise<{ keyName: string } | { response: NextResponse }> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);

  if (!match || !match[1]) {
    return {
      response: NextResponse.json(
        { error_code: "UNAUTHORIZED", message: "Autenticación Bearer requerida (clave de servicio)." },
        { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="nuevo-sis-mcp"' } }
      ),
    };
  }

  const key = await IntegrationKeyService.verifyKey(match[1].trim());
  if (!key) {
    // Clave presentada pero inválida o revocada → intento sospechoso.
    await AuditService.recordEvent({
      userId: "desconocido",
      action: "UNAUTHORIZED_ATTEMPT",
      detailsDiff: { endpoint: "/api/v1/mcp", reason: "API key de servicio inválida o revocada" },
      ipAddress: request.headers.get("x-forwarded-for") ?? null,
    });
    return {
      response: NextResponse.json(
        { error_code: "UNAUTHORIZED", message: "Clave de servicio inválida o revocada." },
        { status: 401 }
      ),
    };
  }

  // El nombre de la clave es la trazabilidad del actor externo.
  const keyName = key.name;
  return { keyName };
}
