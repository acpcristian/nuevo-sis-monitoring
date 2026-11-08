import { Client } from "ssh2";
import { prisma } from "@/infrastructure/db/prisma";
import { SecretVault } from "@/infrastructure/crypto/secret-vault";
import { NotFoundError } from "@/shared/errors/domain-errors";

export type ServiceControlAction = "start" | "stop" | "restart" | "enable" | "disable";

export interface ServiceControlResult {
  ok: boolean;
  action: ServiceControlAction;
  serviceName: string;
  output: string;
  error?: string;
  newStatus?: "RUNNING" | "STOPPED" | "ERROR" | "UNKNOWN";
}

// Lista blanca estricta de nombres de servicios válidos para evitar inyección
const VALID_SERVICE_NAME_RE = /^[a-zA-Z0-9_@.-]+$/;

export class ServiceControlService {
  public static async executeAction(
    serverId: string,
    serviceId: string,
    action: ServiceControlAction
  ): Promise<ServiceControlResult> {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
      include: { credential: true },
    });

    if (!server) throw new NotFoundError("Servidor");

    const service = await prisma.serverService.findUnique({
      where: { id: serviceId, serverId },
    });

    if (!service) throw new NotFoundError("Servicio");

    const serviceName = service.name.trim();
    if (!VALID_SERVICE_NAME_RE.test(serviceName)) {
      throw new Error(`Nombre de servicio no permitido: ${serviceName}`);
    }

    if (!server.credential) {
      throw new Error("El servidor no tiene credenciales configuradas para ejecutar acciones.");
    }

    const cred = server.credential;
    const secret = SecretVault.decryptSecret(
      cred.encryptedPayload,
      cred.iv,
      cred.authTag
    );

    const isDocker = service.description?.includes("/") || !serviceName.endsWith(".service");

    const isPasswordAuth = cred.credentialType === "PASSWORD";
    const sudoPrefix = isPasswordAuth && secret
      ? `echo '${secret.replace(/'/g, "'\\''")}' | sudo -S -p ''`
      : "sudo -n";

    let cmd = "";
    if (isDocker && !serviceName.endsWith(".service")) {
      switch (action) {
        case "start":
          cmd = `docker start ${serviceName} || ${sudoPrefix} docker start ${serviceName}`;
          break;
        case "stop":
          cmd = `docker stop ${serviceName} || ${sudoPrefix} docker stop ${serviceName}`;
          break;
        case "restart":
          cmd = `docker restart ${serviceName} || ${sudoPrefix} docker restart ${serviceName}`;
          break;
        case "enable":
          cmd = `docker update --restart=always ${serviceName} || ${sudoPrefix} docker update --restart=always ${serviceName}`;
          break;
        case "disable":
          cmd = `docker update --restart=no ${serviceName} || ${sudoPrefix} docker update --restart=no ${serviceName}`;
          break;
      }
    } else {
      // systemd
      switch (action) {
        case "start":
          cmd = `systemctl start ${serviceName} || ${sudoPrefix} systemctl start ${serviceName}`;
          break;
        case "stop":
          cmd = `systemctl stop ${serviceName} || ${sudoPrefix} systemctl stop ${serviceName}`;
          break;
        case "restart":
          cmd = `systemctl restart ${serviceName} || ${sudoPrefix} systemctl restart ${serviceName}`;
          break;
        case "enable":
          cmd = `systemctl enable ${serviceName} || ${sudoPrefix} systemctl enable ${serviceName}`;
          break;
        case "disable":
          cmd = `systemctl disable ${serviceName} || ${sudoPrefix} systemctl disable ${serviceName}`;
          break;
      }
    }

    return new Promise<ServiceControlResult>((resolve) => {
      const conn = new Client();
      let stdout = "";
      let stderr = "";
      let resolved = false;

      const finish = (result: ServiceControlResult) => {
        if (!resolved) {
          resolved = true;
          try {
            conn.end();
          } catch {
            // Ignorar
          }
          resolve(result);
        }
      };

      const timer = setTimeout(() => {
        finish({
          ok: false,
          action,
          serviceName,
          output: stdout,
          error: "Tiempo de espera agotado al ejecutar acción.",
        });
      }, 15000);

      conn
        .on("ready", () => {
          conn.exec(cmd, { pty: true }, (err, stream) => {
            if (err) {
              clearTimeout(timer);
              finish({
                ok: false,
                action,
                serviceName,
                output: "",
                error: `Error al invocar comando: ${err.message}`,
              });
              return;
            }

            stream.on("data", (chunk: Buffer) => {
              stdout += chunk.toString("utf8");
            });

            stream.stderr.on("data", (chunk: Buffer) => {
              stderr += chunk.toString("utf8");
            });

            stream.on("close", async (code: number | null) => {
              clearTimeout(timer);
              const ok = code === 0;

              let nextStatus = service.status;
              if (ok) {
                if (action === "start" || action === "restart") {
                  nextStatus = "RUNNING";
                } else if (action === "stop") {
                  nextStatus = "STOPPED";
                }
                await prisma.serverService.update({
                  where: { id: service.id },
                  data: {
                    status: nextStatus,
                    lastCheckedAt: new Date(),
                    lastResult: `Acción '${action}' ejecutada con éxito.`,
                  },
                });
              }

              finish({
                ok,
                action,
                serviceName,
                output: stdout.trim(),
                error: ok ? undefined : stderr.trim() || `Código de salida: ${code}`,
                newStatus: nextStatus,
              });
            });
          });
        })
        .on("error", (err: Error) => {
          clearTimeout(timer);
          finish({
            ok: false,
            action,
            serviceName,
            output: "",
            error: `Conexión SSH falló: ${err.message}`,
          });
        });

      try {
        conn.connect({
          host: server.ipAddress,
          port: server.connectionPort || 22,
          username: cred.username,
          privateKey: cred.credentialType === "SSH_KEY" ? secret : undefined,
          password: cred.credentialType === "PASSWORD" ? secret : undefined,
          readyTimeout: 7000,
        });
      } catch (err: unknown) {
        clearTimeout(timer);
        finish({
          ok: false,
          action,
          serviceName,
          output: "",
          error: `Error de configuración SSH: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    });
  }
}
