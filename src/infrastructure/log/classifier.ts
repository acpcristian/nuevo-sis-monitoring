import { LogCategory, LogCategoryInfo } from "@/core/domain/log.types";

/**
 * Patrón de clasificación de logs por categoría.
 * Cada categoría tiene una lista de palabras clave y patrones regex
 * que se utilizan para clasificar automáticamente un evento de log entrante.
 */
interface CategoryPattern {
  category: LogCategory;
  keywords: string[];
  patterns: RegExp[];
}

/**
 * Reglas de clasificación basadas en patrones (deterministas y verificables).
 * El orden importa: las categorías más específicas deben evaluarse primero.
 */
const CATEGORY_PATTERNS: CategoryPattern[] = [
  {
    category: "SECURITY_AUDIT",
    keywords: [
      "intrusion", "intrusión", "breach", "violación", "unauthorized",
      "no autorizado", "suspicious", "sospechoso", "attack", "ataque",
      "brute force", "fuerza bruta", "malware", "ransomware",
      "failed password for invalid", "fallo contraseña inválido",
    ],
    patterns: [
      /security\s+alert/i,
      /alerta\s+de\s+seguridad/i,
      /failed\s+password\s+for\s+invalid\s+user/i,
      /fallo\s+de\s+contraseña\s+para\s+usuario\s+inválido/i,
      /access\s+denied/i,
      /acceso\s+denegado/i,
    ],
  },
  {
    category: "AUTH_ACCESS",
    keywords: [
      "login", "logon", "auth", "autenticación", "autenticación",
      "session", "sesión", "logout", "cerrar\s+sesión",
      "password", "contraseña", "credential", "credencial",
      "ssh", "sudo", "su ", "pam",
    ],
    patterns: [
      /(login|logon|authenticat|autenticación)/i,
      /(session|sesión).*(opened|iniciada|abierta)/i,
      /(logout|logoff|cerrar).*(session|sesión)/i,
      /pam_unix/i,
      /sshd\[/i,
      /failed\s+password\s+for\s+(root|admin)/i,
      /fallo\s+de\s+contraseña\s+para\s+(root|admin)/i,
    ],
  },
  {
    category: "SSH_NETWORK",
    keywords: [
      "connection", "conexión", "connect", "conectar",
      "disconnect", "desconectar", "timeout", "tiempo de espera",
      "refused", "rechazado", "unreachable", "inalcanzable",
      "dns", "resolución", "resolve", "puerto", "port",
    ],
    patterns: [
      /(connection|conexión).*(refused|rechazado|timeout|tiempo de espera)/i,
      /(unreachable|inalcanzable)/i,
      /(dns|resolución).*(fail|fallo|error)/i,
      /port\s+\d+/i,
    ],
  },
  {
    category: "DATABASE",
    keywords: [
      "sql", "query", "consulta", "database", "base de datos",
      "oracle", "postgres", "mysql", "mariadb", "mongodb",
      "connection pool", "grupo de conexiones", "deadlock", "bloqueo",
      "transaction", "transacción", "rollback", "confirmar",
    ],
    patterns: [
      /(sql|query|consulta).*(error|fallo|timeout|lento)/i,
      /(database|base de datos).*(error|fallo|connection|conexión)/i,
      /(postgres|mysql|oracle|mariadb|mongodb)/i,
      /(deadlock|bloqueo)/i,
      /connection pool/i,
    ],
  },
  {
    category: "WEB_APP",
    keywords: [
      "http", "https", "nginx", "apache", "iis", "web",
      "request", "solicitud", "response", "respuesta",
      "status", "estado", "404", "500", "502", "503",
      "endpoint", "api", "rest",
    ],
    patterns: [
      /(nginx|apache|iis)/i,
      /(http|https).*(request|solicitud|response|respuesta)/i,
      /status\s+(404|500|502|503)/i,
      /(endpoint|api|rest).*(error|fallo)/i,
    ],
  },
  {
    category: "SYS_KERNEL",
    keywords: [
      "kernel", "panic", "oops", "page fault", "fallo de página",
      "memory", "memoria", "cpu", "procesador", "load", "carga",
      "uptime", "tiempo de actividad", "boot", "arranque",
      "shutdown", "apagado", "reboot", "reinicio",
    ],
    patterns: [
      /kernel/i,
      /(panic|oops)/i,
      /page\s+fault/i,
      /out\s+of\s+memory/i,
      /(boot|arranque|shutdown|apagado|reboot|reinicio)/i,
    ],
  },
  {
    category: "SYSTEM_SERVICE",
    keywords: [
      "service", "servicio", "daemon", "demonio", "process", "proceso",
      "systemd", "service failed", "servicio falló",
      "started", "iniciado", "stopped", "detenido",
      "restarted", "reiniciado",
    ],
    patterns: [
      /(service|servicio).*(started|iniciado|stopped|detenido|restarted|reiniciado)/i,
      /systemd/i,
      /(daemon|demonio)/i,
      /(process|proceso).*(failed|falló|error)/i,
    ],
  },
  {
    category: "STORAGE_HW",
    keywords: [
      "disk", "disco", "storage", "almacenamiento", "filesystem", "sistema de archivos",
      "partition", "partición", "mount", "montar", "unmount", "desmontar",
      "i/o", "io error", "error de entrada", "smart", "bad block",
      "sector", "cuota", "quota", "full", "lleno",
    ],
    patterns: [
      /(disk|disco|storage|almacenamiento).*(error|fallo|full|lleno)/i,
      /filesystem/i,
      /(i\/o|io).*(error|fallo)/i,
      /bad\s+block/i,
      /no\s+space\s+left/i,
      /sin\s+espacio/i,
    ],
  },
  {
    category: "BACKUP_TASK",
    keywords: [
      "backup", "copia de seguridad", "restore", "restaurar",
      "snapshot", "instantáneo", "archive", "archivo",
      "retention", "retención", "purge", "purgar",
    ],
    patterns: [
      /(backup|copia de seguridad)/i,
      /(restore|restaurar)/i,
      /snapshot/i,
      /(retention|retención)/i,
      /(archive|archivo).*(creado|completado)/i,
    ],
  },
  {
    category: "AGENT_ERROR",
    keywords: [
      "agent", "agente", "telemetry", "telemetría",
      "collector", "recolector", "forwarder", "reenvío",
      "disconnected", "desconectado", "heartbeat", "latido",
      "stale", "obsoleto", "caducado",
    ],
    patterns: [
      /(agent|agente).*(disconnected|desconectado|error|fallo)/i,
      /telemetry/i,
      /heartbeat/i,
      /stale\s+data/i,
      /datos\s+caducos/i,
    ],
  },
];

/**
 * Clasifica un evento de log en una de las 10 categorías prioritarias.
 * Utiliza reglas basadas en palabras clave y expresiones regulares.
 * Es determinista y verificable, sin depender de modelos de IA.
 *
 * @param message - Mensaje del log a clasificar (ya sanetizado)
 * @param rawLog - Texto original del log (para contexto adicional)
 * @returns Categoría clasificada
 */
export function classifyLog(message: string, rawLog?: string | null): LogCategory {
  const text = `${message ?? ""} ${rawLog ?? ""}`.toLowerCase();

  let bestMatch: { category: LogCategory; score: number } | null = null;

  for (const pattern of CATEGORY_PATTERNS) {
    let score = 0;

    // Puntuación por palabras clave
    for (const keyword of pattern.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }

    // Puntuación por patrones regex (mayor peso)
    for (const regex of pattern.patterns) {
      if (regex.test(text)) {
        score += 3;
      }
    }

    if (score > 0 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { category: pattern.category, score };
    }
  }

  return bestMatch?.category ?? "AGENT_ERROR";
}