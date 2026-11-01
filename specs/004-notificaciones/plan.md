# Implementation Plan: Notificaciones y Alertas

**Branch**: `004-notificaciones` | **Date**: 2026-10-30 | **Spec**: [spec.md](spec.md)

## Summary

Implementar un sistema de notificaciones y alertas multi-canal para la plataforma de monitoreo empresarial. Proporciona configuración de canales (email, Slack, Webhooks, PagerDuty), envío automático de notificaciones ante eventos críticos, deduplicación de alertas para evitar fatiga de operadores, reintentos con backoff exponencial para garantía de entregabilidad, y enrutamiento inteligente basado en reglas de horario, tipo de evento y severidad. Garantiza cero exposición de secretos y control estricto de acceso basado en roles (SUPERADMIN vs. OBSERVADOR).

## Technical Context

**Language/Version**: TypeScript 5.6+ / Node.js 24+ (`strict: true`, `noUncheckedIndexedAccess: true`).

**Primary Dependencies**:
- Web & API: Next.js 15+ (App Router, Server Components y Route Handlers)
- Validación de esquemas: Zod 3.23+
- Criptografía: Módulo nativo `node:crypto` (AES-256-GCM)
- Red y Monitoreo: Integración con herramientas de notificación (SMTP, Slack API, PagerDuty API, endpoints Webhook genéricos)
- ORM & Persistencia: Prisma ORM o Drizzle ORM

**Storage**: PostgreSQL 16+ con soporte JSONB para metadatos dinámicos y configuraciones de canales.

**Testing**:
- Unitarias y de Integración: Vitest con entorno Node.js
- Pruebas E2E: Playwright para validación de interfaces y flujos de usuario completos

**Target Platform**: Servidor Linux / Docker container auto-hospedado (compatible con Coolify, Docker Compose o VPS dedicado). Extiende el despliegue del spec 001.

**Project Type**: Aplicación web Full-Stack empresarial con APIs REST y configuración de integraciones externas.

**Performance Goals**:
- Configurar canal de notificación y pasar prueba de conexión en menos de 5 minutos (SC-001).
- Entregar notificación crítica en menos de 2 minutos desde el evento (SC-002).
- Durante tormenta de 100 eventos idénticos, emitir como máximo 1 notificación agrupada (SC-003).
- Entrega confirmada en el 99% de los casos críticos con reintentos y backoff (SC-004).

**Constraints**:
- Cero exposición de secretos en respuestas de API, logs o interfaces (Principio III).
- Control de acceso obligatorio en backend para cada ruta de mutación (Principio IV).
- Registros de auditoría append-only sin credenciales (Principio VI).
- Deduplicación anti-flapping; control de frecuencia; estados explícitos (Principio VIII).
- Timeouts estrictos, reintentos con backoff exponencial, estados de entregabilidad (Principio XI).
- Encriptación de credenciales; sin exposición masiva de datos sensibles en exports (Principio XIII).

**Scale/Scope**: Sistema dimensionado para hasta 500 incidentes concurrentes y decenas de operadores simultáneos, con configuración de hasta 20 canales de notificación diferentes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio Constitucional | Estado | Evidencia de Cumplimiento en el Diseño |
|---|---|---|
| **I. SDD como Fuente de Verdad** | ✅ PASS | Todo el diseño técnico deriva directamente de los requerimientos (`FR-001` a `FR-008`) de `spec.md`. |
| **II. Seguridad desde el Diseño** | ✅ PASS | Validación de entrada estricta mediante Zod en Route Handlers; sesiones autenticadas; canales HTTPS/TLS obligatorios. |
| **III. Gestión Segura de Credenciales** | ✅ PASS | Encriptación AES-256-GCM de credenciales en reposo; 0% de secretos devueltos en GET/PATCH; DTO Sanitizer para roles observadores. |
| **IV. Mínimo Privilegio y RBAC** | ✅ PASS | Validación en dos capas (Middleware + Service Guard); rol OBSERVADOR restringido a solo lectura (mutaciones devuelven `403 Forbidden`). |
| **V. Seguridad Operativa de Servidores** | ✅ PASS | El análisis de logs es de solo lectura; no ejecuta comandos de modificación en servidores remotos. |
| **VI. Evidencia y Trazabilidad** | ✅ PASS | Tabla `notification_audit_logs` append-only que registra cada acción de notificación con usuario y marca temporal; credenciales redactadas. |
| **VII. Análisis de Logs Responsable** | ✅ PASS | Entradas procedentes de banners y respuestas remotas tratadas como datos no confiables sanitizados. |
| **VIII. Alertas y Ciclo de Incidente** | ✅ PASS | Deduplicación anti-flapping; control de frecuencia; estados explícitos. |
| **XI. Resiliencia y Recuperación** | ✅ PASS | Timeouts estrictos, reintentos con backoff exponencial, estados de entregabilidad. |
| **XII. Experiencia de Usuario y Accesibilidad** | ✅ PASS | Configuración de canales con representación redundante (texto + iconos); idioma oficial español. |
| **XIII. Privacidad y Exposición Mínima** | ✅ PASS | Encriptación de credenciales; sin exposición masiva de datos sensibles en exports. |

