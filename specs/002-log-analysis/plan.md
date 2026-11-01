# Implementation Plan: Análisis de Logs y Diagnóstico Estructurado

**Branch**: `002-log-analysis` | **Date**: 2026-10-29 | **Spec**: [specs/002-log-analysis/spec.md](spec.md)

**Input**: Feature specification from `/specs/002-log-analysis/spec.md`

---

## Summary

Implementar el módulo de análisis de logs para la plataforma de monitoreo empresarial. Proporciona ingesta y clasificación automática de registros de logs en 10 categorías prioritarias, filtrado multifactorial, generación de diagnósticos asistidos estructurados con hechos observados y evidencias de soporte, detección de patrones anómalos con deduplicación de alertas, y control de acceso basado en roles (SUPERADMIN/OBSERVADOR). Cumple estrictamente con el Principio VII (Análisis de Logs Responsable) y los Principios II, III, IV, VI, VIII, XII y XIII de la Constitución.

---

## Technical Context

**Language/Version**: TypeScript 5.6+ / Node.js 24+ (`strict: true`, `noUncheckedIndexedAccess: true`).

**Primary Dependencies**:
- Web & API: Next.js 15+ (App Router, Server Components y Route Handlers)
- Validación de esquemas: Zod 3.23+
- Almacenamiento de logs: PostgreSQL 16+ con soporte JSONB para metadatos y categorías dinámicas
- ORM & Persistencia: Prisma ORM (extendido del spec 001)
- Procesamiento de logs: motor de ingesta en Node.js con colas internas para priorización
- Deduplicación de alertas: motor de correlación temporal en memoria/DB

**Storage**: PostgreSQL 16+ (extendido del spec 001) con tablas adicionales para `log_events`, `log_categories`, `incident_diagnoses`, `log_alerts`, `data_freshness_states`.

**Testing**:
- Unitarias y de Integración: Vitest con entorno Node.js
- Pruebas E2E: Playwright para validación de interfaces y flujos de usuario completos

**Target Platform**: Servidor Linux / Docker container auto-hospedado (compatible con Coolify, Docker Compose o VPS dedicado). Extiende el despliegue del spec 001.

**Project Type**: Aplicación web Full-Stack empresarial con APIs REST internas, módulo extendido del spec 001.

**Performance Goals**:
- Ingesta y clasificación de al menos 10,000 eventos de log por hora (SC-001)
- Filtrado de logs en menos de 2 segundos sobre 100,000 registros (SC-002)
- Timeout estricto de 5 segundos en operaciones de diagnóstico

**Constraints**:
- Cero exposición de secretos en logs almacenados, respuestas de API o interfaces (Principio III).
- Los raw logs se preservan inmutables (append-only) — ninguna rutina modifica el texto original (Principio VI).
- Control de acceso obligatorio en backend para cada ruta (Principio IV).
- Registros de auditoría append-only para toda acción administrativa (Principio VI).
- Estados de frescura explícitos sin interpretar ausencia de datos como salud (Principio VIII).
- Diagnósticos distinguen hechos de inferencias (Principio VII).

