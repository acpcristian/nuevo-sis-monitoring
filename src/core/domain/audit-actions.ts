/**
 * Catálogo único de acciones auditables (sin dependencias de Prisma para poder
 * importarse desde componentes cliente).
 */
export const AUDIT_ACTIONS = [
  // Inventario
  "SERVER_CREATED",
  "METADATA_UPDATED",
  "STATUS_CHANGED",
  "SERVER_RETIRED",
  "SERVICES_DISCOVERED",
  "UNAUTHORIZED_ATTEMPT",
  // Logs y diagnóstico
  "LOG_INGESTED",
  "DIAGNOSIS_CREATED",
  "LOG_ALERT_CREATED",
  "LOG_ALERT_MERGED",
  "LOG_ALERT_ACKNOWLEDGED",
  "LOG_ALERT_RESOLVED",
  // Incidentes
  "INCIDENT_CREATED",
  "INCIDENT_ASSIGNED",
  "INCIDENT_ESCALATED",
  "INCIDENT_RESOLVED",
  "INCIDENT_CLOSED",
  "INCIDENT_STATUS_CHANGED",
  // Notificaciones
  "CHANNEL_CREATED",
  "CHANNEL_UPDATED",
  "CHANNEL_DELETED",
  "CHANNEL_TESTED",
  "NOTIFICATION_SENT",
  "NOTIFICATION_FAILED",
  "NOTIFICATION_RETRY_SCHEDULED",
  "NOTIFICATION_RETRY_PROCESSED",
  // Reportes
  "REPORT_EXPORTED",
  // Seguridad
  "SECURITY_ALERT_SENT",
  // Apariencia
  "THEME_UPDATED",
  // Agente inteligente (011/012/013)
  "AGENT_PROVIDER_UPDATED",
  "AGENT_PROVIDER_TESTED",
  "AGENT_PROFILE_UPDATED",
  "AGENT_KB_UPDATED",
  "AGENT_CONVERSATION_STARTED",
  // Automatización
  "PLAYBOOK_CREATED",
  "PLAYBOOK_UPDATED",
  "PLAYBOOK_DELETED",
  "PLAYBOOK_EXECUTED",
  "PLAYBOOK_FAILED",
  // Autenticación y usuarios
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "USER_CREATED",
  "USER_UPDATED",
  "USER_PASSWORD_RESET",
  "USER_PASSWORD_CHANGED",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditActionGroup {
  label: string;
  actions: { value: AuditAction; label: string }[];
}

export const AUDIT_ACTION_GROUPS: AuditActionGroup[] = [
  {
    label: "Acceso y usuarios",
    actions: [
      { value: "LOGIN_SUCCESS", label: "Inicio de sesión correcto" },
      { value: "LOGIN_FAILED", label: "Inicio de sesión fallido" },
      { value: "USER_CREATED", label: "Usuario creado" },
      { value: "USER_UPDATED", label: "Usuario actualizado" },
      { value: "USER_PASSWORD_RESET", label: "Contraseña restablecida" },
      { value: "USER_PASSWORD_CHANGED", label: "Contraseña cambiada" },
      { value: "UNAUTHORIZED_ATTEMPT", label: "Intento no autorizado" },
      { value: "SECURITY_ALERT_SENT", label: "Alerta de seguridad enviada" },
    ],
  },
  {
    label: "Inventario",
    actions: [
      { value: "SERVER_CREATED", label: "Servidor creado" },
      { value: "METADATA_UPDATED", label: "Metadatos actualizados" },
      { value: "STATUS_CHANGED", label: "Estado cambiado" },
      { value: "SERVER_RETIRED", label: "Servidor retirado" },
      { value: "SERVICES_DISCOVERED", label: "Servicios descubiertos por agente" },
    ],
  },
  {
    label: "Logs y alertas",
    actions: [
      { value: "LOG_INGESTED", label: "Log ingerido" },
      { value: "DIAGNOSIS_CREATED", label: "Diagnóstico creado" },
      { value: "LOG_ALERT_CREATED", label: "Alerta creada" },
      { value: "LOG_ALERT_MERGED", label: "Alerta fusionada" },
      { value: "LOG_ALERT_ACKNOWLEDGED", label: "Alerta reconocida" },
      { value: "LOG_ALERT_RESOLVED", label: "Alerta resuelta" },
    ],
  },
  {
    label: "Incidentes",
    actions: [
      { value: "INCIDENT_CREATED", label: "Incidente creado" },
      { value: "INCIDENT_ASSIGNED", label: "Incidente asignado" },
      { value: "INCIDENT_ESCALATED", label: "Incidente escalado" },
      { value: "INCIDENT_RESOLVED", label: "Incidente resuelto" },
      { value: "INCIDENT_CLOSED", label: "Incidente cerrado" },
      { value: "INCIDENT_STATUS_CHANGED", label: "Estado de incidente cambiado" },
    ],
  },
  {
    label: "Notificaciones",
    actions: [
      { value: "CHANNEL_CREATED", label: "Canal creado" },
      { value: "CHANNEL_UPDATED", label: "Canal actualizado" },
      { value: "CHANNEL_DELETED", label: "Canal eliminado" },
      { value: "CHANNEL_TESTED", label: "Canal probado" },
      { value: "NOTIFICATION_SENT", label: "Notificación enviada" },
      { value: "NOTIFICATION_FAILED", label: "Notificación fallida" },
      { value: "NOTIFICATION_RETRY_SCHEDULED", label: "Reintento programado" },
      { value: "NOTIFICATION_RETRY_PROCESSED", label: "Reintento procesado" },
    ],
  },
  {
    label: "Reportes y automatización",
    actions: [
      { value: "REPORT_EXPORTED", label: "Reporte exportado" },
      { value: "PLAYBOOK_CREATED", label: "Playbook creado" },
      { value: "PLAYBOOK_UPDATED", label: "Playbook actualizado" },
      { value: "PLAYBOOK_DELETED", label: "Playbook eliminado" },
      { value: "PLAYBOOK_EXECUTED", label: "Playbook ejecutado" },
      { value: "PLAYBOOK_FAILED", label: "Playbook fallido" },
    ],
  },
  {
    label: "Apariencia",
    actions: [{ value: "THEME_UPDATED", label: "Apariencia actualizada" }],
  },
  {
    label: "Agente inteligente",
    actions: [
      { value: "AGENT_PROVIDER_UPDATED", label: "Proveedor de IA actualizado" },
      { value: "AGENT_PROVIDER_TESTED", label: "Proveedor de IA probado" },
      { value: "AGENT_PROFILE_UPDATED", label: "Comportamiento del agente actualizado" },
      { value: "AGENT_KB_UPDATED", label: "Base de conocimiento del agente actualizada" },
      { value: "AGENT_CONVERSATION_STARTED", label: "Conversación del agente iniciada" },
    ],
  },
];