---

## Project Structure

### Documentation (this feature)

```text
specs/004-notificaciones/
├── spec.md                  # Especificación funcional aprobada
├── plan.md                  # Este plan de implementación técnico
├── research.md              # Decisiones técnicas y arquitectónicas (Fase 0)
├── data-model.md            # Esquema de base de datos y modelo de entidades (Fase 1)
├── contracts/
│   └── notification-management-api.yaml # Contrato OpenAPI 3.1 para la API REST (Fase 1)
├── quickstart.md            # Guía de verificación de extremo a extremo (Fase 1)
└── tasks.md                 # Tareas dependency-ordered (generadas por /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/                                 # Next.js App Router (Páginas y API Route Handlers)
│   ├── (dashboard)/
│   │   └── notifications/              # Vistas de configuración y envío de notificaciones
│   │       ├── page.tsx               # Lista y configuración de canales
│   │       ├── new/page.tsx           # Formulario de nuevo canal (SUPERADMIN)
│   │       └── test/page.tsx          # Endpoint de prueba de canal
│   └── api/
│       └── v1/
│           └── notifications/
│               ├── route.ts           # GET (listar canales) / POST (enviar notificación manual)
│               ├── channels/
│               │   ├── route.ts       # GET (listar) / POST (crear/actualizar canal)
│               │   ├── [id]/route.ts  # GET (detalle canal) / PATCH (actualizar)
│               │   └── test/[id]/route.ts  # POST (probar canal)
│               └── alerts/
│                   ├── route.ts       # GET (listar alertas) / POST (crear alerta)
│                   └── [id]/route.ts  # PATCH (acknowledge/resolve alerta)
├── core/                                # Capa de Dominio y Lógica de Negocio
│   ├── domain/
│   │   └── notification.types.ts      # Tipos y estados de notificaciones
│   └── services/
│       ├── notification.service.ts    # Casos de uso de notificaciones multi-canal
│       ├── notification-rules.service.ts  # Enrutamiento inteligente y reglas
│       └── audit.service.ts         # Registro append-only de auditoría
├── infrastructure/                      # Capa de Infraestructura y Adaptadores
│   ├── crypto/
│   │   └── notification-vault.ts      # Cifrado/Descifrado AES-256-GCM de credenciales
│   ├── monitoring/
│   │   └── notification-rules.json    # Reglas de enrutamiento y deduplicación
│   ├── db/
│   │   ├── prisma.ts                  # Cliente de base de datos
│   │   └── schema.prisma              # Esquema de modelos de base de datos
│   └── security/
│       └── rbac-guard.ts            # Guard de autorización backend (SUPERADMIN/OBSERVADOR)
└── shared/                              # Validaciones compartidas
    ├── validations/
    │   └── notification.schema.ts     # Esquemas de validación Zod para canales
    └── errors/
        └── domain-errors.ts         # Jerarquía de errores estandarizados

test/
├── unit/
│   ├── notification/notification.service.test.ts  # Pruebas de servicio de notificaciones
│   └── notification/notification-rules.test.ts  # Pruebas de reglas y enrutamiento
├── integration/
│   ├── api/notifications-routes.test.ts       # Pruebas de endpoints REST con roles
│   └── security/rbac-notifications.test.ts    # Pruebas de autorización para OBSERVADOR
└── e2e/
    └── notification-management.spec.ts         # Pruebas de flujo completo con Playwright

**Structure Decision**: Se adopta una arquitectura modular unificada basada en **Next.js App Router** con separación clara de capas (`core` para reglas de negocio y entidades puras, `infrastructure` para acceso a datos, criptografía y conectores de notificación, y `components`/`app` para presentación y API REST).
```

## Complexity Tracking

