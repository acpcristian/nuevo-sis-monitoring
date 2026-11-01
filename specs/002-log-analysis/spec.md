# Feature Specification: Análisis de Logs y Diagnóstico Estructurado

**Feature Branch**: `002-log-analysis`  
**Created**: 2026-10-29  
**Status**: Draft  
**Input**: User description: "Módulo de análisis de logs: recopilar, clasificar, estructurar e interpretar registros de logs procedentes de múltiples subsistemas (SO/kernel, autenticación, SSH/red, servicios, aplicaciones web, bases de datos, almacenamiento, backups, seguridad, errores de agentes), generando diagnósticos asistidos con hechos observados, causa probable, evidencias de soporte y recomendaciones, sin depender exclusivamente de inferencias o IA."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ingesta y clasificación de logs de servidores (Priority: P1)

Como **SUPERADMIN** u **OBSERVADOR**, quiero que la plataforma ingiera y clasifique automáticamente los registros de logs de los servidores supervisados por categoría (SO, autenticación, red, servicios, aplicaciones, bases de datos, almacenamiento, backups, seguridad, agentes), para que los eventos estén organizados y sean localizables rápidamente durante una investigación de incidente.

**Why this priority**: Es la base del módulo de análisis. Sin ingesta y clasificación estructurada de logs, no es posible generar diagnósticos ni alertas accionables.

**Independent Test**: Puede probarse enviando un lote de logs de ejemplo de diferentes categorías y verificando que cada evento se almacena con su categoría correcta, marca temporal de origen, marca temporal de ingestión y servidor asociado.

**Acceptance Scenarios**:

1. **Ingesta de log de autenticación SSH**:
   - **Given** que un servidor Linux envía un log de intento de autenticación SSH fallido,
   - **When** la plataforma recibe el registro mediante el canal de ingestión,
   - **Then** el evento se clasifica en la categoría "Autenticación, sesiones y accesos", se almacena con `event_timestamp` (momento del evento en el origen), `ingestion_timestamp` (momento de recepción), `server_id` y el texto original sin modificar.

2. **Ingesta de log de aplicación web**:
   - **Given** que un servidor Windows envía un log de error de aplicación IIS,
   - **When** se procesa el registro,
   - **Then** se clasifica en la categoría "Aplicaciones y servidores web" y se asocia al servidor correspondiente.

3. **Sanitización de datos sensibles en logs**:
   - **Given** que un log entrante contiene una contraseña embebida, token de sesión o clave privada,
   - **When** la plataforma ingesta el registro,
   - **Then** el valor sensible se enmascara o sustituye por `[REDACTED]` antes de almacenarse, y el texto original crudo no queda indexado en texto claro.

---

### User Story 2 - Consulta y filtrado de logs por categoría y servidor (Priority: P1)

Como **SUPERADMIN** u **OBSERVADOR**, quiero consultar el repositorio de logs con filtros por categoría, servidor, rango de fechas y severidad, para localizar rápidamente los eventos relevantes durante una investigación de incidente.

**Why this priority**: Permite al equipo de guardia encontrar evidencias específicas sin revisar manualmente miles de registros, reduciendo el tiempo medio de resolución (MTTR).

**Independent Test**: Puede verificarse aplicando filtros combinados (categoría + servidor + rango de fechas) y comprobando que solo se devuelven los eventos que coinciden con todos los criterios, protegendo datos sensibles para OBSERVADOR.

**Acceptance Scenarios**:

1. **Filtrado multifactorial de logs**:
   - **Given** un repositorio con logs de múltiples servidores y categorías,
   - **When** un usuario filtra por categoría "Seguridad", servidor "srv-db-prod-01" y rango de fechas de las últimas 24 horas,
   - **Then** la interfaz lista únicamente los eventos que coinciden con los tres criterios, mostrando categoría, servidor, timestamp y mensaje sanetizado.

2. **Protección de datos sensibles para OBSERVADOR**:
   - **Given** que un usuario con rol OBSERVADOR consulta un log que contiene credenciales enmascaradas,
   - **When** examina el detalle del evento,
   - **Then** el sistema muestra únicamente el mensaje ya sanetizado (con `[REDACTED]`) y nunca revela el valor original del secreto.

