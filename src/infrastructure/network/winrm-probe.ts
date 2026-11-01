import net from "node:net";
import { CheckResultStatus } from "@/core/domain/server.types";
import { ProbeResult } from "./ssh-probe";

export interface WinrmProbeParams {
  host: string;
  port: number;
  timeoutMs?: number;
}

export class WinrmProbe {
  /**
   * Ejecuta una comprobación de conectividad TCP segura sobre el puerto WinRM (5986/5985)
   * o servicio de agente en Windows Server con timeout estricto de solo lectura.
   */
  public static async probe(params: WinrmProbeParams): Promise<ProbeResult> {
    const timeoutMs = params.timeoutMs ?? 5000;
    const startTime = Date.now();

    return new Promise<ProbeResult>((resolve) => {
      const socket = new net.Socket();
      let resolved = false;

      const finish = (result: ProbeResult) => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(result);
        }
      };

      socket.setTimeout(timeoutMs);

      socket.on("connect", () => {
        const durationMs = Date.now() - startTime;
        finish({
          status: "SUCCESS",
          durationMs,
          diagnosticSummary: `Puerto WinRM/TCP ${params.port} accesible en ${durationMs} ms`,
        });
      });

      socket.on("timeout", () => {
        finish({
          status: "TIMEOUT",
          durationMs: Date.now() - startTime,
          diagnosticSummary: `Tiempo de espera agotado (${timeoutMs} ms) conectando a ${params.host}:${params.port}`,
        });
      });

      socket.on("error", (err: Error & { code?: string }) => {
        const durationMs = Date.now() - startTime;
        let status: CheckResultStatus = "ERROR";

        if (err.code === "ECONNREFUSED") {
          status = "REFUSED";
        } else if (err.code === "ETIMEDOUT") {
          status = "TIMEOUT";
        }

        finish({
          status,
          durationMs,
          diagnosticSummary: `Fallo de conexión WinRM/TCP: ${err.message}`,
        });
      });

      try {
        socket.connect(params.port || 5986, params.host);
      } catch (err: unknown) {
        finish({
          status: "ERROR",
          durationMs: Date.now() - startTime,
          diagnosticSummary: `Error iniciando socket: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    });
  }
}

