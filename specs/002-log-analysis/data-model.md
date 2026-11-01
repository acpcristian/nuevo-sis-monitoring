# Phase 1: Data Model & Schema Specification (002-log-analysis)

**Feature**: `002-log-analysis`  
**Date**: 2026-10-29  
**Status**: Completed  

---

## 1. Diagrama Entidad-Relación Lógico

```mermaid
erDiagram
    SERVER ||--o{ LOG_EVENT : "genera"
    LOG_CATEGORY ||--o{ LOG_EVENT : "clasifica"
    LOG_EVENT ||--o{ INCIDENT_DIAGNOSIS : "sirve de evidencia"
    SERVER ||--o{ DATA_FRESHNESS_STATE : "tiene estado"
    SERVER ||--o{ LOG_ALERT : "genera alertas"
    USER ||--o{ INCIDENT_DIAGNOSIS : "genera"
    USER ||--o{ LOG_ALERT : "reconoce o resuelve"
    LOG_ALERT ||--o{ LOG_EVENT : "agrupa"

    SERVER {
        uuid id PK (from spec 001)
        string name UK
        string ipAddress
    }

    LOG_CATEGORY {
        uuid id PK
        string code UK "SYS_KERNEL, AUTH_ACCESS, SSH_NETWORK, SYSTEM_SERVICE, WEB_APP, DATABASE, STORAGE_HW, BACKUP_TASK, SECURITY_AUDIT, AGENT_ERROR"
        string name
        string description
        integer priority
    }

    LOG_EVENT {
        uuid id PK
        uuid server_id FK "nullable"
        uuid category_id FK
        timestamp event_timestamp "momento en el origen"
        timestamp ingestion_timestamp "momento de recepción"
        timestamp processed_timestamp "momento de procesamiento"
        string event_type
        string severity "INFO, WARN, ERROR, CRITICAL"
        string sanitized_message "texto sanetizado"
        text raw_log "texto original inmutable (sin modificar)"
        jsonb metadata "metadatos flexibles"
        boolean is_untrusted "datos no confiables"
    }

    INCIDENT_DIAGNOSIS {
        uuid id PK
        uuid generated_by FK "usuario SUPERADMIN"
        timestamp generated_at
        text observed_facts "hechos constatables"
        text probable_cause "hipótesis técnica"
        jsonb evidence_support "referencias a log_events"
        text alternative_diagnoses
        text impact_potential
        text verification_steps
        text remediation_recommendations
        text confidence_level
        string status "DRAFT, FINAL, SUPERSEDED"
    }

    DATA_FRESHNESS_STATE {
        uuid id PK
        uuid server_id FK UK
        enum freshness_state "FRESH, STALE, AGENT_DISCONNECTED, UNREACHABLE"
        timestamp last_telemetry_at
        timestamp updated_at
    }

    LOG_ALERT {
        uuid id PK
        uuid server_id FK "nullable"
        uuid category_id FK
        string pattern_type
        integer event_count
        timestamp window_start
        timestamp window_end
        string severity
        string status "ACTIVE, ACKNOWLEDGED, RESOLVED"
        uuid acknowledged_by FK "nullable"
        timestamp acknowledged_at
    }
```

---

## 2. Definición Detallada de Entidades y Validaciones

### 2.1. Entidad `LogCategory`

Catálogo de las 10 categorías prioritarias definidas en el Principio VII.

| Campo | Tipo | Nulo | Restricciones / Validación | Descripción |
|-------|------|------|---------------------------|-------------|
| `id` | UUID | No | Primaria, autogenerada | Identificador único de la categoría. |
| `code` | VARCHAR(50) | No | Único, código alfanumérico | Código de categoría (ej. `AUTH_ACCESS`, `SECURITY_AUDIT`). |
| `name` | VARCHAR(100) | No | Nombre legible | Nombre de la categoría en español. |
| `description` | TEXT | Sí | Descripción | Qué tipo de eventos clasifica esta categoría. |
| `priority` | INTEGER | No | Rango 1-10, default: 5 | Prioridad para ingesta en picos (1 = más crítica). |

