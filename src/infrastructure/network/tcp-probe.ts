import net from "node:net";

export type TcpProbeStatus = "SUCCESS" | "REFUSED" | "TIMEOUT" | "ERROR";

export interface TcpProbeParams {
  host: string;
  port: number;
  /** Tiempo máximo total del sondeo. El socket se destruye al vencer. */
  timeoutMs?: number;
}

export interface TcpProbeResult {
  status: TcpProbeStatus;
  durationMs: number;
  diagnosticSummary: string;
}

/**
 * Sondeo TCP de solo lectura.
 *
 * Se usa para verificar disponibilidad de un host o de un puerto de servicio sin
 * ejecutar comandos remotos ni requerir privilegios de ICMP. Implementa dos
 * protecciones independientes para no bloquear el request:
 * 1. `socket.setTimeout` corta la inactividad del socket.
 * 2. Un `setTimeout` externo corta el intento completo, incluso si el handshake
 *    TCP queda pendiente por un firewall que descarta paquetes (SYN drop).
 */
export class TcpProbe {
  public static probe(params: TcpProbeParams): Promise<TcpProbeResult> {
    const timeoutMs = Math.max(500, params.timeoutMs ?? 3000);
    const startedAt = Date.now();

    return new Promise<TcpProbeResult>((resolve) => {
      const socket = new net.Socket();
      let settled = false;
      let timer: NodeJS.Timeout | null = null;

      const finish = (result: TcpProbeResult) => {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        // Se eliminan listeners antes de destruir para que un error tardío no
        // vuelva a resolver la promesa ni genere un unhandled error.
        socket.removeAllListeners();
        // Tras destruir, un error tardío del socket no debe tumbar el proceso.
        socket.on("error", () => undefined);
        socket.destroy();
        resolve(result);
      };

      const elapsed = () => Date.now() - startedAt;

      timer = setTimeout(() => {
        finish({
          status: "TIMEOUT",
          durationMs: elapsed(),
          diagnosticSummary: `Tiempo de espera agotado (${timeoutMs} ms) conectando a ${params.host}:${params.port}`,
        });
      }, timeoutMs);

      socket.setTimeout(timeoutMs);

      socket.once("connect", () => {
        finish({
          status: "SUCCESS",
          durationMs: elapsed(),
          diagnosticSummary: `Puerto TCP ${params.port} accesible en ${elapsed()} ms`,
        });
      });

      socket.once("timeout", () => {
        finish({
          status: "TIMEOUT",
          durationMs: elapsed(),
          diagnosticSummary: `Tiempo de espera agotado (${timeoutMs} ms) conectando a ${params.host}:${params.port}`,
        });
      });

      socket.once("error", (error: Error & { code?: string }) => {
        const code = error.code ?? "";

        if (code === "ECONNREFUSED") {
          finish({
            status: "REFUSED",
            durationMs: elapsed(),
            diagnosticSummary: `Conexión rechazada en ${params.host}:${params.port} (servicio detenido o puerto cerrado)`,
          });
          return;
        }

        if (code === "ETIMEDOUT") {
          finish({
            status: "TIMEOUT",
            durationMs: elapsed(),
            diagnosticSummary: `Tiempo de espera agotado (${timeoutMs} ms) conectando a ${params.host}:${params.port}`,
          });
          return;
        }

        finish({
          status: "ERROR",
          durationMs: elapsed(),
          diagnosticSummary: `Error de red conectando a ${params.host}:${params.port}: ${error.message}`,
        });
      });

      try {
        socket.connect({ host: params.host, port: params.port });
      } catch (error: unknown) {
        finish({
          status: "ERROR",
          durationMs: elapsed(),
          diagnosticSummary: `Error iniciando socket TCP: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    });
  }
}
