import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/infrastructure/db/prisma";
import { SecretVault } from "@/infrastructure/crypto/secret-vault";
import { SshAgentProbe } from "@/infrastructure/network/ssh-agent-probe";
import {
  contarSeccion,
  mapAgentPayloadToServiceCandidates,
  parseAgentJson,
} from "./agent-payload-mapper";
import { NotFoundError } from "@/shared/errors/domain-errors";

/**
 * Descubrimiento de servicios mediante el agente SSH de solo lectura
 * (`scripts/nexo_agent.sh`). Se ejecuta ÚNICAMENTE a demanda —creación del
 * servidor, prueba de conexión exitosa, rotación de credencial o endpoint
 * manual— y jamás dentro del tick periódico del monitor.
 *
 * Flujo: cargar script → conectar SSH → `bash -s` (stdout = JSON estricto)
 * → validar y mapear → upsert en `ServerService` por clave (serverId, name).
 */
export interface DiscoveryOutcome {
  ok: boolean;
  /** Motivo legible del estado (éxito o por qué no se ejecutó el escaneo). */
  motivo: string;
  /** Resumen del diagnóstico SSH de bajo nivel (stderr/timeout/json corrupto). */
  diagnosticSummary: string;
  metricas: {
    docker: number;
    systemd: number;
    /** Servicios efectivamente persistidos (upsert). */
    persistidos: number;
  };
}

const RUTA_AGENTE = path.join(process.cwd(), "scripts", "nexo_agent.sh");
const AGENTES_EN_VUELO = new Set<string>(); // guard contra escaneos simultáneos del mismo servidor

let scriptCache: string | null = null;

function cargarScriptAgente(): { ok: true; script: string } | { ok: false; motivo: string } {
  if (scriptCache !== null) {
    return { ok: true, script: scriptCache };
  }
  try {
    scriptCache = fs.readFileSync(RUTA_AGENTE, "utf8");
    if (scriptCache.trim().length === 0) {
      scriptCache = null;
      return { ok: false, motivo: "El script del agente está vacío en el despliegue." };
    }
    return { ok: true, script: scriptCache };
  } catch {
    return { ok: false, motivo: "El script del agente no está disponible en el despliegue." };
  }
}

function vacio(motivo: string, diagnosticSummary = ""): DiscoveryOutcome {
  return {
    ok: false,
    motivo,
    diagnosticSummary,
    metricas: { docker: 0, systemd: 0, persistidos: 0 },
  };
}

interface ParametrosConexionAgente {
  serverId: string;
  ipAddress: string;
  connectionPort: number;
  username: string;
  privateKey?: string;
  password?: string;
}

/**
 * Núcleo compartido: ejecuta el agente, valida el JSON estricto y persiste
 * los servicios vía doble upsert por (serverId, name). Los servicios
 * administrados manualmente por el operador nunca se eliminan de la BD.
 */
async function ejecutarEscaneo(params: ParametrosConexionAgente): Promise<DiscoveryOutcome> {
  const script = cargarScriptAgente();
  if (!script.ok) {
    return vacio(script.motivo);
  }

  const probe = await SshAgentProbe.runRemoteScript({
    host: params.ipAddress,
    port: params.connectionPort || 22,
    username: params.username,
    script: script.script,
    privateKey: params.privateKey,
    password: params.password,
  });

  if (!probe.ok) {
    return vacio("Fallo al ejecutar el agente en el servidor remoto.", probe.diagnosticSummary);
  }

  const payload = parseAgentJson(probe.stdout);
  if (!payload) {
    return vacio(
      "El agente no produjo JSON estricto; la shell remota puede haber contaminado el stdout.",
      probe.stdout.slice(0, 400) || probe.diagnosticSummary
    );
  }

  const candidatos = mapAgentPayloadToServiceCandidates(payload);
  const lastCheckedAt = new Date();
  let persistidos = 0;

  for (const candidato of candidatos) {
    await prisma.serverService.upsert({
      where: { serverId_name: { serverId: params.serverId, name: candidato.name } },
      create: {
        serverId: params.serverId,
        name: candidato.name,
        status: candidato.status,
        description: candidato.description,
        port: candidato.port,
        processName: candidato.processName,
        lastCheckedAt,
      },
      update: {
        status: candidato.status,
        description: candidato.description,
        port: candidato.port,
        processName: candidato.processName,
        lastCheckedAt,
      },
    });
    persistidos += 1;
  }

  const docker = contarSeccion(payload.servicios_docker, "nombre");
  const systemd = contarSeccion(payload.servicios_systemd, "nombre");

  return {
    ok: true,
    motivo: `Escaneo completado: ${persistidos} servicios descubiertos (${docker} Docker, ${systemd} systemd).`,
    diagnosticSummary: probe.diagnosticSummary,
    metricas: { docker, systemd, persistidos },
  };
}