**Datos iniciales** (10 categorías):
1. `SYS_KERNEL` — Sistema operativo y kernel
2. `AUTH_ACCESS` — Autenticación, sesiones y accesos
3. `SSH_NETWORK` — SSH y conectividad de red
4. `SYSTEM_SERVICE` — Servicios del sistema y procesos
5. `WEB_APP` — Aplicaciones y servidores web
6. `DATABASE` — Motores de bases de datos
7. `STORAGE_HW` — Almacenamiento, sistemas de archivos y hardware
8. `BACKUP_TASK` — Copias de seguridad y tareas programadas
9. `SECURITY_AUDIT` — Seguridad, auditoría y eventos sospechosos
10. `AGENT_ERROR` — Errores de agentes, conectividad y canal de telemetría

---

### 2.2. Entidad `LogEvent`

Representa un registro individual de log ingerido.

| Campo | Tipo | Nulo | Restricciones / Validación | Descripción |
|-------|------|------|---------------------------|-------------|
| `id` | UUID | No | Primaria, autogenerada | Identificador único del evento. |
| `server_id` | UUID | Sí | Foránea a `servers(id)`, `ON DELETE SET NULL` | Servidor asociado (nullable si es desconocido). |
| `category_id` | UUID | No | Foránea a `log_categories(id)` | Categoría de clasificación. |
| `event_timestamp` | TIMESTAMPTZ | No | Marca temporal del evento en el origen. |
| `ingestion_timestamp` | TIMESTAMPTZ | No | Default: `now()` | Momento de recepción en la plataforma. |
| `processed_timestamp` | TIMESTAMPTZ | Sí | Momento de procesamiento/normalización. |
| `event_type` | VARCHAR(100) | Sí | Tipo de evento (ej. `ssh_login_failed`, `db_connection_error`). |
| `severity` | VARCHAR(20) | No | Enum: `INFO`, `WARN`, `ERROR`, `CRITICAL` | Severidad del evento. |
| `sanitized_message` | TEXT | No | Mensaje con secretos enmascarados | Texto del log con datos sensibles enmascarados. |
| `raw_log` | TEXT | No | Texto original inmutable | Contenido original del log (append-only, sin modificar). |
| `metadata` | JSONB | Sí | Metadatos flexibles | Información adicional estructurada (ej. PID, fuente, módulo). |
| `is_untrusted` | BOOLEAN | No | Default: `true` | Indica si el contenido es dato no confiable (requiere sanitización). |

**Índices**:
- `CREATE INDEX idx_log_event_server_timestamp ON log_events(server_id, event_timestamp DESC);`
- `CREATE INDEX idx_log_event_category_timestamp ON log_events(category_id, event_timestamp DESC);`
- `CREATE INDEX idx_log_event_ingestion ON log_events(ingestion_timestamp DESC);`

---

### 2.3. Entidad `IncidentDiagnosis`

Diagnóstico estructurado generado para un incidente.

| Campo | Tipo | Nulo | Restricciones / Validación | Descripción |
|-------|------|------|---------------------------|-------------|
| `id` | UUID | No | Primaria, autogenerada | Identificador único del diagnóstico. |
| `generated_by` | UUID | No | Usuario SUPERADMIN que generó el diagnóstico. |
| `generated_at` | TIMESTAMPTZ | No | Default: `now()` | Marca temporal de generación. |
| `observed_facts` | TEXT | No | Hechos constatables extraídos de logs. |
| `probable_cause` | TEXT | No | Hipótesis técnica fundamentada. |
| `evidence_support` | JSONB | No | Referencias a `log_events` (IDs, timestamps, líneas). |
| `alternative_diagnoses` | TEXT | Sí | Otras causas potenciales. |
| `impact_potential` | TEXT | Sí | Consecuencias operativas. |
| `verification_steps` | TEXT | Sí | Pasos recomendados de comprobación. |
| `remediation_recommendations` | TEXT | Sí | Pautas de resolución sugeridas. |
| `confidence_level` | VARCHAR(20) | No | Enum: `LOW`, `MEDIUM`, `HIGH` | Nivel de confianza del diagnóstico. |
| `status` | VARCHAR(20) | No | Enum: `DRAFT`, `FINAL`, `SUPERSEDED` | Estado del diagnóstico. |

