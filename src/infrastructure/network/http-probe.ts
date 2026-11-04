export type HttpProbeStatus = "SUCCESS" | "REFUSED" | "TIMEOUT" | "BLOCKED" | "ERROR";

export interface HttpProbeParams {
  url: string;
  /**
   * Hosts permitidos para el health check. Debe contener la IP y/o el hostname
   * del servidor registrado. Evita SSRF hacia la red interna del contenedor o
   * hacia servicios de metadatos.
   */
  allowedHosts: string[];
  timeoutMs?: number;
}

export interface HttpProbeResult {
  status: HttpProbeStatus;
  httpStatus?: number;
  durationMs: number;
  diagnosticSummary: string;
}

function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
}

/**
 * Comprobación HTTP(S) de un health endpoint, ejecutada exclusivamente en el
 * backend. Sigue estas reglas de seguridad y resiliencia:
 * - Solo http/https, sin credenciales embebidas en la URL.
 * - El host debe pertenecer al servidor monitoreado (anti-SSRF).
 * - Sin redirecciones automáticas: un 3xx se reporta como error para impedir
 *   que un endpoint permitido redirija a un host no autorizado.
 * - Timeout duro con AbortController; nunca bloquea el hilo del request.
 */
export class HttpProbe {
  public static async probe(params: HttpProbeParams): Promise<HttpProbeResult> {
    const timeoutMs = Math.max(500, params.timeoutMs ?? 3000);
    const startedAt = Date.now();

    let url: URL;
    try {
      url = new URL(params.url);
    } catch {
      return {
        status: "ERROR",
        durationMs: Date.now() - startedAt,
        diagnosticSummary: "Endpoint inválido: no es una URL absoluta.",
      };
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return {
        status: "ERROR",
        durationMs: Date.now() - startedAt,
        diagnosticSummary: `Protocolo no permitido: ${url.protocol}. Solo se admite http/https.`,
      };
    }

    if (url.username || url.password) {
      return {
        status: "ERROR",
        durationMs: Date.now() - startedAt,
        diagnosticSummary: "El endpoint no debe incluir credenciales embebidas en la URL.",
      };
    }

    const allowedHosts = new Set(params.allowedHosts.map(normalizeHost));
    // Los alias de loopback son equivalentes entre sí. No se amplía el permiso
    // a ninguna otra IP/hostname, así que no se abre la puerta a SSRF.
    if (
      allowedHosts.has("127.0.0.1") ||
      allowedHosts.has("::1") ||
      allowedHosts.has("localhost")
    ) {
      allowedHosts.add("127.0.0.1");
      allowedHosts.add("::1");
      allowedHosts.add("localhost");
    }

    if (!allowedHosts.has(normalizeHost(url.hostname))) {
      return {
        status: "BLOCKED",
        durationMs: Date.now() - startedAt,
        diagnosticSummary: `Endpoint bloqueado: el host '${url.hostname}' no coincide con la IP/hostname del servidor monitoreado.`,
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url.toString(), {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        cache: "no-store",
        headers: {
          Accept: "application/json, text/plain, */*",
          "User-Agent": "SIS-Monitor/1.0 (+read-only-healthcheck)",
        },
      });

      const durationMs = Date.now() - startedAt;
      // Se libera el socket sin descargar cuerpos grandes.
      await response.body?.cancel().catch(() => undefined);

      if (response.status >= 200 && response.status < 300) {
        return {
          status: "SUCCESS",
          httpStatus: response.status,
          durationMs,
          diagnosticSummary: `Health endpoint respondió HTTP ${response.status} en ${durationMs} ms`,
        };
      }

      if (response.status >= 300 && response.status < 400) {
        return {
          status: "ERROR",
          httpStatus: response.status,
          durationMs,
          diagnosticSummary: `HTTP ${response.status}: redirecciones no permitidas en health checks`,
        };
      }

      return {
        status: "ERROR",
        httpStatus: response.status,
        durationMs,
        diagnosticSummary: `Health endpoint respondió HTTP ${response.status} en ${durationMs} ms`,
      };
    } catch (error: unknown) {
      const durationMs = Date.now() - startedAt;

      if (controller.signal.aborted) {
        return {
          status: "TIMEOUT",
          durationMs,
          diagnosticSummary: `Tiempo de espera agotado (${timeoutMs} ms) consultando ${url.hostname}`,
        };
      }

      const cause = (error as { cause?: { code?: string } })?.cause;
      if (cause?.code === "ECONNREFUSED") {
        return {
          status: "REFUSED",
          durationMs,
          diagnosticSummary: `Conexión rechazada en ${url.hostname} (servicio detenido o puerto cerrado)`,
        };
      }

      return {
        status: "ERROR",
        durationMs,
        diagnosticSummary: `Error consultando health endpoint: ${error instanceof Error ? error.message : String(error)}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
