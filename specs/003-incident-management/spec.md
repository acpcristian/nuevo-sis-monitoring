# Feature Specification: Gestión de Incidentes

**Feature Branch**: `003-incident-management`  
**Created**: 2026-10-30  
**Status**: Draft  
**Input**: User description: "Gestión completa de incidentes: creación, asignación, escalado, resolución y SLA de incidentes detectados por análisis de logs y monitoreo de servidores, con ciclo de vida completo y trazabilidad, cumpliendo Principios II, III, IV, VI, VII, VIII, XII y XIII de la Constitución."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Creación de Incidentes (Priority: P1)

Como **SUPERADMIN** u **OBSERVADOR**, quiero crear un nuevo incidente cuando el sistema detecta un evento crítico en los logs o monitoreo de servidores, para que el equipo de respuesta pueda actuar de forma inmediata.

**Why this priority**: Es la base del sistema de gestión de incidentes. Sin la capacidad de crear incidentes, no es posible iniciar el ciclo de vida completo ni aplicar SLA.

**Independent Test**: Puede probarse creando un incidente con datos mínimos y verificando que aparece en el sistema con estado `OPEN`, marca temporal de creación y servidor/evento asociado.

**Acceptance Scenarios**:

1. **Alta exitosa con datos mínimos**:
   - **Given** que el sistema ha detectado un evento crítico (ej. caída de servidor, error grave de base de datos)
   - **When** un SUPERADMIN o OBSERVADOR crea un incidente especificando: título, descripción, categoría, servidor/evento asociado, severidad y responsable
   - **Then** el sistema crea el incidente en estado `OPEN`, registra la hora de creación, asigna el servidor/evento y muestra el incidente en la lista activa

2. **Validación de campos obligatorios**:
   - **Given** que se intenta crear un incidente sin título
   - **When** se envía el formulario
   - **Then** el sistema rechaza la operación con mensaje de validación indicando que el título es obligatorio

3. **Asignación automática por categoría**:
   - **Given** que un incidente se crea con categoría "CRITICAL"
   - **When** el sistema lo procesa
   - **Then** el incidente se asigna automáticamente al equipo de turno y se prioriza en la lista

---

### User Story 2 - Asignación y Escalado (Priority: P1)

Como **SUPERADMIN** u **OBSERVADOR**, quiero asignar incidentes a equipos responsables y escalarlos automáticamente cuando no hay respuesta en el tiempo establecido, para que los incidentes críticos reciban atención inmediata.

**Why this priority**: Garantiza que los incidentes críticos no queden sin atención y que el escalado ocurra de forma oportuna según políticas definidas.

**Independent Test**: Puede probarse asignando un incidente a un equipo y verificando que, si no hay respuesta en el tiempo SLA, el incidente se escalona automáticamente al siguiente nivel.

**Acceptance Scenarios**:

1. **Asignación manual de incidente**:
   - **Given** que hay un incidente en estado `OPEN`
   - **When** un SUPERADMIN asigna el incidente a un equipo/responsable específico
   - **Then** el incidente pasa estado `ASSIGNED`, muestra el equipo responsable y la hora de asignación

2. **Escalado automático por tiempo SLA**:
   - **Given** que un incidente está asignado pero no hay actualizaciones en el tiempo establecido del SLA
   - **When** el motor de escalado lo detecta
   - **Then** el incidente se escalona automáticamente al siguiente nivel de responsabilidad y notifica al nuevo equipo

3. **Escalado por múltiples fallos**:
   - **Given** que un incidente tiene múltiples eventos asociados y falla en uno o más
   - **When** se evalúa el incidente
   - **Then** el sistema eleva la severidad y notifica a los responsables correspondientes

---

### User Story 3 - Resolución y Cierre (Priority: P2)

Como **SUPERADMIN** u **OBSERVADOR**, quiero resolver y cerrar incidentes una vez que se ha restablecido la normalidad, para mantener el historial de incidentes y cerrar el ciclo de vida.

**Why this priority**: Cierra el ciclo de vida del incidente y permite el análisis posterior (post-mortem) para mejorar la estabilidad del sistema.

**Independent Test**: Puede probarse resolviendo un incidente que previamente fue asignado y verificado que el problema está resuelto, verificando que el estado cambia a `RESOLVED` y luego a `CLOSED`.