---

### User Story 3 - Diagnóstico estructurado de incidentes (Priority: P1)

Como **SUPERADMIN**, quiero que la plataforma genere un diagnóstico asistido para un incidente detectado, estructurado en: hechos observados, causa probable, evidencias de soporte, diagnósticos alternativos, impacto potencial, pasos de verificación, recomendaciones de solución y nivel de confianza, para fundamentar decisiones de remediación sin depender exclusivamente de conjeturas.

**Why this priority**: Diferencia rigurosamente los hechos constatables de las inferencias, evitando diagnósticos erróneos basados en alucinaciones o supuestos no verificados, lo cual es crítico en entornos de infraestructura.

**Independent Test**: Puede probarse seleccionando un conjunto de eventos de log relacionados y verificando que el diagnóstico generado incluye todas las secciones requeridas con referencias concretas a líneas de log y marcas temporales.

**Acceptance Scenarios**:

1. **Generación de diagnóstico con evidencias**:
   - **Given** una serie de eventos de log de fallo de conexión a base de datos,
   - **When** el operador solicita un diagnóstico para el incidente asociado,
   - **Then** el sistema devuelve un diagnóstico estructurado que cita específicamente las líneas de log, marcas temporales y servidores involucrados como evidencias de soporte.

2. **Distinción entre hechos e inferencias**:
   - **Given** un diagnóstico generado automáticamente,
   - **When** el operador revisa la sección de "Causa probable",
   - **Then** el sistema identifica claramente qué parte son hechos observados (extraídos directamente de logs) y qué parte son hipótesis de diagnóstico, sin presentar inferencias como hechos consumados.

3. **No declarar resuelto sin evidencias**:
   - **Given** un incidente marcado como resuelto,
   - **When** se verifica la telemetría asociada,
   - **Then** el sistema exige señales verificables de normalización del servicio antes de aceptar el cierre; de lo contrario, alerta que falta evidencia de recuperación.

---

### User Story 4 - Alertas por patrones de log y deduplicación (Priority: P2)

Como **SUPERADMIN**, quiero que la plataforma detecte patrones anómalos en los logs (tormentas de eventos, errores repetidos, fallos de autenticación masivos) y emita alertas deduplicadas y correlacionadas, para evitar la fatiga de alertas y enfocar la atención en los incidentes realmente críticos.

**Why this priority**: Evita la saturación del operador con alertas duplicadas o irrelevantes, asegurando que las notificaciones sean accionables y priorizadas por impacto.

**Independent Test**: Puede verificarse generando un volumen alto de eventos de error idénticos y comprobando que se emite una única alerta agrupada en lugar de múltiples alertas individuales.

**Acceptance Scenarios**:

1. **Deduplicación de alertas por tormenta de eventos**:
   - **Given** que se generan 100 eventos de error idénticos en un minuto desde el mismo servidor,
   - **When** el motor de alertas evalúa los eventos,
   - **Then** se emite una única alerta agrupada con el conteo de eventos y la ventana de tiempo, no 100 alertas separadas.

2. **Correlación de eventos concurrentes**:
   - **Given** que ocurren simultáneamente fallos de conectividad en múltiples servidores del mismo cluster,
   - **When** el sistema analiza la correlación temporal,
   - **Then** las alertas se agrupan bajo un incidente común indicando el alcance afectado.

---

### Edge Cases

