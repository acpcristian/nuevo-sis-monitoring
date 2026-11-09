import type { LogCategory, LogSeverity } from "@/core/domain/log.types";

/**
 * Catálogo de conocimiento para el análisis de logs.
 *
 * Provee, por categoría y por patrón de mensaje:
 * - Qué significa el evento (lenguaje entendible para tomar decisiones).
 * - Causas comunes (¿por qué ocurre?).
 * - Soluciones sugeridas (pasos de remediación).
 *
 * Las categorías pueden sobrescribirse desde el CRUD de categorías de log
 * (/api/v1/log-categories); este catálogo actúa como contenido por defecto.
 */

export interface LogCategoryKnowledge {
  code: LogCategory | string;
  label: string;
  description: string;
  defaultCauses: string[];
  defaultSolutions: string[];
}

export const LOG_CATEGORY_KNOWLEDGE: LogCategoryKnowledge[] = [
  {
    code: "SYS_KERNEL",
    label: "Sistema/Kernel",
    description:
      "Eventos del kernel y del sistema operativo base: agotamiento de recursos (RAM, hilos), OOM Killer, faults de páginas y mensajes de arranque.",
    defaultCauses: [
      "Procesos consumiendo más memoria o CPU de lo previsto (fuga de memoria o carga no planificada).",
      "Falta de swap o configuración de límites (ulimit/cgroups) demasiado restrictiva.",
      "Firmware, driver o kernel desactualizado con errores conocidos.",
    ],
    defaultSolutions: [
      "Identificar el proceso responsable con `top`/`htop`, `dmesg | tail` y `journalctl -k`.",
      "Ampliar memoria o swap, y aplicar límites de recursos coherentes con el consumo real.",
      "Aplicar parches del sistema operativo y reiniciar en ventana de mantenimiento si persiste.",
    ],
  },
  {
    code: "AUTH_ACCESS",
    label: "Autenticación",
    description:
      "Intentos de inicio de sesión y control de acceso: autenticaciones fallidas, cuentas bloqueadas y cambios de privilegio (sudo/su).",
    defaultCauses: [
      "Credenciales incorrectas por error humano o contraseña expirada.",
      "Ataque de fuerza bruta o reintento automatizado desde IPs externas.",
      "Cuenta deshabilitada, caducada o sin la política de permisos necesaria.",
    ],
    defaultSolutions: [
      "Verificar en `journalctl`/`auth.log` que las IPs de origen sean legítimas antes de habilitar cualquier acceso.",
      "Forzar un cambio de contraseña y revisar la política de caducidad de la cuenta afectada.",
      "Activar/ajustar fail2ban y MFA ante patrones repetidos de fallas desde la misma/IP rangos externos.",
    ],
  },
  {
    code: "SSH_NETWORK",
    label: "Red/SSH",
    description:
      "Conectividad y sesión remota: conexiones SSH rechazadas, timeouts de red, DNS que no resuelve y pérdida de paquetes.",
    defaultCauses: [
      "Servicio sshd detenido, puerto bloqueado por firewall o bind en la interfaz incorrecta.",
      "Saturación de enlaces, routing erróneo o falla de DNS.",
      "Huésped/máquina remota fuera de línea temporalmente (apagón causado por mantenimiento u OOM).",
    ],
    defaultSolutions: [
      "Validar que el puerto responde (`nc -zv host 22`, `ss -tlnp | grep ssh`) y revisar reglas de firewall.",
      "Probar resolución DNS y traceroute para descartar problemas de red intermedia.",
      "Si el agente no se comunica, validar conectividad desde el servidor agente y reiniciar sshd/red en caso de necesidad.",
    ],
  },
  {
    code: "SYSTEM_SERVICE",
    label: "Servicios",
    description:
      "Ciclo de vida de servicios (systemd daemons): unidades fallidas, reinicios automáticos y códigos de salida anómalos.",
    defaultCauses: [
      "El binario o la unidad de systemd cambió de ruta, permiso o configuración.",
      "Dependencia no disponible (base de datos, cola, red) al momento del arranque.",
      "Crash del proceso por excepción no controlada o agotamiento de recursos.",
    ],
    defaultSolutions: [
      "Revisar `systemctl status <servicio>` y `journalctl -u <servicio> --since hoy` para ver el error puntual.",
      "Corregir la configuración/dependencia y ejecutar `systemctl daemon-reload` antes de reiniciar.",
      "Elevar `Restart=on-failure` y `RestartSec` para tolerar fallas transitorias mientras se estabiliza.",
    ],
  },
  {
    code: "WEB_APP",
    label: "Web/App",
    description:
      "Errores de aplicaciones web y proxies: 5xx, excepciones de runtime, timeouts del gateway y fallos de despliegue.",
    defaultCauses: [
      "Código con excepciones no controladas o dependencia externa caída.",
      "Throttling/agotamiento de workers, pool de conexiones o memoria del runtime.",
      "Configuración o despliegue reciente mal aplicado (symlink incompleto, variable de entorno faltante).",
    ],
    defaultSolutions: [
      "Revisar el stack trace del log y correlacionar con el último despliegue; hacer rollback si apareció tras un release.",
      "Escalar workers/conexiones o reiniciar el servicio de la aplicación tras verificar el uso de recursos.",
      "Validar healthchecks de la app y del balanceador; replicar el error en staging antes del fix en producción.",
    ],
  },
  {
    code: "DATABASE",
    label: "Base de Datos",
    description:
      "Salud de bases de datos: conexiones rechazadas, deadlocks, queries lentas y fallos de replicación.",
    defaultCauses: [
      "Límite de conexiones alcanzado o pool mal dimensionado.",
      "Query sin índices o con lock prolongados que generan deadlocks/timeouts.",
      "Replica sincronizada con lag o disco lleno en el servidor de datos.",
    ],
    defaultSolutions: [
      "Revisar el estado de conexiones (`pg_stat_activity`, `SHOW PROCESSLIST`) y cerrar transacciones zombis.",
      "Aplicar el índice o reescribir la query detectada en el log; mitigar la clase de consulta ofensora.",
      "Checkear espacio en disco y lag de replicación; ampliar recurso antes de reiniciar la instancia.",
    ],
  },
  {
    code: "STORAGE_HW",
    label: "Almacenamiento",
    description:
      "Discos, filesystems y capacidad: espacio agotado, errores de I/O y fallos de hardware.",
    defaultCauses: [
      "Partición/al 90%+ de uso por logs, temporales o crecimiento no controlado de datos.",
      "Disco con sectores dañados o RAID degradado.",
      "Mount desmontado o filesystem en estado de sólo lectura por consistencia.",
    ],
    defaultSolutions: [
      "Liberar espacio inmediato (`df -h`, limpiar logs/temporales) para evitar un cambio a inoperativo.",
      "Revisar `dmesg`/SMART del disco afectado y calendarizar reemplazo si hay errores de hardware.",
      "Ejecutar `fsck`/verificación del filesystem en ventana con el volumen desmontado.",
    ],
  },
  {
    code: "BACKUP_TASK",
    label: "Backups",
    description:
      "Trabajos de respaldo: fallas de ejecución, destinos inaccesibles y respaldos incompletos.",
    defaultCauses: [
      "Destino de backup sin espacio o credenciales/S3/depósito expiradas.",
      "Ventana de ejecución corta: el backup no terminó o fue abortado.",
      "Herramienta de backup desactualizada respecto del formato de datos.",
    ],
    defaultSolutions: [
      "Verificar el log del job de backup, destino y credenciales; reintentar de forma manual confirmada.",
      "Ampliar la ventana o excluir archivos no imprescindibles del conjunto de respaldo.",
      "Confirmar que existe un respaldo íntegro alternativo antes de cualquier cambio en producción.",
    ],
  },
  {
    code: "SECURITY_AUDIT",
    label: "Seguridad",
    description:
      "Eventos de seguridad y auditoría: escaneos, denegaciones de firewall, anomalías de acceso y cambios no autorizados.",
    defaultCauses: [
      "Escaneo o intento de intrusión automatizado desde IPs desconocidas.",
      "Trafico bloqueado por política de firewall/correo de configuración reciente.",
      "Cambio de configuración o cuenta sin seguir el proceso de cambios autorizado.",
    ],
    defaultSolutions: [
      "Analizar la IP/patrón atacante y bloquear con fail2ban/WAF si es malicioso confirmado.",
      "Revisar la auditoría (`last`, `auditd`, `journalctl`) para detectar la cadena de acciones del incidente.",
      "Notificar al equipo de seguridad y fortalecer las reglas expuestas si aplica.",
    ],
  },
  {
    code: "AGENT_ERROR",
    label: "Agente",
    description:
      "Salud del agente de recolección de la plataforma: fallos de conexión al servidor de monitoreo, credenciales y fallos internos.",
    defaultCauses: [
      "El agente no puede alcanzar el servidor central (red/DNS/certificado).",
      "Credencial de SSH/API del agente vencida o revocada.",
      "Fallo interno del agente: proceso caído, memoria insuficiente o bug.",
    ],
    defaultSolutions: [
      "Revisar conectividad del host agente al servidor de la plataforma y la validez de la credencial almacenada.",
      "Reiniciar el proceso del agente y validar que vuelven a llegar métricas (estado de frescura FRESH).",
      "Actualizar el agente a la última versión si se detecta un bug conocido.",
    ],
  },
];