**Acceptance Scenarios**:

1. **Resolución de incidente**:
   - **Given** que un incidente está en estado `ASSIGNED` o `OPEN`
   - **When** un SUPERADMIN o el equipo responsable marca el incidente como resuelto, agregando causa raíz y acciones correctivas
   - **Then** el incidente pasa estado `RESOLVED`, registra la hora de resolución y el usuario que lo resolvió

2. **Cierre de incidente**:
   - **Given** que un incidente está en estado `RESOLVED`
   - **When** pasa un tiempo prudente o el equipo lo cierra manualmente, y se verifica que no hay récurrencias
   - **Then** el incidente pasa estado `CLOSED`, y queda archivado en el historial con todos los datos preservados

3. **Cierre sin resolución (abandonado)**:
   - **Given** que un incidente lleva tiempo en estado `OPEN` sin actividad
   - **When** el sistema o un SUPERADMIN lo cierra por inactividad
   - **Then** el incidente pasa estado `CLOSED` con marca de "abandonado" y motivos registrados

---

### User Story 4 - Historial y Reportes (Priority: P3)

Como **SUPERADMIN**, quiero consultar el historial de incidentes con filtros y generar reportes, para análisis de tendencias y cumplimiento de SLA.

**Why this priority**: Permite la mejora continua y el cumplimiento de compromisos de SLA con clientes y equipos.

**Independent Test**: Puede probarse consultando el historial con filtros de fecha, estado y categoría, y verificando que los reportes se generan con los datos correctos.

**Acceptance Scenarios**:

1. **Filtrado de incidentes por fecha y estado**:
   - **Given** un rango de fechas y estado(s) deseado(s)
   - **When** un SUPERADMIN consulta el historial
   - **Then** el sistema lista solo los incidentes que coinciden y genera estadísticas

2. **Reporte de cumplimiento SLA**:
   - **Given** un período de tiempo
   - **When** se genera un reporte de cumplimiento
   - **Then** el reporte muestra: % de incidentes resueltos dentro del SLA, % escalados, tiempos promedio, y qué equipos cumplieron/fallaron

3. **Exportación de historial**:
   - **Given** la necesidad de archivar o auditar
   - **When** un SUPERADMIN solicita exportar el historial
   - **Then** el sistema genera un archivo (CSV/JSON) con todos los datos del historial de incidentes, excluyendo datos sensibles

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema **MUST** permitir crear incidentes capturando obligatoriamente: título, descripción, categoría, severidad, servidor/evento asociado y responsable técnico.
- **FR-002**: El sistema **MUST** clasificar incidentes automáticamente en categorías: `INCIDENTE CRÍTICO`, `INCIDENTE MAYOR`, `INCIDENTE Menor`, `INCIDENTE de Mantenimiento`.
- **FR-003**: El sistema **MUST** asignar incidentes a equipos/responsables mediante política Round-Robin o carga de trabajo actual.
- **FR-004**: El sistema **MUST** implementar control de tiempo SLA (Service Level Agreement) por categoría de incidente, generando alertas de escalado cuando se excede.
- **FR-005**: El sistema **MUST** permitir transiciones de estado: `OPEN` → `ASSIGNED` → `IN_PROGRESS` → `RESOLVED` → `CLOSED`.
- **FR-006**: El sistema **MUST NOT** permitir transiciones de estado inválidas (ej. de `RESOLVED` directamente a `CLOSED` sin autorización).
- **FR-007**: El sistema **MUST** registrar auditoría append-only para cada transición de estado: usuario, hora, acción anterior, acción nueva, y cambios en campos clave.
- **FR-008**: El sistema **MUST** distinguir roles: SUPERADMIN puede todas las acciones (crear, asignar, escalar, resolver, cerrar); OBSERVADOR puede crear y consultar pero **MUST NOT** ejecutar mutaciones.
- **FR-009**: El sistema **MUST** generar notificaciones automáticas (email, canal interno) cuando: incidente creado, asignado, escalado, a punto de expirar SLA, resuelto.
- **FR-010**: El sistema **MUST** preservar la integridad de los datos del historial de incidentes: ningún dato sensible en exports masivos, y los logs originales se preservan inmutables.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un SUPERADMIN puede crear un incidente en menos de 2 minutos desde la detección del evento.
- **SC-002**: El 95% de los incidentes críticos son asignados a un equipo dentro de los primeros 15 minutos.
- **SC-003**: El 80% de los incidentes críticos se resuelven dentro del SLA definido por categoría (crítico: 30 min, mayor: 2 horas, menor: 8 horas).
- **SC-004**: El 100% de las transiciones de estado quedan registradas en el log auditivo sin exposición de datos sensibles.
- **SC-005**: Los usuarios OBSERVADOR pueden consultar y filtrar el historial de incidentes, pero no pueden ejecutar mutaciones (transiciones, asignaciones).
- **SC-006**: Los reportes de cumplimiento SLA se generan con precisión del 95% respecto a los datos reales del sistema.

