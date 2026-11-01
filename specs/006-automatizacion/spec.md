# Feature Specification: Automatización y Playbooks

**Feature Branch**: `006-automatizacion`  
**Created**: 2026-10-30  
**Status**: Draft  
**Input**: User description: "Motor de automatización y playbooks para remediación automática de incidentes detectados, con flujos configurables, condiciones de activación, acciones condicionales y registro de ejecuciones, cumpliendo Principios V, VII, VIII, IX, XI y XIII de la Constitución."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Creación de Playbooks de Automatización (Priority: P1)

Como **SUPERADMIN**, quiero crear playbooks de automatización con flujos configurables de acciones condicionales para incidentes críticos, para que el sistema pueda tomar medidas automáticas cuando ocurren eventos críticos sin intervención humana.

**Why this priority**: Es la base del sistema de automatización. Sin playbooks, el sistema solo puede notificar pero no actuar automáticamente.

**Independent Test**: Puede probarse creando un playbook simple (ej. reiniciar servicio cuando falla) y verificando que se ejecuta automáticamente cuando se desencadena el evento.

**Acceptance Scenarios**:

1. **Creación de playbook básico**:
   - **Given** que un SUPERADMIN accede al creador de playbooks
   - **When** define un playbook con: condición (ej. "error de base de datos"), acción (ej. "reiniciar servicio PostgreSQL"), y horario de ejecución
   - **Then** el sistema guarda el playbook en estado `ACTIVO` y está listo para ser desencadenado

2. **Playbook con acciones condicionales**:
   - **Given** que un playbook tiene múltiples pasos con condiciones "SI/NO"
   - **When** se ejecuta el evento trigger
   - **Then** el sistema ejecuta cada paso solo cuando sus condiciones se cumplen, y registra el resultado de cada paso

---

### User Story 2 - Ejecución Automática de Playbooks (Priority: P1)

Como **SUPERADMIN**, quiero que los playbooks se ejecuten automáticamente cuando se cumplen las condiciones de activación, para que la remediación ocurra sin intervención humana y se reduzca el MTTR.

**Why this priority**: El valor fundamental de la automatización es reducir el tiempo de respuesta y liberar a los operadores de tareas repetitivas.

**Independent Test**: Puede probarse desencadenando un evento y verificando que el playbook se ejecuta automáticamente en el tiempo esperado.

**Acceptance Scenarios**:

1. **Ejecución automática al detectar evento**:
   - **Given** que un incidente crítico se crea con una condición de playbook match
   - **When** el motor de automatización detecta el evento
   - **Then** el playbook se ejecuta automáticamente: pasos condicionales, registro de resultados y notificación de conclusión

2. **Ejecución manual bajo demanda**:
   - **Given** que un playbook existe y está activo
   - **When** un SUPERADMIN lo ejecuta manualmente desde la interfaz
   - **Then** el sistema ejecuta todos los pasos del playbook y muestra el resultado, sin afectar la ejecución automática futura

---

### User Story 3 - Acciones y Pasos de Playbook (Priority: P2)

Como **SUPERADMIN**, quiero definir los pasos accionables dentro de un playbook: reiniciar servicios, aplicar configuraciones, ejecutar comandos controlados, y notificar a equipos, con validación de resultados y registro de ejecución, para que la automatización sea segura y verificable.

**Why this priority**: Las acciones deben ser seguras, reversibles cuando sea posible y totalmente registradas para auditoría.

**Independent Test**: Puede probarse un playbook con múltiples acciones y verificar que cada una se ejecuta, registra su resultado y el playbook completa su flujo.

**Acceptance Scenarios**:

1. **Acción: Reiniciar servicio**:
   - **Given** que un playbook incluye la acción "reiniciar servicio PostgreSQL"
   - **When** se ejecuta el playbook
   - **Then** el sistema ejecuta el reinicio mediante comando controlado (no root directo), registra el resultado (éxito/fallo, tiempo de ejecución) y continúa con el siguiente paso

2. **Acción: Aplicar configuración**:
   - **Given** que un playbook incluye "aplicar configuración de firewall"
   - **When** se ejecuta
   - **Then** el sistema entrega la configuración al agente del servidor, verifica el resultado y registra el hash de configuración antes/después

