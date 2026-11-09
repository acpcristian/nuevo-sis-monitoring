/**
 * Catálogo por defecto de categorías de notificación, organizadas por
 * sección del sistema (Servidores, Servicios, Logs, Seguridad, Incidentes,
 * Respaldos, Agente). Puede personalizarse desde el CRUD de
 * /api/v1/notification-categories sin tocar código.
 */

export type NotificationCategoryCode =
  | "SERVER_OFFLINE"
  | "SERVICE_HEALTH"
  | "LOG_ALERT"
  | "SECURITY_ALERT"
  | "INCIDENT"
  | "BACKUP"
  | "AGENT_FRESHNESS";

export const NOTIFICATION_SEVERITIES = [
  "CRITICAL",
  "ERROR",
  "MAJOR",
  "HIGH",
  "MEDIUM",
  "MINOR",
  "WARN",
  "LOW",
  "INFO",
] as const;

export interface NotificationCategoryKnowledge {
  code: NotificationCategoryCode | string;
  name: string;
  /** Sección del sistema a la que pertenece la alerta. */
  section: string;
  description: string;
  /** ¿Cuándo se dispara la alerta? */
  triggerInfo: string;
  defaultSeverity: string;
  recommendedActions: string[];
}

export const NOTIFICATION_CATEGORY_KNOWLEDGE: NotificationCategoryKnowledge[] = [
  {
    code: "SERVER_OFFLINE",
    name: "Servidor fuera de línea",
    section: "Servidores",
    description:
      "Un servidor supervisado no responde o su healthcheck quedó en estado crítico.",
    triggerInfo:
      "Fallan N chequeos de conectividad consecutivos (SSH/ping) o el estado de salud pasa a CRITICAL/OFFLINE.",
    defaultSeverity: "CRITICAL",
    recommendedActions: [
      "Validar la conectividad de red y el estado de encendido del servidor antes de asumir un outage de servicio.",
      "Revisar el último log y la telemetría del servidor en la sección Servidores para conocer el estado previo.",
      "Escalar a operadores de infraestructura si el host está en producción y no hay respuesta confirmada.",
    ],
  },
  {
    code: "SERVICE_HEALTH",
    name: "Servicio detenido o con error",
    section: "Servicios",
    description:
      "Un servicio supervisado del inventario se detuvo, reporta ERROR o dejó de escuchar en su puerto.",
    triggerInfo:
      "El estado del servicio pasa a STOPPED/ERROR, o el chequeo de puerto/proceso falla de forma consecutiva.",
    defaultSeverity: "HIGH",
    recommendedActions: [
      "Abrir el detalle del servicio en la sección Servidores para ver el chequeo fallido y la última comprobación.",
      "Reiniciar el servicio tras revisar logs (journalctl / logs de la app) para no tapar la causa raíz.",
      "Verificar dependencias del servicio (BD, red, configuración) antes de dar por resuelto el reinicio.",
    ],
  },
  {
    code: "LOG_ALERT",
    name: "Patrón crítico en logs",
    section: "Logs",
    description:
      "Se detectó una ráfaga de eventos de log críticos/errores que cumplen un patrón de alerta.",
    triggerInfo:
      "El detector de patrones agrupa eventos WARN/ERROR/CRITICAL de una categoría dentro de su ventana temporal.",
    defaultSeverity: "MEDIUM",
    recommendedActions: [
      "Revisar el detalle del evento más reciente en la sección Logs (¿por qué ocurre? / soluciones sugeridas).",
      "Confirmar si el patrón se repite en más de un servidor; en tal caso tratar como incidente de plataforma.",
      "Ajustar la regla de alerta si el patrón resulta ser ruido conocido, documentándolo en el catálogo de logs.",
    ],
  },
  {
    code: "SECURITY_ALERT",
    name: "Alerta de seguridad",
    section: "Seguridad",
    description:
      "Intentos no autorizados de mutación o patrones de acceso sospechoso detectados por el sistema.",
    triggerInfo:
      "Re intentos de login fallidos repetidos, acciones no autorizadas por rol, o cambios sin seguir el proceso de cambios.",
    defaultSeverity: "HIGH",
    recommendedActions: [
      "Identificar usuario/IP involucrada en la auditoría y decidir bloqueo temporal o escalado a seguridad.",
      "Verificar permisos del usuario implicado y la versión de sesión activa.",
      "Documentar el evento y la resolución para la revisión de seguridad del período.",
    ],
  },
  {
    code: "INCIDENT",
    name: "Ciclo de vida de incidentes",
    section: "Incidentes",
    description:
      "Eventos del ciclo de vida de un incidente: creación, asignación, escalamiento y resolución.",
    triggerInfo:
      "Se crea, asigna, escala o resuelve un incidente en la gestión de incidentes (US de imput y asignación).",
    defaultSeverity: "HIGH",
    recommendedActions: [
      "Confirmar asignación del incidente a un responsable con prioridad correcta.",
      "Seguir el estado en la sección Incidentes y registrar los pasos de remediación aplicados.",
    ],
  },
  {
    code: "BACKUP",
    name: "Falla de respaldo",
    section: "Respaldos",
    description:
      "Los trabajos de respaldo fallaron, no corrieron o su ventana se venció sin completar.",
    triggerInfo:
      "El job de backup reporta error, destino inaccesible o se supera la ventana sin respaldo completo.",
    defaultSeverity: "MEDIUM",
    recommendedActions: [
      "Verificar el log del job y la disponibilidad del destino (espacio, credenciales).",
      "Confirmar la existencia de un respaldo íntegro anterior antes de cambios en producción.",
      "Replanificar la ventana si la causa fue competir con picos de carga.",
    ],
  },
  {
    code: "AGENT_FRESHNESS",
    name: "Telemetría del agente",
    section: "Agente / Telemetría",
    description:
      "El agente de recolección dejó de reportar datos o los datos están viejos (frescura STALE/AGENT_DISCONNECTED/UNREACHABLE).",
    triggerInfo:
      "El estado de frescura del servidor pasa de FRESH a STALE (5 min) o etilos superiores (30 min / 4 h).",
    defaultSeverity: "LOW",
    recommendedActions: [
      "Verificar el proceso del agente y su conectividad al servidor central de monitoreo.",
      "Revisar credenciales del agente y certificados si hay fallos de autenticidad.",
      "Solo si el host está operativo, reiniciar el agente y confirmar el regreso a FRESH.",
    ],
  },
];

export function getNotificationCategoryKnowledge(code: string): NotificationCategoryKnowledge | null {
  return NOTIFICATION_CATEGORY_KNOWLEDGE.find((k) => k.code === code) ?? null;
}