export class AgentDiscoveryService {
  /**
   * Escanea el servidor con el agente recolector y persiste los servicios
   * descubiertos. Lanza NotFoundError si el servidor no existe; en el resto
   * de los casos devuelve un DiscoveryOutcome (sin propagar fallos del scan).
   */
  public static async discoverForServer(serverId: string): Promise<DiscoveryOutcome> {
    const server = await prisma.server.findUnique({
      where: { id: serverId },
      include: { credential: true },
    });

    if (!server) {
      throw new NotFoundError("Servidor");
    }

    if (AGENTES_EN_VUELO.has(serverId)) {
      return vacio("Ya hay un escaneo del agente en curso para este servidor.");
    }

    if (server.lifecycleState !== "ACTIVE") {
      return vacio("Servidor desincorporado; saltando el escaneo del agente.");
    }
    if (!server.credential) {
      return vacio("El servidor no tiene credencial registrada.");
    }
    if (server.osType !== "LINUX") {
      return vacio("El agente recolector solo aplica a servidores Linux.");
    }
    if (server.credential.credentialType !== "SSH_KEY" && server.credential.credentialType !== "PASSWORD") {
      return vacio(`Tipo de credencial no soportado por el agente: ${server.credential.credentialType}.`);
    }

    // Descifrar credencial solo en memoria, durante la ejecución (Principio III)
    const secret = SecretVault.decryptSecret(
      server.credential.encryptedPayload,
      server.credential.iv,
      server.credential.authTag
    );

    AGENTES_EN_VUELO.add(serverId);
    try {
      return await ejecutarEscaneo({
        serverId,
        ipAddress: server.ipAddress,
        connectionPort: server.connectionPort,
        username: server.credential.username,
        privateKey: server.credential.credentialType === "SSH_KEY" ? secret : undefined,
        password: server.credential.credentialType === "PASSWORD" ? secret : undefined,
      });
    } catch (error: unknown) {
      console.error(`Error inesperado en escaneo del agente para ${server.name}:`, error);
      const detalle = error instanceof Error ? error.message : String(error);
      return vacio("Error inesperado durante el escaneo del agente.", detalle);
    } finally {
      AGENTES_EN_VUELO.delete(serverId);
    }
  }

  /**
   * Variante para el flujo de creación de servidor: la credencial llega ya
   * en texto plano del request (sin descifrar de BD) y el servidor acaba
   * de crearse, así que aquí solo se ignora el guard de vuelo previo.
   */
  public static async discoverForNewServer(
    serverId: string,
    credencial: { username: string; secretValue: string; credentialType: "SSH_KEY" | "PASSWORD" },
    ficha: { ipAddress: string; connectionPort: number }
  ): Promise<DiscoveryOutcome> {
    if (AGENTES_EN_VUELO.has(serverId)) {
      return vacio("Ya hay un escaneo del agente en curso para este servidor.");
    }

    AGENTES_EN_VUELO.add(serverId);
    try {
      return await ejecutarEscaneo({
        serverId,
        ipAddress: ficha.ipAddress,
        connectionPort: ficha.connectionPort,
        username: credencial.username,
        privateKey: credencial.credentialType === "SSH_KEY" ? credencial.secretValue : undefined,
        password: credencial.credentialType === "PASSWORD" ? credencial.secretValue : undefined,
      });
    } catch (error: unknown) {
      console.error(`Error inesperado en escaneo del agente (servidor nuevo ${serverId}):`, error);
      const detalle = error instanceof Error ? error.message : String(error);
      return vacio("Error inesperado durante el escaneo del agente.", detalle);
    } finally {
      AGENTES_EN_VUELO.delete(serverId);
    }
  }
}