> **Sin violaciones a la Constitución**. Todas las decisiones técnicas respetan los 15 principios normativos sin requerir excepciones.

## Dependencies & Execution Order

### Phase Dependencies

```
[spec 001: server-inventory] ──► [spec 002: log-analysis] ──► [Phase 0: Research] ──► [Phase 1: Design] ──► [Phase 2: Implementation] ──► [Phase 3: Tests] ──► [Phase 4: Polish]
```

- **spec 001 (server-inventory)**: Dependencia crítica. El módulo de notificaciones depende del inventario de servidores para asociar incidentes y aplicar RBAC.
- **spec 002 (log-analysis)**: Dependencia crítica. El módulo de notificaciones depende del análisis de logs para la clasificación y contexto de eventos.
- **Phase 0 (Research)**: Resuelve decisiones técnicas (DEC-001 a DEC-006). No bloquea el desarrollo de UI.
- **Phase 1 (Design)**: Define esquema de DB, contratos API y guía de verificación. Bloquea la implementación de servicios.
- **Phase 2 (Implementation)**: Implementa servicios, API routes y componentes UI.
- **Phase 3 (Tests)**: Pruebas unitarias, integración y seguridad.
- **Phase 4 (Polish)**: Pruebas E2E y documentación operativa.

### Parallel Opportunities

- **Research**: DEC-001 (integración proveedores), DEC-002 (motor de deduplicación), DEC-003 (formato de reintentos) pueden desarrollarse en paralelo.
- **Design**: data-model.md y contracts/ pueden escribirse en paralelo tras research.md.
- **Implementation**: Servicios de canal, reglas y auditoría pueden implementarse en paralelo tras el esquema de DB.

## Implementation Strategy

### Incremental Delivery

1. **Incremento 1 (MVP)**: Configuración de canales básicos (email, Slack) y envío manual de notificaciones (US1 + US2).
2. **Incremento 2**: Deduplicación y agrupación de alertas (US3).
3. **Incremento 3**: Reintentos con backoff exponencial y seguimiento de entregabilidad (US4).
4. **Incremento 4**: Enrutamiento inteligente por horario y tipo de evento (US5).
5. **Incremento 5**: Batería E2E y documentación operativa (Polish).

---

## Phase-by-Phase Plan

### Phase 0: Research (DEC-001 to DEC-006)

- **DEC-001**: Definir protocolos de integración para cada canal (SMTP config, Slack webhook format, PagerDuty API endpoints, Webhook generic format)
- **DEC-002**: Diseñar motor de deduplicación (ventanas temporales, fingerprint de eventos, hash de contenido)
- **DEC-003**: Definir formato de backoff exponencial (intervalos, máximo de reintentos, condiciones de cese)
- **DEC-004**: Diseñar esquema de enrutamiento (reglas por horario, tipo de evento, severidad; formato de condición y acción)
- **DEC-005**: Definir estructura de auditoría sin exposar credenciales (campos a redactar, formato de log)
- **DEC-006**: Definir DTOs y formatos de respuesta para roles OBSERVADOR vs SUPERADMIN

### Phase 1: Design (Data Model, Contracts, Quickstart)

- **data-model.md**: Esquema Prisma con modelos `NotificationChannel`, `NotificationRule`, `NotificationAuditLog`
- **contracts/notification-management-api.yaml**: OpenAPI 3.1 con todos los endpoints
- **quickstart.md**: Guía de verificación paso a paso con flujos E2E esperados

### Phase 2: Implementation

- **Incremento 1**: Implementar servicio `NotificationService` con envío a canales; API routes para crear/testear canales; validación Zod; cifrado AES-256-GCM de credenciales.
- **Incremento 2**: Implementar servicio `AlertEngine` con deduplicación temporal; API routes para listar/mark-read alertas; componentes UI de estado de alerta.
- **Incremento 3**: Implementar sistema de reintentos programados (usando cron o cola ligera); API routes para consulta de entregabilidad; registro de cada intento en auditoría.
- **Incremento 4**: Implementar motor de reglas de enrutamiento; API routes para gestionar reglas de horario/tipo/severidad; componentes UI de gestión de reglas.

### Phase 3: Tests

- Unitarias y de integración para cada servicio y regla
- Pruebas de seguridad RBAC para OBSERVADOR vs SUPERADMIN
- Pruebas E2E con Playwright flujos completos

### Phase 4: Polish

- Documentación operativa
- Optimizaciones de rendimiento
- Refinamiento de UI/UX

---