**Scale/Scope**: Repositorio de logs dimensionado para supervisar hasta 1,000 servidores concurrentes y decenas de millones de eventos de log mensuales, con decenas de operadores simultáneos.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio Constitucional | Estado | Evidencia de Cumplimiento en el Diseño |
|---|---|---|
| **I. SDD como Fuente de Verdad** | ✅ PASS | Todo el diseño deriva directamente de los requerimientos (`FR-001` a `FR-014`) de `spec.md`. |
| **II. Seguridad desde el Diseño** | ✅ PASS | Validación de entrada estricta mediante Zod en Route Handlers; sesiones autenticadas; canales HTTPS/TLS obligatorios. |
| **III. Gestión Segura de Credenciales** | ✅ PASS | Sanitización y enmascaramiento de secretos en logs antes del almacenamiento; 0% de secretos expuestos en GET/PATCH. |
| **IV. Mínimo Privilegio y RBAC** | ✅ PASS | Validación en dos capas (Middleware + Service Guard); rol OBSERVADOR restringido a solo lectura; exportación masiva solo SUPERADMIN. |
| **V. Seguridad Operativa de Servidores** | ✅ PASS | El análisis de logs es de solo lectura; no ejecuta comandos de modificación en servidores remotos. |
| **VI. Evidencia y Trazabilidad** | ✅ PASS | Raw logs inmutables (append-only); tabla de auditoría para ingestión, diagnósticos y cierres de incidente; sin secretos en auditoría. |
| **VII. Análisis de Logs Responsable** | ✅ PASS | 10 categorías de logs; diagnóstico estructurado con hechos/inferencias diferenciadas; evidencias de soporte; datos no confiables sanitizados. |
| **VIII. Alertas y Ciclo de Incidente** | ✅ PASS | Deduplicación de alertas; estados de frescura explícitos (`STALE_DATA`, `AGENT_DISCONNECTED`); no cerrar incidentes sin evidencias de recuperación. |
| **IX. Calidad y Pruebas Obligatorias** | ✅ PASS | Estrategia de pruebas que cubre ingesta masiva, deduplicación, sanitización, rechazos de autorización y cierre sin evidencias. |
| **X. Arquitectura Modular** | ✅ PASS | Capas desacopladas (Presentación, Dominio, Ingesta, Clasificación, Diagnóstico, Alertas, Repositorio). Extiende el spec 001. |
| **XI. Resiliencia y Recuperación** | ✅ PASS | Priorización de categorías críticas (Seguridad, Autenticación) en picos; timeouts estrictos; estados de frescura. |
| **XII. Experiencia de Usuario y Accesibilidad** | ✅ PASS | Estados con representación redundante (texto + iconos); idioma español; zonas horarias explícitas; navegación ≤ 3 clics. |
| **XIII. Privacidad y Exposición Mínima** | ✅ PASS | Enmascaramiento automático de PII y credenciales; retención configurable; exportación masiva restringida a SUPERADMIN. |
| **XIV. Operación Reproducible** | ✅ PASS | Variables de configuración 12-Factor en `.env`; migraciones reproducibles en PostgreSQL; guía detallada en `quickstart.md`. |
| **XV. Dependencias y Licencias** | ✅ PASS | Dependencias estándares auditadas; sin componentes externos de telemetría invasiva. |

---

## Phase 0: Research & Technical Decisions (Fase 0)

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

## Phase 1: Design & Contracts (Fase 1)

### data-model.md

Generado a continuación con el esquema de base de datos extendido.

### contracts/

Generado a continuación con el contrato OpenAPI 3.1 para la API de análisis de logs.

### quickstart.md

Generado a continuación con la guía de verificación E2E.

---

## Complexity Tracking

> **Sin violaciones a la Constitución**. Todas las decisiones técnicas respetan los 15 principios normativos sin requerir excepciones.

---

## Project Structure

### Documentation (this feature)

```text
specs/002-log-analysis/
├── spec.md                  # Especificación funcional aprobada
├── checklists/
│   └── requirements.md      # Lista de validación de calidad de requisitos
├── plan.md                  # Este plan de implementación técnico
├── research.md              # Decisiones técnicas y arquitectónicas (Fase 0)
├── data-model.md            # Esquema de base de datos y modelo de entidades (Fase 1)
├── contracts/
│   └── log-analysis-api.yaml # Contrato OpenAPI 3.1 para la API REST (Fase 1)
├── quickstart.md            # Guía de verificación de extremo a extremo (Fase 1)
└── tasks.md                 # Tareas dependency-ordered (generadas por /speckit.tasks)
```

### Source Code (repository root) — Extensión del spec 001