const CATEGORY_INDEX = new Map<string, LogCategoryKnowledge>(
  LOG_CATEGORY_KNOWLEDGE.map((entry) => [entry.code, entry])
);

export function getCategoryKnowledge(code: string): LogCategoryKnowledge {
  return (
    CATEGORY_INDEX.get(code) ?? {
      code,
      label: code,
      description: "Categoría sin descripción definida en el catálogo.",
      defaultCauses: [],
      defaultSolutions: [],
    }
  );
}

/** Etiquetas legibles de severidad orientadas a decisión. */
export function describeSeverity(severity: string): string {
  switch (severity) {
    case "INFO":
      return "Informativo: operación normal, sin acción requerida.";
    case "WARN":
      return "Advertencia: comportamiento anómalo que debe vigilarse, puede degradar el servicio.";
    case "ERROR":
      return "Error: una operación falló y ya afecta la funcionalidad asociada.";
    case "CRITICAL":
      return "Crítico: falla grave; atiéndolo con prioridad, hay riesgo de indisponibilidad.";
    default:
      return "Severidad no clasificada.";
  }
}

export const SERVICE_STATUS_LABELS: Record<string, { label: string; badgeClass: string }> = {
  RUNNING: { label: "En ejecución", badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  STOPPED: { label: "Detenido", badgeClass: "bg-amber-50 text-amber-700 border-amber-200" },
  ERROR: { label: "Con error", badgeClass: "bg-rose-50 text-rose-700 border-rose-200" },
  UNKNOWN: { label: "Estado desconocido", badgeClass: "bg-slate-100 text-slate-600 border-slate-200" },
};

interface LogMessagePattern {
  id: string;
  test: RegExp;
  /** Qué significa el mensaje, en lenguaje claro. */
  meaning: string;
  /** Causas probables específicas (se combinan con las de la categoría). */
  causes: string[];
  /** Acciones sugeridas específicas (se listan antes que las genéricas). */
  solutions: string[];
}

/**
 * Patrones globales sobre el mensaje sanitizado. Se evalúan en orden y
 * todos los que apliquen aportan su lectura (máximo 3 coincidencias).
 */
const MESSAGE_PATTERNS: LogMessagePattern[] = [
  {
    id: "connection-refused",
    test: /connection\s*(was\s*)?refused|ECONNREFUSED/i,
    meaning:
      "Algo intentó conectarse a un puerto y el destino lo rechazó: nada está escuchando allí o un firewall denegó la conexión.",
    causes: ["El proceso en el puerto destino no está corriendo o cambió de puerto."],
    solutions: [
      "Confirmar en el servidor destino que el servicio escucha en el puerto esperado (`ss -tlnp`) y levantarlo si está caído.",
    ],
  },
  {
    id: "timeout",
    test: /timed?[\s-]*out|timeout|ETIMEDOUT|deadline\s*exceeded/i,
    meaning:
      "Una operación esperó demasiado tiempo una respuesta y fue abortada: hay latencia, carga o un destino inalcanzable.",
    causes: ["Red lenta/saturada, destino sobrecargado o proceso colgando sin responder."],
    solutions: [
      "Medir la latencia hacia el destino (ping/curl con cronómetro) y revisar carga de CPU/memoria/conexiones.",
    ],
  },
  {
    id: "auth-failed",
    test: /auth(?:entication)?\s*fail|invalid\s*(?:user|password|credential)|denied.{0,20}(?:password|auth)|access\s*denied/i,
    meaning:
      "Credenciales inválidas o permisos insuficientes para esta operación; podría ser error humano o intento de acceso no autorizado.",
    causes: ["Credencial vencida/incorrecta o cuenta sin permisos para la operación."],
    solutions: [
      "Confirmar si el intento proviene de un operador legítimo; si lo es, actualizar la credencial o los permisos.",
    ],
  },
  {
    id: "disk-full",
    test: /no\s*space\s*left|disk\s*(?:is\s*)?full|enospc|filesystem\s*full/i,
    meaning:
      "El disco o la partición indicada se quedó sin espacio y las escrituras están fallando.",
    causes: ["Crecimiento no controlado de logs/datos o partición mal dimensionada."],
    solutions: [
      "Liberar espacio urgente (`df -h`, rotar/limpiar logs) antes de que el sistema quede inoperativo.",
    ],
  },
  {
    id: "oom",
    test: /out\s*of\s*memory|oom[\s-]?kill(?:er)?|cannot\s*allocate\s*memory/i,
    meaning:
      "El sistema se quedó sin memoria: dependiendo del caso, mató procesos (OOM Killer) o la aplicación falló al reservar RAM.",
    causes: ["Fuga de memoria o pico de carga que excede la memoria disponible."],
    solutions: [
      "Identificar el proceso con mayor consumo (`ps aux --sort=-%mem`) y reiniciarlo o escalar la memoria del servidor.",
    ],
  },
  {
    id: "service-failed",
    test: /(?:service|unit|daemon).{0,30}(?:failed|failure|crashed)|exit(?:ed)?\s*(?:code|status)\s*[1-9]/i,
    meaning:
      "Un servicio/daemon se detuvo con código de error anómalo y posiblemente dejó de servir su función.",
    causes: ["Dependencia no disponible al arrancar o error interno del proceso."],
    solutions: [
      "Inspeccionar `systemctl status <servicio>` y `journalctl -u <servicio>` para ver la causa exacta antes de reiniciar.",
    ],
  },
  {
    id: "http-5xx",
    test: /\b5\d\d\b|\b50[0-5]\b|internal\s*server\s*error|bad\s*gateway|service\s*unavailable/i,
    meaning:
      "Una petición web terminó en error 5xx: la aplicación o el gateway detrás del proxy no pudo responder correctamente.",
    causes: ["Excepción en la aplicación, dependencia caída o agotamiento de workers."],
    solutions: [
      "Correlacionar con el último despliegue y los logs de la aplicación; revisar healthcheck del servicio afectado.",
    ],
  },
  {
    id: "dns",
    test: /name\s*or\s*service\s*not\s*known|dns\s*(?:resolution\s*)?fail|could\s*not\s*resolve|ENOTFOUND|nxdomain/i,
    meaning:
      "No se pudo resolver un nombre de dominio a una IP: la red o el DNS está fallando, o el nombre es incorrecto.",
    causes: ["DNS caído/mal configurado o nombre de host escrito erróneamente."],
    solutions: [
      "Probar resolución directa (`dig`/`nslookup` al nombre) y verificar la configuración de `/etc/resolv.conf`.",
    ],
  },
  {
    id: "permission",
    test: /permission\s*denied|ep?erm|not\s*permitted|read-only\s+(?:file\s+)?system/i,
    meaning:
      "El proceso no tiene permisos para realizar la operación, o el sistema de archivos está montado en sólo lectura.",
    causes: ["Permisos/propietario incorrecto del recurso o mount en lectura por consistencia."],
    solutions: [
      "Corregir propietario/permisos del recurso o revisar `dmesg` ante un filesystem en read-only antes de remontar.",
    ],
  },
  {
    id: "db-deadlock",
    test: /deadlock|lock\s*wait\s*timeout|duplicate\s*key|deadlock\s*detected/i,
    meaning:
      "La base de datos reportó conflictos de integridad/concurrencia: dos transacciones se bloquearon entre sí o una clave se duplicó.",
    causes: ["Transacciones largas concurrentes o lógica que intenta insertar claves existentes."],
    solutions: [
      "Abrir las transacciones ofensoras y reintentar la operación; revisar la query concurrente en los logs de la BD.",
    ],
  },
];

export interface DescribeLogEventInput {
  category: string;
  severity: string;
  eventType?: string | null;
  message: string;
}

export interface LogSummary {
  /** Línea de resumen para la tabla (breve, orientada a decisión). */
  title: string;
  /** Qué significa el evento, en lenguaje claro. */
  meaning: string;
  /** Por qué ocurre: patrones específicos primero, causas de categoría después. */
  causes: string[];
  /** Qué hacer: acciones específicas primero, soluciones de categoría después. */
  solutions: string[];
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function firstSentence(text: string): string {
  return text?.split(":")[0]?.trim() ?? "";
}

/**
 * Construye la lectura comprensible de un evento: combina el significado de
 * severidad, la categoría y los patrones detectados en el mensaje sanitizado.
 */
export function describeLogEvent(input: DescribeLogEventInput): LogSummary {
  const { category, severity, eventType, message } = input;
  const knowledge = getCategoryKnowledge(category);

  const haystack = `${message ?? ""} ${eventType ?? ""}`;
  const matches = MESSAGE_PATTERNS.filter((p) => p.test.test(haystack)).slice(0, 3);

  const title =
    matches.length > 0
      ? matches
          .map((m) => firstSentence(m.meaning))
          .filter(Boolean)
          .join(" · ")
      : firstSentence(knowledge.description);

  const meaning =
    matches.length > 0
      ? matches.map((m) => m.meaning).join(" ")
      : `${describeSeverity(severity)} Este evento corresponde a la categoría "${knowledge.label}": ${knowledge.description}`;

  const causes = dedupe([
    ...matches.flatMap((m) => m.causes),
    ...knowledge.defaultCauses,
  ]);

  const solutions = dedupe([
    ...matches.flatMap((m) => m.solutions),
    ...knowledge.defaultSolutions,
  ]);

  return { title, meaning, causes, solutions };
}

/**
 * Convierte el texto multilinea guardado en el CRUD de categorías
 * (una causa/solución por línea) en una lista.
 */
export function splitKnowledgeText(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Convierte una lista de causas/soluciones en texto multilinea para el CRUD. */
export function joinKnowledgeText(values: string[]): string {
  return values.join("\n");
}