- **Logs con formato inesperado o corrupto**: Si un registro de log no cumple con el esquema esperado, el sistema debe almacenarlo como "datos no confiables" con categoría "Errores de agentes, conectividad y canal de telemetría", marcarlo como sin estructurar y alertar al SUPERADMIN sin interrumpir la ingesta de otros logs.
- **Ausencia de telemetría (datos caducos/stale)**: Si un servidor deja de enviar logs durante un período configurado, el sistema debe presentar el estado explícito `STALE_DATA` o `AGENT_DISCONNECTED`, sin interpretar la ausencia de datos como salud satisfactoria.
- **Logs de gran volumen (ingesta masiva)**: Durante picos de telemetría, el sistema debe priorizar la ingestión de eventos de categoría "Seguridad" y "Autenticación" sobre categorías de menor criticidad, sin perder eventos críticos.
- **Zona horaria inconsistente en logs de origen**: Si un servidor envía marcas temporales sin zona horaria o con zona horaria diferente a la del operador, el sistema debe normalizar todas las marcas a UTC y mostrar explícitamente la zona horaria de referencia en la interfaz.
- **Intento de declarar resuelto un incidente sin telemetría de recuperación**: El sistema debe bloquear el cierre del incidente y exigir evidencias verificables de normalización antes de permitir el cambio de estado.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema **MUST** ingestar registros de logs de servidores supervisados, almacenando para cada evento: identificador único, servidor asociado, categoría de log, marca temporal del evento en el origen (`event_timestamp`), marca temporal de ingestión (`ingestion_timestamp`), marca temporal de procesamiento (`processed_timestamp`), tipo de evento, severidad y mensaje del log.
- **FR-002**: El sistema **MUST** clasificar cada evento de log en una de las diez categorías prioritarias: (1) Sistema operativo y kernel, (2) Autenticación, sesiones y accesos, (3) SSH y conectividad de red, (4) Servicios del sistema y procesos, (5) Aplicaciones y servidores web, (6) Motores de bases de datos, (7) Almacenamiento, sistemas de archivos y hardware, (8) Copias de seguridad y tareas programadas, (9) Seguridad, auditoría y eventos potencialmente sospechosos, (10) Errores de agentes, conectividad y canal de telemetría.
- **FR-003**: El sistema **MUST** tratar todo contenido textual procedente de logs y respuestas de servidores como **datos no confiables (untrusted data)**, sanearlos adecuadamente para neutralizar riesgos de inyección de comandos, XSS y manipulación contextual, y enmascarar contraseñas, tokens, credenciales e información sensible antes del almacenamiento.
- **FR-004**: El sistema **MUST** preservar los registros originales de log (**raw logs**) de forma inmutable y append-only; ninguna rutina de enriquecimiento, normalización o inferencia **MUST** modificar el contenido textual original del log recibido.
- **FR-005**: El sistema **MUST** generar diagnósticos asistidos estructurados con las siguientes secciones mínimas: Hechos observados, Causa probable, Evidencias de soporte, Diagnósticos alternativos, Impacto potencial, Pasos de verificación, Recomendaciones de solución, Nivel de confianza y limitaciones.
- **FR-006**: El sistema **MUST** distinguir rigurosamente entre hechos constatables (extraídos directamente de los logs) e inferencias o hipótesis de diagnóstico, presentándolos en secciones claramente diferenciadas.
- **FR-007**: El sistema **MUST** citar evidencias de soporte específicas (líneas de log, marcas temporales, identificadores de servidor) para cada diagnóstico generado.
- **FR-008**: El sistema **MUST NOT** declarar un incidente como resuelto sin constatar señales verificables de telemetría que acrediten la normalización del servicio.
- **FR-009**: El sistema **MUST** proporcionar filtrado de logs por categoría, servidor, rango de fechas, severidad y búsqueda textual sobre el mensaje sanetizado.
- **FR-010**: El sistema **MUST** aplicar control de acceso por rol: SUPERADMIN puede consultar, filtrar, exportar y gestionar diagnósticos; OBSERVADOR puede consultar y filtrar logs pero **MUST NOT** exportar masivamente ni modificar diagnósticos.
- **FR-011**: El sistema **MUST** detectar y deduplicar alertas por tormenta de eventos, agrupando eventos idénticos o correlacionados en una única alerta con conteo y ventana temporal.
- **FR-012**: El sistema **MUST** presentar estados explícitos de frescura de datos: `ONLINE` (datos frescos), `DEGRADED` (latencia excesiva), `STALE_DATA` (datos desactualizados por interrupción de telemetría), `AGENT_DISCONNECTED` (agente desconectado), `UNREACHABLE` (servidor inaccesible), impidiendo que la ausencia de telemetría se interprete como normalidad.
- **FR-013**: Toda acción de ingestión, clasificación, generación de diagnóstico o cierre de incidente **MUST** generar un evento de auditoría append-only que registre: identificador del usuario, fecha/hora con zona horaria, tipo de acción y servidores afectados (excluyendo secretos).
- **FR-014**: La interfaz **MUST** presentar estados de criticidad y severidad mediante múltiples canales perceptivos (iconos, texto explícito, contrastes) y **MUST NOT** depender exclusivamente del color.

