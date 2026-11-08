import type { ServiceStatus } from "@prisma/client";

/**
 * Mapeo del JSON que produce `scripts/nexo_agent.sh` (agente SSH de solo lectura)
 * hacia las filas de `ServerService` que se persisten en el inventario.
 *
 * Las funciones de este módulo son PURAS (sin BD ni red) para poder
 * testearlas de forma aislada: el contrato depende del script del agente:
 *
 * {
 *   "servidor_info": { "uptime", "cpu_usage_percent", "ram_total_mb", "ram_used_mb" },
 *   "servicios_docker": [{ "nombre", "estado", "puertos", "imagen" }],
 *   "servicios_systemd": [{ "nombre", "estado", "descripcion" }]
 * }
 */

export interface AgenteContenedorDocker {
  nombre?: unknown;
  estado?: unknown;
  puertos?: unknown;
  imagen?: unknown;
}

export interface AgenteServicioSystemd {
  nombre?: unknown;
  estado?: unknown;
  /** Puertos en escucha: "0.0.0.0:80, [::]:80" (solo lectura vía ss/netstat). */
  puertos?: unknown;
  descripcion?: unknown;
}

export interface AgentePayload {
  servidor_info?: { uptime?: unknown; cpu_usage_percent?: unknown; ram_total_mb?: unknown; ram_used_mb?: unknown };
  servicios_docker?: unknown;
  servicios_systemd?: unknown;
}

export type OrigenAgente = "DOCKER" | "SYSTEMD";

export interface AgenteServicioCandidate {
  /** Nombre único por servidor (el upsert usa @@unique([serverId, name])). */
  name: string;
  status: ServiceStatus;
  description: string | null;
  port: number | null;
  processName: string | null;
  origen: OrigenAgente;
}

/** Extrae y valida el JSON estricto del stdout del agente. Devuelve null si es ilegible. */
export function parseAgentJson(stdout: string): AgentePayload | null {
  if (typeof stdout !== "string" || stdout.trim().length === 0) return null;
  try {
    // Limpieza mínima permitida: BOM utf8 inicial y espacios perimetrales.
    // Cualquier prefijo extra (ruido de shell) corrompe el parseo → null.
    const parsed: unknown = JSON.parse(stdout.replace(/^\uFEFF/, "").trim());
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as AgentePayload;
  } catch {
    return null;
  }
}

/** Cuenta unidades legibles de una sección del payload (para métricas del outcome). */
export function contarSeccion(valor: unknown, campoNombre: string): number {
  if (!Array.isArray(valor)) return 0;
  return valor.filter(
    (item) => typeof item === "object" && item !== null && typeof (item as Record<string, unknown>)[campoNombre] === "string"
  ).length;
}

/**
 * Mapea el estado textual del agente al enum ServiceStatus.
 * systemd: active→RUNNING, inactive→STOPPED, failed→ERROR.
 * Docker: running→RUNNING, exited/created/paused→STOPPED, dead→ERROR, otros→UNKNOWN.
 */
export function mapEstadoToServiceStatus(estado: unknown): ServiceStatus {
  const estadoNormalizado = typeof estado === "string" ? estado.trim().toLowerCase() : "";
  switch (estadoNormalizado) {
    case "active":
    case "running":
      return "RUNNING";
    case "inactive":
    case "exited":
    case "created":
    case "paused":
      return "STOPPED";
    case "failed":
    case "dead":
      return "ERROR";
    default:
      return "UNKNOWN";
  }
}

/**
 * Extrae el primer puerto publicado de la cadena de `docker ps`:
 * "0.0.0.0:8080->80/tcp, [::]:8080->80/tcp" → 8080. Devuelve null si no hay mapeo.
 */
export function extraerPrimerPuertoPublicado(puertos: unknown, nombreOImagen?: string): number | null {
  if (typeof puertos === "string" && puertos.trim().length > 0) {
    const match = puertos.match(/:(\d+)->/);
    const grupo = match?.[1];
    if (grupo) {
      const puerto = Number.parseInt(grupo, 10);
      if (Number.isInteger(puerto) && puerto > 0 && puerto <= 65535) return puerto;
    }
    // Fallback: buscar cualquier puerto expuesto simple (ej: "80/tcp")
    const matchSimple = puertos.match(/(\d+)\/tcp/);
    if (matchSimple?.[1]) {
      const p = Number.parseInt(matchSimple[1], 10);
      if (Number.isInteger(p) && p > 0 && p <= 65535) return p;
    }
  }

  // Fallback por convención de imagen o nombre de contenedor
  if (nombreOImagen) {
    const lower = nombreOImagen.toLowerCase();
    if (lower.includes("minio")) return 9000;
    if (lower.includes("nginx") || lower.includes("apache") || lower.includes("caddy") || lower.includes("traefik")) return 80;
    if (lower.includes("postgres")) return 5432;
    if (lower.includes("mysql") || lower.includes("mariadb")) return 3306;
    if (lower.includes("redis")) return 6379;
    if (lower.includes("mongo")) return 27017;
  }

  return null;
}

