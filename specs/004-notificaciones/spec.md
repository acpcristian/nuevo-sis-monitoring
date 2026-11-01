# Feature Specification: Notificaciones y Alertas

**Feature Branch**: `004-notificaciones`  
**Created**: 2026-10-30  
**Status**: Draft  
**Input**: User description: "Sistema de notificaciones y alertas multi-canal (email, Slack, Webhooks, PagerDuty) para incidentes críticos y eventos de monitoreo, con enrutamiento por reglas, deduplicación y entregabilidad, cumpliendo Principios II, III, IV, VI, VIII, XI y XIII de la Constitución."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configuración de Canales de Notificación (Priority: P1)

Como **SUPERADMIN**, quiero configurar los canales de notificación por los cuales recibiré alertas (email, Slack, Webhooks, PagerDuty), para que el sistema pueda comunicarme eventos críticos de la manera que mi equipo requiere.

**Why this priority**: Es la base del sistema de notificaciones. Sin canales configurados, el sistema no puede entregar ninguna alerta.

**Independent Test**: Puede probarse configurando un canal de notificación (ej. Slack) y enviando una prueba; verificar que el mensaje se entrega correctamente en el destino.

**Acceptance Scenarios**:

1. **Configuración de canal Slack**:
   - **Given** que un SUPERADMIN accede a la configuración de notificaciones
   - **When** agrega una integración Slack con webhook URL, nombre del canal y evento de trigger
   - **Then** el sistema guarda la configuración, realiza una prueba de conexión y el canal pasa a estado `ACTIVE`

2. **Configuración de canal de email**:
   - **Given** que se configuran los servidores SMTP (host, puerto, usuario, desde), credenciales encriptadas y destinatarios
   - **When** el SUPERADMIN guarda la configuración
   - **Then** el sistema encripta las credenciales con AES-256-GCM y el canal pasa a estado `ACTIVE`

3. **Configuración de webhook**:
   - **Given** que se configura un endpoint Webhook con URL, método, headers y evento de trigger
   - **When** se guarda la configuración
   - **Then** el sistema valida el endpoint con un handshake y el canal pasa a estado `ACTIVE`

---

### User Story 2 - Envío de Notificaciones de Incidentes (Priority: P1)

Como **SUPERADMIN** u **OBSERVADOR**, quiero recibir notificaciones automáticas cuando se crean, escalan o resuelven incidentes críticos, para mantenerme informado sin tener que consultar constantemente el sistema.

**Why this priority**: Garantiza que los eventos críticos lleguen a los responsables en tiempo real, reduciendo el MTTR (Mean Time to Resolution).

**Independent Test**: Puede probarse la creación de un incidente crítico y verificar que la notificación se envía al canal configurado dentro de los 2 minutos.

**Acceptance Scenarios**:

1. **Notificación de creación de incidente crítico**:
   - **Given** que se crea un incidente con categoría CRITICAL y SLA de 30 minutos
   - **When** el sistema detecta la creación
   - **Then** se envía notificación inmediata a todos los canales activos con: título, descripción, servidor asociado, enlace directo y hora de creación

2. **Notificación de escalado SLA**:
   - **Given** que un incidente lleva tiempo en estado `ASSIGNED` sin actualizaciones y se acerca al SLA
   - **When** el motor de escalado lo detecta
   - **Then** se envía notificación a los canales activos indicando: escalado de prioridad, nuevo responsable, tiempo restante y enlace al incidente

3. **Notificación de resolución**:
   - **Given** que un incidente cambia a estado `RESOLVED`
   - **When** el sistema procesa la transición
   - **Then** se envía notificación a los canales activos con: causa raíz (resumida), acciones correctivas y enlace al incidente cerrado

---

### User Story 3 - Deduplicación y Agrupación de Alertas (Priority: P2)

Como **SUPERADMIN**, quiero que el sistema deduplique y agrupe alertas relacionadas para evitar la fatiga de notificaciones, para que solo reciba una notificación por tormenta de eventos o incidente correlacionado.

**Why this priority**: Evita la saturación del operador con notificaciones repetidas y asegura que la atención se enfoque en incidentes realmente críticos.

**Independent Test**: Puede probarse generando un volumen alto de eventos idénticos y verificando que se emite una única notificación agrupada en lugar de múltiples notificaciones individuales.