---

## Assumptions

- **A-001**: El sistema ya tiene mecanismos de detección de eventos críticos (a través del Spec 002: Análisis de Logs) o mediante integración con herramientas de monitoreo (Prometheus, Datadog, etc.).
- **A-002**: Los equipos de respuesta (on-call) están disponibles y sus contactos están configurados en el sistema.
- **A-003**: Las categorías de incidente y políticas SLA están definidas y son consistentes con los compromisos con clientes y acuerdos internos.
- **A-004**: El idioma oficial de los textos de la interfaz, mensajes y reportes es español, con soporte para términos técnicos de gestión de incidentes (SLA, post-mortem, root cause, etc.).
- **A-005**: El módulo de gestión de incidentes depende del Spec 001 (inventario de servidores) para asociar incidentes a servidores registrados, y del Spec 002 (análisis de logs) para obtener eventos de log asociados.
- **A-006**: Los responsables de incidentes (on-call) son usuarios del sistema con roles definidos y horarios de turno configurables.

---

## Dependencies

- **Depende de Spec 001**: (server-inventory) Para asociación de incidentes a servidores registrados y aplicar RBAC.
- **Depende de Spec 002**: (log-analysis) Para obtener eventos de log que desencadenan la creación de incidentes.
- **Integra con**: Herramientas de notificación externas (email, Slack, PagerDuty) opcionales.
- **Extiende**: Spec 001 para RBAC y modelo de servidores; Spec 002 para clasificación y sanitización de logs.

## Constitution Check *(will be verified after planning)*

| Principio Constitucional | Estado | Evidencia de Cumplimiento en el Diseño |
|---|---|---|
| **I. SDD como Fuente de Verdad** | ✅ POR DEFINIR | Todo el diseño deriva de los requerimientos (FR-001 a FR-010) de spec.md. |
| **II. Seguridad desde el Diseño** | ✅ POR DEFINIR | Validación de entrada estricta; roles autenticados; canales seguros. |
| **III. Gestión Segura de Credenciales** | ✅ POR DEFINIR | 0% de secretos devueltos en GET/PATCH; datos sensibles en auditoría redactados. |
| **IV. Mínimo Privilegio y RBAC** | ✅ POR DEFINIR | Validación en dos capas (Middleware + Service Guard); rol OBSERVADOR solo lectura. |
| **V. Seguridad Operativa de Servidores** | ✅ POR DEFINIR | Análisis de logs es de solo lectura; no ejecuta comandos de modificación. |
| **VI. Evidencia y Trazabilidad** | ✅ POR DEFINIR | Tabla audit log append-only que registra cada transición con usuario y marcas. |
| **VII. Análisis de Logs Responsable** | ✅ POR DEFINIR | Diferenciación de hechos e inferencias en causas raíz; evidencias de soporte. |
| **VIII. Alertas y Ciclo de Incidente** | ✅ POR DEFINIR | Estados explícitos (OPEN, ASSIGNED, RESOLVED, CLOSED); SLA y anti-flapping. |
| **IX. Calidad y Pruebas Obligatorias** | ✅ POR DEFINIR | Estrategia de pruebas que cubre caminos felices, fallos de tiempo, RBAC. |
| **XII. Experiencia de Usuario y Accesibilidad** | ✅ POR DEFINIR | Estados con representación redundante (texto + iconos); idioma español. |
| **XIII. Privacidad y Exposición Mínima** | ✅ POR DEFINIR | Historial sin exposición masiva de datos sensibles; exports con filtrado. |

---