3. **Acción: Notificar equipo**:
   - **Given** que un playbook incluye "notificar al equipo de turno"
   - **When** se ejecuta este paso
   - **Then** el sistema envía notificación al canal configurado y registra la entrega en el historial

---

### User Story 4 - Validación y Rollback (Priority: P2)

Como **SUPERADMIN**, quiero que los playbooks tengan validación previa y opciones de rollback, para que las automatizaciones seguras no causen daños y puedan reversarse si es necesario.

**Why this priority**: La seguridad es primordial en automatización; acciones sin validación o rollback pueden causar outages.

**Independent Test**: Puede probarse un playbook que incluya una acción de riesgo y verificar que el sistema solicita confirmación y ofrece rollback.

**Acceptance Scenarios**:

1. **Validación previa a ejecución**:
   - **Given** que un playbook incluye una acción de "aplicar configuración crítica"
   - **When** el sistema va a ejecutarlo
   - **Then** solicita confirmación explícita al SUPERADMIN y muestra resumen de qué cambios se harán

2. **Rollback automático**:
   - **Given** que un playbook ejecutó una acción que tuvo efecto negativo
   - **When** el sistema detecta el efecto negativo o el SUPERADMIN lo solicita
   - **Then** el sistema ejecuta la acción de rollback configurada y registra ambas ejecuciones en el historial

---

### User Story 5 - Historial y Auditoría de Ejecuciones (Priority: P3)

Como **SUPERADMIN**, quiero ver el historial completo de ejecuciones de playbooks con resultados, tiempos, responsables y logs detallados, para auditoría y mejora continua de las automatizaciones.

**Why this priority**: El historial es esencial para entender qué automatizaciones funcionaron, cuáles fallaron y por qué, y para cumplir con requisitos de auditoría.

**Independent Test**: Puede probarse la ejecución de un playbook y verificando que aparece en el historial con todos los datos requeridos.

**Acceptance Scenarios**:

1. **Ver historial de ejecuciones**:
   - **Given** que se han ejecutado varios playbooks
   - **When** un SUPERADMIN consulta el historial
   - **Then** muestra lista con: playbook nombre, fecha/hora, estado (éxito/fallo/parado), duración, responsable y enlace a logs detallados

2. **Filtrado y búsqueda en historial**:
   - **Given** que el historial tiene muchas ejecuciones
   - **When** se aplican filtros por playbook, fecha, estado o palabras clave en logs
   - **Then** el sistema filtra y muestra solo las ejecuciones que coinciden con los criterios

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema **MUST** permitir crear playbooks con flujos configurables de acciones condicionales, con nombre, descripción, condición de activación y horario de ejecución.
- **FR-002**: El sistema **MUST** ejecutar playbooks automáticamente cuando se cumplen las condiciones de activación (eventos de incidentes, horas programadas, webhooks externos).
- **FR-003**: El sistema **MUST** cada paso de playbook tenga un tipo de acción definido: `reiniciar_servicio`, `aplicar_configuracion`, `ejecutar_comando`, `notificar_equipo`, `validar_estado`, `esperar_tiempo`.
- **FR-003**: El sistema **MUST** cada paso de playbook tenga validación de resultados y registro de ejecución (éxito, fallo, tiempo de ejecución).
- **FR-004**: El sistema **MUST** permitir acciones condicionales `SI/NO` entre pasos, donde el flujo continúa según el resultado del paso anterior.
- **FR-004**: El sistema **MUST** incluir acciones de rollback y validación previa a ejecución para playbooks con riesgo medio/alto.
- **FR-005**: El sistema **MUST** distinguir roles: SUPERADMIN puede crear/ejecutar/borrar playbooks y ver historial; OBSERVADOR puede ver playbooks activos y historial, **MUST NOT** ejecutar o modificar playbooks.
- **FR-006**: El sistema **MUST** registrar auditoría append-only para cada ejecución de playbook: playbook nombre, fecha/hora, estado, duración, responsable, resumen de acciones y resultados.
- **FR-007**: El sistema **MUST** ejecutar acciones de forma aislada (sandbox o entorno controlado) y con permisos mínimos necesarios, siguiendo el Principio V (sin ejecución remota de comandos de modificación sin autorización).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un SUPERADMIN puede crear un playbook básico en menos de 5 minutos desde la interfaz.
- **SC-002**: Un playbook se ejecuta automáticamente dentro de los 2 minutos posteriores al evento trigger.
- **SC-003**: El 80% de los playbooks ejecutados completan todas sus acciones exitosamente en el primer intento.
- **SC-004**: 100% de las ejecuciones de playbooks quedan registradas en el auditoría sin pérdida de datos.
- **SC-005**: Las acciones de rollback tienen éxito en el 95% de los casos cuando se solicita.
- **SC-005**: Las operaciones de playbooks se ejecutan con permisos mínimos y en entornos aislados, sin riesgo de daño al sistema operativo.