**Acceptance Scarios**:

1. **Deduplicación por tormenta de eventos**:
   - **Given** que se generan 100 eventos idénticos en un minuto desde el mismo servidor
   - **When** el motor de alertas evalúa los eventos
   - **Then** se emite una única notificación agrupada con el conteo de eventos y la ventana temporal, no 100 notificaciones separadas

2. **Correlación de eventos concurrentes**:
   - **Given** que ocurren simultáneamente fallos de conectividad en múltiples servidores del mismo cluster
   - **When** el sistema analiza la correlación temporal
   - **Then** las notificaciones se agrupan bajo un incidente común indicando el alcance afectado y losservidores involucrados

---

### User Story 4 - Entregabilidad y Reintentos (Priority: P2)

Como **SUPERADMIN**, quiero que el sistema tenga mecanismos de reintentos y seguimiento de entregabilidad para asegurar que las notificaciones críticas se entreguen, para que no pierda alertas importantes por fallos temporales.

**Why this priority**: Las notificaciones críticas deben llegar siempre; los fallos temporales no deben perder alertas.

**Independent Test**: Puede probarse simulando un fallo temporal en la entrega y verificando que el sistema reintenta y finalmente entrega la notificación.

**Acceptance Scenarios**:

1. **Reintento por fallo temporal**:
   - **Given** que se intenta enviar una notificación y el canal temporalmente falla (ej. SMTP caído, API de Slack rate-limited)
   - **When** el sistema falla el envío
   - **Then** el sistema programa un reintento en 30 segundos, vuelve a intentar cada minuto durante 10 minutos, y registra el estado de cada intento

2. **Seguimiento de entregabilidad**:
   - **Given** que se envió una notificación
   - **When** se consulta el estado de entregabilidad
   - **Then** el sistema muestra: fecha/hora de envío, canal destino, estado (ENVIADO, REINTENTANDO, FALLÓ), y últimos errores encontrados

---

### User Story 5 - Enrutamiento Inteligente (Priority: P3)

Como **SUPERADMIN**, quiero que el sistema enrute notificaciones basándose en reglas configurables (hora del día, severidad, tipo de evento, equipo responsable), para que las notificaciones lleguen al momento y al equipo correctos.

**Why this priority**: Optimiza la gestión de incidentes asegurando que las notificaciones no despierten a operadores en horario no laboral o que van al equipo correcto según la especialización.

**Independent Test**: Puede probarse configurando una regla de horario y verificando que las notificaciones fuera del horario se retrasaman o se enrutan a equipo de turno.

**Acceptance Scenarios**:

1. **Enrutamiento por horario**:
   - **Given** una regla que establece que fuera del horario laboral (lunes-viernes 9:00-18:00) las notificaciones van al equipo de turno
   - **When** se recibe un evento fuera del horario
   - **Then** el sistema enruta la notificación al equipo de turno y marca como "fuera de horario"

2. **Enrutamiento por tipo de evento**:
   - **Given** reglas que enrutan eventos de "seguridad" al equipo de seguridad y "caída de servidor" al equipo de operaciones
   - **When** se recibe cada tipo de evento
   - **Then** el sistema enruta correctamente según la regla definida

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema **MUST** permitir configurar canales de notificación: email (SMTP), Slack (webhook), Webhook HTTP, PagerDuty (API), con campos obligatorios por canal y credenciales encriptadas en reposo.
- **FR-002**: El sistema **MUST** generar notificaciones automáticas ante eventos: creación de incidente, escalado SLA, transición de estado a RESOLVED, y cierre CLOSED.
- **FR-003**: El sistema **MUST** implementar deduplicación de alertas por tormenta de eventos y correlación temporal para evitar notificaciones duplicadas.
- **FR-004**: El sistema **MUST** implementar reintentos programados con backoff exponencial para entrega de notificaciones, con máximo 10 reintentos en 10 minutos.
- **FR-005**: El sistema **MUST** distinguir roles: SUPERADMIN puede configurar todos los canales y ver entregabilidad; OBSERVADOR puede ver canales configurados pero **MUST NOT** modificarlos.
- **FR-006**: El sistema **MUST** aplicar enrutamiento inteligente: reglas por horario (día/no laboral), por tipo de evento (seguridad, operación, mantenimiento) y por severidad (crítico, mayor, menor).
- **FR-007**: El sistema **MUST** preservar credenciales de canales en encriptación AES-256-GCM en reposo; 0% de secretos en respuestas de API, logs o interfaces.
- **FR-008**: El sistema **MUST** generar logs de auditoría para cada acción de notificación: qué canal, qué evento, resultado (éxito/fallo), hora, y usuario responsable.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Los canales de notificación se configuran y pasan prueba de conexión en menos de 5 minutos.
- **SC-002**: El 95% de las notificaciones críticas se entregan en menos de 2 minutos desde el evento desencadenante.
- **SC-003**: Durante una tormenta de 100 eventos idénticos, el sistema emite como máximo 1 notificación agrupada (reducción ≥ 99% en volumen).
- **SC-004**: Las notificaciones críticas tienen entrega confirmada en el 99% de los casos (con reintentos y backoff exponencial).
- **SC-005**: Las reglas de enrutamiento por horario y tipo de evento se aplican correctamente en el 100% de los casos probados.
- **SC-006**: 0% de exposición de credenciales en respuestas de API, logs o interfaces (AES-256-GCM en reposo).

