# Phase 0: Research & Technical Decisions (002-log-analysis)

**Feature**: `002-log-analysis`  
**Date**: 2026-10-29  
**Status**: Completed  

---

## 1. Decisiones Técnicas y Arquitectónicas

### DEC-001: Motor de Ingesta y Clasificación de Logs

- **Decisión**: Motor de ingesta en Node.js (Next.js Route Handlers + workers internos) que recibe logs mediante endpoint REST, los clasifica en 10 categorías usando reglas basadas en patrones (regex, keywords, syslog facility), y los persiste en PostgreSQL con JSONB para metadatos dinámicos.
- **Rationale**: Permite una arquitectura unificada con el spec 001 (mismo stack Next.js + Prisma + PostgreSQL), evitando la complejidad de un sistema de ingestión separado (ej. Elasticsearch, Splunk) para el alcance inicial. La clasificación basada en reglas es determinista y verificable, cumpliendo el Principio VII.
- **Alternativas consideradas**:
  - *Elasticsearch / OpenSearch*: Potente para búsqueda full-text, pero añade infraestructura pesada y complejidad operativa para despliegues auto-hospedados iniciales.
  - *Splunk / Datadog*: SaaS externo que rompe el modelo self-hosted y expone datos sensibles a terceros (Principio XIII).

### DEC-002: Almacenamiento y Estructura de Datos de Logs

- **Decisión**: Extender el esquema Prisma del spec 001 con nuevas tablas: `log_events` (eventos individuales), `log_categories` (catálogo de 10 categorías), `incident_diagnoses` (diagnósticos estructurados), `log_alerts` (alertas deduplicadas), `data_freshness_states` (estado de frescura por servidor). Uso de JSONB para metadatos flexibles y índices compuestos para filtrado rápido.
- **Rationale**: Mantiene la integridad referencial y transaccional ACID (Principio VI), permite consultas indexadas por categoría/servidor/fecha (SC-002), y reusa la infraestructura existente del spec 001.
- **Alternativas consideradas**:
  - *Base de datos de series temporales (InfluxDB, TimescaleDB)*: Adecuada para métricas, pero menos flexible para logs estructurados con categorización compleja y diagnósticos asociados.

### DEC-003: Sanitización y Enmascaramiento de Datos Sensibles

- **Decisión**: Capa de sanitización en el servicio de ingesta que detecta y enmascara patrones de contraseñas, tokens, claves privadas, PII y credenciales antes de persistir. El texto original crudo se almacena como "raw log" inmutable pero con campos sensibles ya enmascarados; nunca se indexa en texto claro.
- **Rationale**: Cumple estrictamente con el Principio III (cero exposición de secretos) y Principio XIII (privacidad y exposición mínima de datos).
- **Alternativas consideradas**:
  - *Enmascaramiento solo en lectura (no en ingestión)*: Riesgo de que secretos queden almacenados en texto claro en la base de datos, violando el Principio III. Descartado.

### DEC-004: Motor de Diagnóstico Estructurado

- **Decisión**: Servicio de dominio que genera diagnósticos asistidos a partir de eventos de log relacionados, con las secciones obligatorias: Hechos observados, Causa probable, Evidencias de soporte, Diagnósticos alternativos, Impacto potencial, Pasos de verificación, Recomendaciones de solución, Nivel de confianza y limitaciones. Hechos e inferencias se presentan en secciones diferenciadas.
- **Rationale**: Cumple el Principio VII al diferenciar rigurosamente hechos constatables de hipótesis, y al exigir evidencias de soporte verificables para cada diagnóstico.
- **Alternativas consideradas**:
  - *Diagnóstico basado exclusivamente en LLM/IA*: Riesgo de alucinaciones y supuestos no verificados en infraestructura crítica (Principio VII, punto 2 y 6). Descartado para v1; la IA puede ser un asistente opcional en futuras versiones.

### DEC-005: Deduplicación y Correlación de Alertas

- **Decisión**: Motor de alertas que agrupa eventos idénticos o correlacionados en una única alerta con conteo y ventana temporal, aplicando deduplicación por servidor+categoría+patrón y correlación temporal para eventos concurrentes en múltiples servidores.
- **Rationale**: Cumple el Principio VIII (anti-flapping, control de frecuencia, correlación de eventos concurrentes) y evita la fatiga de alertas del operador.
- **Alternativas consideradas**:
  - *Alerta por cada evento individual*: Generaría saturación y fatiga de alertas, violando el Principio VIII. Descartado.

### DEC-006: Estados de Frescura de Datos

- **Decisión**: Tabla `data_freshness_states` que registra el estado de actualidad de los datos por servidor: `FRESH`, `STALE`, `AGENT_DISCONNECTED`, `UNREACHABLE`. Actualizado por el motor de ingesta basado en la última recepción de telemetría.
- **Rationale**: Cumple el Principio VIII (punto 2: diferenciar frescura de datos; impidiendo que la ausencia de telemetría se interprete como normalidad).
- **Alternativas consideradas**:
  - *Solo usar health_status del spec 001*: Insuficiente, ya que health_status refleja conectividad de red, no frescura de datos de logs. Se necesita estado independiente.

---

## 2. Resumen de Respuestas a Posibles Ambigüedades

1. **¿Se permite el borrado físico de logs antiguos?**
   - No directamente. Se implementa retención configurable con archivado o eliminación segura programada (Principio XIII). Los logs se marcan como caducos y se elimina según ventana de retención definida por categoría.

2. **¿Quién puede generar diagnósticos?**
   - Solo SUPERADMIN puede generar y modificar diagnósticos. OBSERVADOR puede consultar diagnósticos existentes pero no crear ni editarlos (Principio IV).

3. **¿Cómo se manejan los logs de servidores no registrados en el inventario (spec 001)?**
   - Los eventos de log de servidores desconocidos se almacenan con `server_id` nulo y se marcan para revisión del SUPERADMIN. No se asocian automáticamente a un servidor del inventario hasta que sea dado de alta.

4. **¿La plataforma instala agentes en los servidores supervisados?**
   - No. La ingesta se realiza mediante un endpoint REST al que los servidores envían sus logs (syslog reenviado, agente local existente, o API). No se instala software intrusivo (Principio V, punto 3).

---