---

## Assumptions

- **A-001**: El sistema ya tiene agentes o adaptadores para ejecutar acciones controladas (reinicio de servicios, aplicación de configuraciones, comandos limitados).
- **A-002**: Los servidores supervisados tienen agentes instalados que pueden recibir comandos controlados a través de canales seguros (SSH con llaves, API segura, o protocolo propietario).
- **A-003**: Las acciones de playbook están limitadas a operaciones seguras y reversible cuando es posible (reinicios de servicios, actualizaciones de configuración, notificaciones).
- **A-004**: El lenguaje de descripción de playbooks sigue un formato estructurado (YAML/JSON) con condiciones expresables.
- **A-005**: El módulo de automatización depende del Spec 003 (incident-management) para los eventos trigger, y del Spec 001 (server-inventory) para información de servicios y credenciales cifradas.

---

## Dependencies

- **Depende de Spec 003**: (incident-management) Para los eventos trigger (creación, escalado, resolución de incidentes) que activan los playbooks.
- **Depende de Spec 001**: (server-inventory) Para información de servicios, credenciales cifradas y detalles de conexión para acciones de automatización.
- **Integra con**: Agentes de ejecución en servidores supervisados, y herramientas de terceros para acciones específicas (AWS API, Azure CLI, etc.).
- **Extiende**: Spec 001 para RBAC y modelo de credenciales; Spec 003 para modelo de incidentes ytrigger events.

## Constitution Check *(will be verified after planning)*

| Principio Constitucional | Estado | Evidencia de Cumplimiento en el Diseño |
|---|---|---|
| **I. SDD como Fuente de Verdad** | ✅ POR DEFINIR | Todo el diseño técnico deriva de los requerimientos (`FR-001` a `FR-007`) de `spec.md`. |
| **II. Seguridad desde el Diseño** | ✅ POR DEFINIR | Validación de entrada estricta mediante Zod en Route Handlers; sesiones autenticadas; canales seguros. |
| **III. Gestión Segura de Credenciales** | ✅ POR DEFINIR | Credenciales de acceso a servidores cifradas AES-256-GCM; 0% de secretos en interfaces. |
| **IV. Mínimo Privilegio y RBAC** | ✅ POR DEFINIR | Validación en dos capas (Middleware + Service Guard); rol OBSERVADOR sin permisos de ejecución. |
| **V. Seguridad Operativa de Servidores** | ✅ POR DEFINIR | Playbooks ejecutan acciones aisladas con permisos mínimos; sin comandos de modificación directa sin autorización. |
| **VII. Análisis de Logs Responsable** | ✅ POR DEFINIR | Registros de ejecución de playbooks tratados como datos no confiables, sanitizados antes del almacenamiento. |
| **VIII. Alertas y Ciclo de Incidente** | ✅ POR DEFINIR | Playbooks activados por eventos de incidentes; estados explícitos de ejecución. |
| **IX. Calidad y Pruebas Obligatorias** | ✅ POR DEFINIR | Estrategia de pruebas que cubre creación, ejecución, validación, rollback y auditoría. |
| **XI. Resiliencia y Recuperación** | ✅ POR DEFINIR | Validación previa, rollback, y aislamiento de ejecuciones para prevenir daños colaterales. |
| **XII. Experiencia de Usuario y Accesibilidad** | ✅ POR DEFINIR | Interfaz de creación de playbooks intuitiva; flujo de aprobación para acciones de riesgo. |
| **XIII. Privacidad y Exposición Mínima** | ✅ POR DEFINIR | Datos de ejecución de playbooks sin exposición de credenciales ni información sensible del sistema. |

---