```text
src/
├── app/                                 # Next.js App Router (Páginas y API Route Handlers)
│   ├── (dashboard)/
│   │   └── logs/                        # Vistas del análisis de logs
│   │       ├── page.tsx                 # Consulta y filtrado de logs
│   │       ├── [id]/page.tsx            # Detalle de evento de log
│   │       ├── diagnosis/[id]/page.tsx  # Diagnóstico estructurado de incidente
│   │       └── alerts/page.tsx          # Gestión de alertas deduplicadas
│   └── api/
│       └── v1/
│           ├── logs/
│           │   ├── route.ts             # GET (listar con filtros) / POST (ingesta)
│           │   └── [id]/
│           │       ├── route.ts         # GET (detalle de evento)
│           │       └── diagnosis/       # POST (generar diagnóstico)
│           └── alerts/
│               ├── route.ts             # GET (listar alertas)
│               └── [id]/                # PATCH (reconocer/resolver alerta)
├── components/                          # Componentes de UI reutilizables
│   ├── logs/
│   │   ├── LogTable.tsx                 # Tabla de eventos con filtros
│   │   ├── LogCategoryBadge.tsx         # Badge de categoría (icono + texto)
│   │   ├── LogEventDetail.tsx           # Detalle de evento sanetizado
│   │   └── FreshnessBadge.tsx           # Badge de estado de frescura
│   ├── diagnosis/
│   │   ├── DiagnosisCard.tsx            # Tarjeta de diagnóstico estructurado
│   │   └── DiagnosisForm.tsx            # Formulario para solicitar diagnóstico
│   └── alerts/
│       ├── AlertTable.tsx               # Tabla de alertas deduplicadas
│       └── AlertBadge.tsx               # Badge de severidad de alerta
├── core/                                # Capa de Dominio y Lógica de Negocio
│   ├── domain/
│   │   ├── log-event.entity.ts          # Entidades de dominio de logs
│   │   ├── log.types.ts                 # Tipos: categoría, severidad, frescura
│   │   └── diagnosis.types.ts           # Tipos de diagnóstico estructurado
│   └── services/
│       ├── log-ingestion.service.ts     # Servicio de ingesta y clasificación
│       ├── log-query.service.ts         # Servicio de consulta y filtrado
│       ├── diagnosis.service.ts         # Servicio de diagnóstico estructurado
│       ├── alert-service.ts             # Servicio de deduplicación y alertas
│       ├── freshness.service.ts         # Servicio de estados de frescura
│       └── audit.service.ts             # Extendido del spec 001 (reuso)
├── infrastructure/                      # Capa de Infraestructura y Adaptadores
│   ├── db/
│   │   ├── schema.prisma                # Extendido con tablas de logs
│   │   └── prisma.ts                    # Reuso del spec 001
│   ├── log/
│   │   ├── classifier.ts                # Clasificador de categorías (10 categorías)
│   │   └── sanitizer.ts                 # Sanitizador de datos sensibles
│   └── security/
│       └── rbac-guard.ts                # Reuso del spec 001 (RBAC existente)
├── shared/                              # Validaciones compartidas
│   ├── validations/
│   │   └── log.schema.ts                # Esquemas Zod para logs
│   └── errors/
│       └── domain-errors.ts             # Reuso del spec 001
tests/
├── unit/
│   ├── log/classifier.test.ts           # Pruebas de clasificación de categorías
│   ├── log/sanitizer.test.ts            # Pruebas de enmascaramiento de secretos
│   └── domain/diagnosis.test.ts         # Pruebas de estructura de diagnóstico
├── integration/
│   ├── api/log-ingestion.test.ts        # Pruebas de endpoint de ingesta
│   ├── api/log-query.test.ts            # Pruebas de filtrado y consulta
│   ├── api/diagnosis.test.ts            # Pruebas de generación de diagnóstico
│   └── security/rbac-logs.test.ts       # Pruebas de autorización para OBSERVADOR
└── e2e/
    └── log-analysis.spec.ts             # Pruebas de flujo completo con Playwright
```

**Structure Decision**: Se adopta una arquitectura modular unificada basada en **Next.js App Router** con separación clara de capas, extendiendo la estructura del spec 001. Las capas `core` (reglas de negocio y entidades puras), `infrastructure` (acceso a datos, clasificación, sanitización) y `components`/`app` (presentación y API REST) se extienden con los módulos específicos de análisis de logs.

---

## Dependencies & Execution Order

### Phase Dependencies

```
[spec 001: server-inventory] ──► [Phase 0: Research] ──► [Phase 1: Design] ──► [Phase 2: Implementation] ──► [Phase 3: Tests] ──► [Phase 4: Polish]
```

- **spec 001 (server-inventory)**: Dependencia crítica. El módulo de logs depende del inventario de servidores para asociar eventos y aplicar RBAC.
- **Phase 0 (Research)**: Resuelve decisiones técnicas (DEC-001 a DEC-006). No bloquea el desarrollo de UI.
- **Phase 1 (Design)**: Define esquema de DB, contratos API y guía de verificación. Bloquea la implementación de servicios.
- **Phase 2 (Implementation)**: Implementa servicios, API routes y componentes UI.
- **Phase 3 (Tests)**: Pruebas unitarias, integración y seguridad.
- **Phase 4 (Polish)**: Pruebas E2E y documentación operativa.

### Parallel Opportunities

- **Research**: DEC-001 (ingesta), DEC-002 (almacenamiento), DEC-003 (sanitización) pueden desarrollarse en paralelo.
- **Design**: data-model.md y contracts/ pueden escribirse en paralelo tras research.md.
- **Implementation**: Clasificador, sanitizador y servicio de consulta pueden implementarse en paralelo tras el esquema de DB.

---

## Implementation Strategy

### Incremental Delivery

1. **Incremento 1 (MVP)**: Ingesta y clasificación de logs con filtrado básico y sanitización de secretos.
2. **Incremento 2**: Diagnósticos asistidos estructurados con evidencias de soporte.
3. **Incremento 3**: Motor de alertas con deduplicación y estados de frescura.
4. **Incremento 4**: Batería E2E y documentación operativa de análisis de logs.

---
