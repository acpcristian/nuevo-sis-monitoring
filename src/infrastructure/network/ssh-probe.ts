import { Client } from "ssh2";
import { CheckResultStatus } from "@/core/domain/server.types";

export interface SshProbeParams {
  host: string;
  port: number;
  username: string;
  privateKey?: string;
  passphrase?: string;
  password?: string;
  timeoutMs?: number;
}

export interface ProbeResult {
  status: CheckResultStatus;
  durationMs: number;
  diagnosticSummary: string;
}

export class SshProbe {
  /**
   * Ejecuta una comprobación de conectividad remota no intrusiva sobre SSH (solo lectura).
   * Negocia el handshake y cierra la sesión de inmediato sin ejecutar comandos modificadores.
   */
  public static async probe(params: SshProbeParams): Promise<ProbeResult> {
    const timeoutMs = params.timeoutMs ?? 5000;
    const startTime = Date.now();

    return new Promise<ProbeResult>((resolve) => {
      const conn = new Client();
      let resolved = false;

      const finish = (result: ProbeResult) => {
        if (!resolved) {
          resolved = true;
          try {
            conn.end();
          } catch {
            // Ignorar errores al cerrar
          }
          resolve(result);
        }
      };

      const timer = setTimeout(() => {
        finish({
          status: "TIMEOUT",
          durationMs: Date.now() - startTime,
          diagnosticSummary: `Tiempo de espera agotado (${timeoutMs} ms) conectando a ${params.host}:${params.port}`,
        });
      }, timeoutMs);

      conn
        .on("ready", () => {
          clearTimeout(timer);
          const durationMs = Date.now() - startTime;
          finish({
            status: "SUCCESS",
            durationMs,
            diagnosticSummary: `Conexión SSH autenticada exitosamente en ${durationMs} ms (solo lectura)`,
          });
        })
        .on("error", (err: Error & { level?: string; code?: string }) => {
          clearTimeout(timer);
          const durationMs = Date.now() - startTime;
          const msg = err.message || "";

          let status: CheckResultStatus = "ERROR";
          if (msg.includes("Authentication") || err.level === "client-authentication") {
            status = "AUTH_ERROR";
          } else if (err.code === "ECONNREFUSED" || msg.includes("ECONNREFUSED")) {
            status = "REFUSED";
          } else if (err.code === "ETIMEDOUT" || msg.includes("ETIMEDOUT")) {
            status = "TIMEOUT";
          }

          finish({
            status,
            durationMs,
            diagnosticSummary: `Fallo SSH: ${err.message}`,
          });
        });

      try {
        conn.connect({
          host: params.host,
          port: params.port || 22,
          username: params.username,
          privateKey: params.privateKey,
          passphrase: params.passphrase,
          password: params.password,
          readyTimeout: timeoutMs,
          // Restricción: no abrir shells interactivas ni túneles
        });
      } catch (err: unknown) {
        clearTimeout(timer);
        finish({
          status: "ERROR",
          durationMs: Date.now() - startTime,
          diagnosticSummary: `Error al iniciar cliente SSH: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    });
  }
}