---

## Assumptions

- **A-001**: El sistema ya tiene integraciones predefinidas con proveedores de notificación (servidores SMTP, Slack API, PagerDuty API, endpoints Webhook genéricos).
- **A-002**: Los proveedores de notificación soportan los protocolos estándar (SMTP sobre TLS, Slack Incoming Webhooks, PagerDuty Events API, HTTP POST webhooks).
- **A-003**: Los canales de notificación (direcciones email, nombres de canales Slack, URLs de webhook) ya existen o serán creados por el SUPERADMIN durante la configuración inicial.
- **A-004**: El idioma oficial de los textos de notificación es español, con soporte para términos técnicos de incidentes y monitoreo.
- **A-005**: El sistema de notificaciones depende del Spec 003 (gestión de incidentes) para los eventos que desencadenan notificaciones, y del Spec 002 (análisis de logs) para la clasificación y contexto de eventos.

---

## Dependencies

- **Depende de Spec 003**: (incident-management) Para los eventos (creación, escalado, resolución) que desencadenan notificaciones.
- **Depende de Spec 002**: (log-analysis) Para clasificación de eventos y contexto de logs asociados.
- **Integra con**: Servicios externos de notificación (SMTP, Slack, PagerDuty, Webhooks genéricos).
- **Extiende**: Spec 001 para RBAC y modelo de usuarios; Spec 002 para contexto y clasificación de eventos.

## Constitution Check *(will be verified after planning)*

| Principio Constitucional | Estado | Evidencia de Cumplimiento en el Diseño |
|---|---|---|
| **I. SDD como Fuente de Verdad** | ✅ POR DEFINIR | Todo el diseño técnico deriva de los requerimientos (`FR-001` a `FR-008`) de `spec.md`. |
| **II. Seguridad desde el Diseño** | ✅ POR DEFINIR | Validación de entrada estricta mediante Zod en Route Handlers; sesiones autenticadas; canales HTTPS/TLS obligatorios. |
| **III. Gestión Segura de Credenciales** | ✅ POR DEFINIR | Encriptación AES-256-GCM de credenciales en reposo; 0% de secretos devueltos en GET/PATCH. |
| **IV. Mínimo Privilegio y RBAC** | ✅ POR DEFINIR | Validación en dos capas (Middleware + Service Guard); rol OBSERVADOR restringido a solo lectura. |
| **VI. Evidencia y Trazabilidad** | ✅ POR DEFINIR | Tabla audit log append-only que registra cada acción de notificación con usuario y marcas. |
| **VIII. Alertas y Ciclo de Incidente** | ✅ POR DEFINIR | Deduplicación anti-flapping; control de frecuencia; estados explícitos. |
| **XI. Resiliencia y Recuperación** | ✅ POR DEFINIR | Timeouts estrictos, reintentos con backoff exponencial, estados de entregabilidad. |
| **XIII. Privacidad y Exposición Mínima** | ✅ POR DEFINIR | Encriptación de credenciales; sin exposición masiva de datos sensibles en exports. |

---