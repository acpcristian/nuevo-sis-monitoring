import { Client } from "ssh2";
import { CheckResultStatus } from "@/core/domain/server.types";

/**
 * Probe de ejecución del agente recolector (`scripts/nexo_agent.sh`) sobre SSH.
 *
 * A diferencia de `SshProbe` (solo handshake), esta clase abre un canal `exec`
 * de una sola vez: escribe el script por stdin de `bash -s`, recolecta stdout
 * (donde el agente imprime SOLO JSON estricto) y stderr (diagnóstico), y
 * devuelve el transcript completo. Es un flujo de solo lectura: el script no
 * modifica nada en el servidor remoto.
 */
export interface SshAgentProbeParams {
  host: string;
  port: number;
  username: string;
  /** Contenido íntegro de nexo_agent.sh (se transmite por stdin, no se instala en el remoto). */
  script: string;
  privateKey?: string;
  passphrase?: string;
  password?: string;
  /** Timeout del handshake SSH (negociación + auth). Por defecto 6000 ms. */
  connectTimeoutMs?: number;
  /** Timeout global del flujo (handshake + ejecución remota). Por defecto 25000 ms. */
  execTimeoutMs?: number;
}

export interface SshAgentProbeResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  status: CheckResultStatus;
  durationMs: number;
  diagnosticSummary: string;
}

const LIMITE_STDOUT_BYTES = 512 * 1024; // 512 KB: el JSON del agente nunca debería rondar esto.

export class SshAgentProbe {
  public static async runRemoteScript(params: SshAgentProbeParams): Promise<SshAgentProbeResult> {
    const connectTimeoutMs = params.connectTimeoutMs ?? 6000;
    const execTimeoutMs = params.execTimeoutMs ?? 25000;
    const startTime = Date.now();

    return new Promise<SshAgentProbeResult>((resolve) => {
      const conn = new Client();
      let resolved = false;
      let stdout = "";
      let stdoutRecortado = false;
      let stderr = "";

      const finish = (result: {
        ok: boolean;
        stdout: string;
        stderr: string;
        status: CheckResultStatus;
        diagnosticSummary: string;
      }) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          try {
            conn.end();
          } catch {
            // Ignorar errores al cerrar
          }
          resolve({
            ok: result.ok,
            stdout: result.stdout,
            stderr: result.stderr,
            status: result.status,
            durationMs: Date.now() - startTime,
            diagnosticSummary: result.diagnosticSummary,
          });
        }
      };

      const timer = setTimeout(() => {
        finish({
          ok: false,
          stdout,
          stderr,
          status: "TIMEOUT",
          diagnosticSummary: `Tiempo de espera agotado (${execTimeoutMs} ms) para ejecutar el agente en ${params.host}:${params.port}`,
        });
      }, execTimeoutMs);

      conn
        .on("ready", () => {
          conn.exec("bash -s -u", (err, stream) => {
            if (err) {
              finish({
                ok: false,
                stdout,
                stderr,
                status: "ERROR",
                diagnosticSummary: `No se pudo abrir el canal de ejecución remota: ${err.message}`,
              });
              return;
            }

            stream.on("data", (chunk: Buffer) => {
              if (stdout.length < LIMITE_STDOUT_BYTES) {
                stdout += chunk.toString("utf8");
              } else if (!stdoutRecortado) {
                stdoutRecortado = true;
              }
            });

            stream.stderr.on("data", (chunk: Buffer) => {
              stderr += chunk.toString("utf8");
            });

            stream.on("error", (streamErr: Error) => {
              finish({
                ok: false,
                stdout,
                stderr,
                status: "ERROR",
                diagnosticSummary: `Error durante la ejecución del agente: ${streamErr.message}`,
              });
            });

            stream.on("close", (code: number | null) => {
              if (stdoutRecortado) {
                finish({
                  ok: false,
                  stdout,
                  stderr,
                  status: "ERROR",
                  diagnosticSummary: `El stdout del agente excedió ${LIMITE_STDOUT_BYTES} bytes; se descarta por seguridad.`,
                });
                return;
              }
              if (code !== 0) {
                finish({
                  ok: false,
                  stdout,
                  stderr,
                  status: "ERROR",
                  diagnosticSummary: `El agente terminó con código de salida ${code ?? "desconocido"}.`,
                });
                return;
              }
              finish({
                ok: true,
                stdout,
                stderr,
                status: "SUCCESS",
                diagnosticSummary: `Agente recolector ejecutado exitosamente en ${params.host}:${params.port} (exit 0, stdout ${stdout.length} bytes)`,
              });
            });

            // Se alimenta el script por stdin y se cierra: `bash -s` lo ejecuta íntegro.
            stream.end(params.script);
          });
        })
        .on("error", (err: Error & { level?: string; code?: string }) => {
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
            ok: false,
            stdout,
            stderr,
            status,
            diagnosticSummary: `Fallo SSH (agente): ${err.message}`,
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
          readyTimeout: connectTimeoutMs,
        });
      } catch (err: unknown) {
        finish({
          ok: false,
          stdout,
          stderr,
          status: "ERROR",
          diagnosticSummary: `Error al iniciar cliente SSH del agente: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    });
  }
}