/**
 * Extrae el primer puerto en ESCUCHA de la cadena que arma el agente con
 * `ss -tlnp`/`netstat -tlnp`: "0.0.0.0:80, [::]:80" → 80. Devuelve null si no hay.
 */
export function extraerPuertoEscucha(puertos: unknown, nombreServicio?: string): number | null {
  if (typeof puertos === "string" && puertos.trim().length > 0) {
    const primer = puertos.split(",")[0]?.trim() ?? "";
    const match = primer.match(/:(\d+)$/);
    if (match?.[1]) {
      const puerto = Number.parseInt(match[1], 10);
      if (Number.isInteger(puerto) && puerto > 0 && puerto <= 65535) return puerto;
    }
    // Si viene simplemente como número directo
    const numDirecto = Number.parseInt(primer, 10);
    if (Number.isInteger(numDirecto) && numDirecto > 0 && numDirecto <= 65535) {
      return numDirecto;
    }
  }

  // Fallback por convención de servicio systemd
  if (nombreServicio) {
    const s = nombreServicio.toLowerCase();
    if (s.includes("nginx") || s.includes("apache") || s.includes("httpd") || s.includes("caddy")) return 80;
    if (s.includes("minio")) return 9000;
    if (s.includes("postgres")) return 5432;
    if (s.includes("mysql") || s.includes("mariadb")) return 3306;
    if (s.includes("redis")) return 6379;
    if (s.includes("mongo")) return 27017;
    if (s.includes("ssh")) return 22;
  }

  return null;
}

/** Coacciona un campo textual del payload a string|null defensivo. */
function texto(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const recortado = valor.trim();
  return recortado.length > 0 ? recortado : null;
}

// Lista negra de unidades auxiliares o de inicialización puntual que no representan servicios de aplicación
const EXCLUDED_SYSTEMD_UNITS = [
  "kmod-static-nodes.service",
  "systemd-tpm2-setup-early.service",
  "systemd-tpm2-setup.service",
  "systemd-modules-load.service",
  "systemd-sysctl.service",
];

/** Convierte el payload validado en candidatos de servicios listos para upsert. */
export function mapAgentPayloadToServiceCandidates(payload: AgentePayload): AgenteServicioCandidate[] {
  const candidatos: AgenteServicioCandidate[] = [];

  // A) Contenedores Docker — la imagen queda como processName.
  if (Array.isArray(payload.servicios_docker)) {
    for (const crudo of payload.servicios_docker) {
      if (typeof crudo !== "object" || crudo === null) continue;
      const contenedor = crudo as AgenteContenedorDocker;
      const nombre = texto(contenedor.nombre);
      if (!nombre) continue;
      candidatos.push({
        name: nombre,
        status: mapEstadoToServiceStatus(contenedor.estado),
        description: texto(contenedor.imagen),
        port: extraerPrimerPuertoPublicado(contenedor.puertos, `${nombre} ${texto(contenedor.imagen) ?? ""}`),
        processName: texto(contenedor.imagen),
        origen: "DOCKER",
      });
    }
  }

  // B) Servicios systemd — la descripción de la unidad va al campo description
  // y el primer puerto en escucha (si el agente lo detectó con ss/netstat)
  // habilita la verificación TCP del monitor en cada tick.
  if (Array.isArray(payload.servicios_systemd)) {
    for (const crudo of payload.servicios_systemd) {
      if (typeof crudo !== "object" || crudo === null) continue;
      const unidad = crudo as AgenteServicioSystemd;
      const nombre = texto(unidad.nombre);
      if (!nombre) continue;

      // Filtrar unidades espurias del sistema que no son servicios monitoreables
      if (EXCLUDED_SYSTEMD_UNITS.includes(nombre.toLowerCase())) {
        continue;
      }

      candidatos.push({
        name: nombre,
        status: mapEstadoToServiceStatus(unidad.estado),
        description: texto(unidad.descripcion),
        port: extraerPuertoEscucha(unidad.puertos, `${nombre} ${texto(unidad.descripcion) ?? ""}`),
        processName: null,
        origen: "SYSTEMD",
      });
    }
  }

  return candidatos;
}