---

### 2.4. Entidad `DataFreshnessState`

Estado de actualidad de los datos de telemetría por servidor.

| Campo | Tipo | Nulo | Restricciones / Validación | Descripción |
|-------|------|------|---------------------------|-------------|
| `id` | UUID | No | Primaria, autogenerada | Identificador único. |
| `server_id` | UUID | No | Foránea a `servers(id)`, UK | Servidor asociado. |
| `freshness_state` | VARCHAR(30) | No | Enum: `FRESH`, `STALE`, `AGENT_DISCONNECTED`, `UNREACHABLE` | Estado de frescura. |
| `last_telemetry_at` | TIMESTAMPTZ | Sí | Momento de última telemetría recibida. |
| `updated_at` | TIMESTAMPTZ | No | Default: `now()` | Última actualización del estado. |

---

### 2.5. Entidad `LogAlert`

Alerta generada por detección de patrones anómalos, con deduplicación.

| Campo | Tipo | Nulo | Restricciones / Validación | Descripción |
|-------|------|------|---------------------------|-------------|
| `id` | UUID | No | Primaria, autogenerada | Identificador único de la alerta. |
| `server_id` | UUID | Sí | Foránea a `servers(id)` | Servidor afectado (nullable si afecta a varios). |
| `category_id` | UUID | Sí | Foránea a `log_categories(id)` | Categoría del patrón detectado. |
| `pattern_type` | VARCHAR(100) | No | Tipo de patrón (ej. `storm`, `repeated_error`, `auth_failure_burst`). |
| `event_count` | INTEGER | No | Número de eventos agrupados en la alerta. |
| `window_start` | TIMESTAMPTZ | No | Inicio de la ventana temporal. |
| `window_end` | TIMESTAMPTZ | No | Fin de la ventana temporal. |
| `severity` | VARCHAR(20) | No | Enum: `INFO`, `WARN`, `ERROR`, `CRITICAL` | Severidad de la alerta. |
| `status` | VARCHAR(20) | No | Enum: `ACTIVE`, `ACKNOWLEDGED`, `RESOLVED` | Estado de la alerta. |
| `acknowledged_by` | UUID | Sí | Usuario que reconoció la alerta. |
| `acknowledged_at` | TIMESTAMPTZ | Sí | Momento del reconocimiento. |

**Índices**:
- `CREATE INDEX idx_log_alert_server_status ON log_alerts(server_id, status);`
- `CREATE INDEX idx_log_alert_window ON log_alerts(window_start, window_end);`

---

## 3. Reglas de Transición de Estados

### Estados de Frescura (`freshness_state`)

```
FRESH ──► STALE : Sin telemetría durante ventana configurada (ej. 5 min)
STALE ──► AGENT_DISCONNECTED : Agente reporta desconexión o timeout prolongado
AGENT_DISCONNECTED ──► UNREACHABLE : Servidor inaccesible por red
UNREACHABLE ──► FRESH : Telemetría recibida exitosamente tras recuperación
STALE ──► FRESH : Telemetría recibida (recuperación de datos caducos)
```

**Reglas de negocio**:
- Un servidor con `freshness_state = STALE_DATA` o `AGENT_DISCONNECTED` **MUST NOT** interpretarse como salud satisfactoria.
- La ausencia de telemetría **MUST** presentar estado explícito, nunca `ONLINE` implícito.

---