### Key Entities *(include if feature involves data)*

- **Evento de Log (Log Event)**: Representa un registro individual de log ingerido. Atributos clave: identificador único, servidor asociado, categoría, `event_timestamp`, `ingestion_timestamp`, `processed_timestamp`, tipo de evento, severidad, mensaje sanetizado, texto original inmutable (raw log), indicador de datos no confiables.
- **Categoría de Log (Log Category)**: Una de las diez categorías prioritarias definidas en FR-002, usada para clasificación y filtrado.
- **Diagnóstico de Incidente (Incident Diagnosis)**: Estructura generada para un incidente, conteniendo: hechos observados, causa probable, evidencias de soporte (referencias a eventos de log), diagnósticos alternativos, impacto potencial, pasos de verificación, recomendaciones, nivel de confianza, marca temporal y usuario generador.
- **Alerta de Log (Log Alerta)**: Notificación generada por detección de patrones anómalos, conteniendo: tipo de patrón, servidores afectados, conteo de eventos, ventana temporal, severidad, estado (activa, reconocida, resuelta) y eventos asociados.
- **Estado de Frescura (Data Freshness State)**: Estado que indica la actualidad de los datos de un servidor: `FRESH`, `STALE`, `AGENT_DISCONNECTED`, `UNREACHABLE`.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: La plataforma puede ingestar y clasificar al menos 10,000 eventos de log por hora sin pérdida de eventos críticos (categorías Seguridad y Autenticación priorizadas).
- **SC-002**: Un usuario puede localizar eventos de log relevantes aplicando filtros combinados (categoría + servidor + fecha) en menos de 2 segundos sobre un repositorio de al menos 100,000 registros.
- **SC-003**: El 100% de los logs que contienen credenciales, tokens o secretos se enmascaran antes del almacenamiento (0% de exposición de secretos en reposo).
- **SC-004**: El 100% de los diagnósticos generados incluyen referencias comprobables a líneas de log o marcas temporales como evidencias de soporte.
- **SC-005**: Durante una tormenta de 1,000 eventos idénticos, el sistema emite una única alerta agrupada en lugar de múltiples alertas individuales (reducción ≥ 99% en volumen de alertas).
- **SC-006**: El sistema no permite marcar un incidente como resuelto sin evidencias verificables de telemetría en el 100% de los casos probados.

---

## Assumptions

- **A-001**: Los servidores supervisados cuentan con agentes de recolecta de logs previamente configurados que envían registros a la plataforma mediante un canal definido (syslog, agente local, o API de ingestión).
- **A-002**: El sistema de usuarios y autenticación de la plataforma provee la identidad del usuario y su rol verificado (**SUPERADMIN** u **OBSERVADOR**) en cada solicitud entrante (dependencia del spec 001).
- **A-003**: Los registros de logs de origen incluyen al menos una marca temporal del evento; si no la incluyen, la plataforma usará la marca de ingestión como aproximación y lo indicará explícitamente.
- **A-004**: El idioma oficial de los textos de diagnóstico, mensajes de error y categorías de logs es español, con soporte para términos técnicos de industria estándar (SSH, syslog, kernel, IIS, etc.).
- **A-005**: La retención de logs sigue una ventana configurable por categoría, con eliminación segura o archivado de telemetría caduca conforme al Principio XIII de la Constitución.
- **A-006**: El módulo de análisis de logs depende del inventario de servidores del spec 001 para asociar eventos a servidores existentes y aplicar control de acceso basado en los roles definidos allí.

---
