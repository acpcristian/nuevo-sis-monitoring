# Implementation Plan: Automatización y Playbooks

**Branch**: `006-automatizacion` | **Date**: 2026-10-30 | **Spec**: [spec.md](spec.md)

## Summary

Implementar un motor de automatización y playbooks para la remediación automática de incidentes detectados. Proporciona flujos configurables de acciones condicionales, condiciones de activación, ejecución automática bajo demanda, validación previa y rollback, y un historial completo de ejecuciones con auditoría para mejora continua. Garantiza operaciones aisladas con permisos mínimos, seguridad en el manejo de credenciales y control estricto basado en roles (SUPERADMIN vs. OBSERVADOR).

## Technical Context

**Language/Version**: TypeScript 5.6+ / Node.js 24+ (`strict: true`, `noUncheckedIndexedAccess: true`).

**Primary Dependencies**:
- Web & API: Next.js 15+ (App Router, Server Components y Route Handlers)
- Validación de esquemas: Zod 3.23+
- Orquestación: Workflow engine o cola de tareas (Bull, RabbitMQ, o implementación ligera con cron)
- Integración con servidores: Agentes SSH seguros, APIs REST controladas, protocolos propietarios seguros
- Criptografía: Módulo nativo `node:crypto` (AES-256-GCM) para credenciales de servidor

**Storage**: PostgreSQL 16+ con soporte JSONB para definiciones de playbooks, historiales de ejecución y metadatos de acciones.

**Testing**:
- Unitarias y de Integración: Vitest con entorno Node.js
- Pruebas E2E: Playwright para validación de interfaces y flujos de usuario completos

**Target Platform**: Servidor Linux / Docker container auto-hospedado (compatible con Coolify, Docker Compose o VPS dedicado). Extiende el despliegue del spec 001.

**Project Type**: Motor de automatización Full-Stack con interfaz de creación visual y API REST para ejecución.

**Performance Goals**:
- Un SUPERADMIN puede crear un playbook básico en menos de 5 minutos (SC-001).
- Un playbook se ejecuta automáticamente dentro de los 2 minutos posteriores al evento trigger (SC-002).
- El 80% de los playbooks completan todas sus acciones exitosamente en el primer intento (SC-003).
- 100% de las ejecuciones de playbooks quedan registradas en el auditoría sin pérdida de datos (SC-004).

**Constraints**:
- Credenciales de acceso a servidores cifradas AES-256-GCM; 0% de secretos en interfaces (Principio III).
- Playbooks ejecutan acciones aisladas con permisos mínimos; sin comandos de modificación directa sin autorización (Principio V).
- Validación previa, rollback, y aislamiento de ejecuciones para prevenir daños colaterales (Principio XI).
- Playbooks activados por eventos de incidentes; estados explícitos de ejecución (Principio VIII).
- Estrategia de pruebas que cubre creación, ejecución, validación, rollback y auditoría (Principio IX).
- Datos de ejecución de playbooks sin exposición de credenciales ni información sensible del sistema (Principio XIII).

**Scale/Scope**: Motor dimensionado para hasta 500 playbooks activos concurrentes y miles de ejecuciones mensuales, con hasta 50 tipos de acciones diferentes.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio Constitucional | Estado | Evidencia de Cumplimiento en el Diseño |
|---|---|---|
| **I. SDD como Fuente de Verdad** | ✅ PASS | Todo el diseño técnico deriva directamente de los requerimientos (`FR-001` a `FR-007`) de `spec.md`. |
| **II. Seguridad desde el Diseño** | ✅ PASS | Validación de entrada estricta mediante Zod en Route Handlers; sesiones autenticadas; canales seguros. |
| **III. Gestión Segura de Credenciales** | ✅ PASS | Encriptación AES-256-GCM de credenciales de acceso a servidores; 0% de secretos devueltos en GET/PATCH. |
| **IV. Mínimo Privilegio y RBAC** | ✅ PASS | Validación en dos capas (Middleware + Service Guard); rol OBSERVADOR sin permisos de ejecución. |
| **V. Seguridad Operativa de Servidores** | ✅ PASS | Playbooks ejecutan acciones aisladas con permisos mínimos; sin comandos de modificación directa sin autorización. |
| **VII. Análisis de Logs Responsable** | ✅ PASS | Registros de ejecución de playbooks tratados como datos no confiables, sanitizados antes del almacenamiento. |
| **VIII. Alertas y Ciclo de Incidente** | ✅ PASS | Playbooks activados por eventos de incidentes; estados explícitos de ejecución. |
| **IX. Calidad y Pruebas Obligatorias** | ✅ PASS | Estrategia de pruebas que cubre creación, ejecución, validación, rollback y auditoría. |
| **XI. Resiliencia y Recuperación** | ✅ PASS | Validación previa, rollback, y aislamiento de ejecuciones para prevenir daños colaterales. |
| **XII. Experiencia de Usuario y Accesibilidad** | ✅ PASS | Interfaz de creación de playbooks intuitiva; flujo de aprobación para acciones de riesgo. |
| **XIII. Privacidad y Exposición Mínima** | ✅ PASS | Datos de ejecución de playbooks sin exposición de credenciales ni información sensible del sistema. |

---

## Project Structure

### Documentation (this feature)

```text
specs/006-automatizacion/
├── spec.md                  # Especificación funcional aprobada
├── plan.md                  # Este plan de implementación técnico
├── research.md              # Decisiones técnicas y arquitectónicas (Fase 0)
├── data-model.md            # Esquema de base de datos y modelo de entidades (Fase 1)
├── contracts/
│   └── automation-management-api.yaml # Contrato OpenAPI 3.1 para la API REST (Fase 1)
├── quickstart.md            # Guía de verificación de extremo a extremo (Fase 1)
└── tasks.md                 # Tareas dependency-ordered (generadas por /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/                                 # Next.js App Router (Páginas y API Route Handlers)
│   ├── (dashboard)/
│   │   └── automation/                # Vistas de gestión de playbooks y ejecución
│   │       ├── page.tsx              # Lista y dashboard de playbooks activos
│   │       ├── new/page.tsx          # Creador visual de playbooks (SUPERADMIN)
│   │       ├── execute/[id]/page.tsx # Ejecución manual de playbook
│   │       └── history/page.tsx      # Historial de ejecuciones pasadas
│   └── api/
│       └── v1/
│           └── automation/
│               ├── route.ts           # GET (listar playbooks) / POST (crear playbook)
│               ├── [id]/route.ts      # GET (detalle playbook) / DELETE (borrar)
│               ├── execute/route.ts   # POST (ejecutar playbook manualmente)
│               └── executions/
│                   └── [id]/route.ts  # GET (detalle ejecución) / PATCH (estado)
├── core/                                # Capa de Dominio y Lógica de Negocio
│   ├── domain/
│   │   └── automation.types.ts       # Tipos y estados de playbooks/automatización
│   └── services/
│       ├── automation.service.ts     # Motor principal de ejecución de playbooks
│       ├── playbook.service.ts       # Gestión de playbooks (CRUD, validación)
│       ├── action.service.ts         # Ejecutador de acciones individual
│       └── audit.service.ts         # Registro append-only de auditoría
├── infrastructure/                      # Capa de Infraestructura y Adaptadores
│   ├── crypto/
│   │   └── automation-vault.ts      # Cifrado/Descifrado AES-256-GCM de credenciales
│   ├── monitoring/
│   │   └── action-rules.json        # Reglas de ejecución y condiciones
│   ├── db/
│   │   ├── prisma.ts                # Cliente de base de datos
│   │   └── schema.prisma            # Esquema de modelos de base de datos
│   └── security/
│       └── rbac-guard.ts           # Guard de autorización backend (SUPERADMIN/OBSERVADOR)
└── shared/                              # Validaciones compartidas
    ├── validations/
    │   └── automation.schema.ts     # Esquemas de validación Zod para playbooks
    └── errors/
        └── domain-errors.ts        # Jerarquía de errores estandarizados

test/
├── unit/
│   ├── automation/automation.service.test.ts  # Pruebas de servicio de automatización
│   └── automation/playbook.service.test.ts  # Pruebas de servicio de playbooks
├── integration/
│   ├── api/automation-routes.test.ts       # Pruebas de endpoints REST con roles
│   └── security/rbac-automation.test.ts    # Pruebas de autorización para OBSERVADOR
└── e2e/
    └── automation-management.spec.ts         # Pruebas de flujo completo con Playwright

**Structure Decision**: Se adopta una arquitectura modular unificada basada en **Next.js App Router** con separación clara de capas (`core` para reglas de negocio y entidades puras, `infrastructure` para acceso a datos, criptografía y conectores de automatización, y `components`/`app` para presentación y API REST).
```

## Complexity Tracking

> **Sin violaciones a la Constitución**. Todas las decisiones técnicas respetan los 15 principios normativos sin requerir excepciones.

## Dependencies & Execution Order

### Phase Dependencies

```
[spec 001: server-inventory] ──► [spec 002: log-analysis] ──► [Phase 0: Research] ──► [Phase 1: Design] ──► [Phase 2: Implementation] ──► [Phase 3: Tests] ──► [Phase 4: Polish]
```

- **spec 001 (server-inventory)**: Dependencia crítica. El módulo de automatización depende del inventario de servidores para información de servicios, credenciales cifradas y detalles de conexión para acciones de automatización.
- **spec 002 (log-analysis)**: Dependencia crítica. El módulo de automatización depende del análisis de logs para la clasificación y contexto de eventos trigger.
- **Phase 0 (Research)**: Resuelve decisiones técnicas (DEC-001 a DEC-006). No bloquea el desarrollo de UI.
- **Phase 1 (Design)**: Define esquema de DB, contratos API y guía de verificación. Bloquea la implementación de servicios.
- **Phase 2 (Implementation)**: Implementa servicios, API routes y componentes UI.
- **Phase 3 (Tests)**: Pruebas unitarias, integración y seguridad.
- **Phase 4 (Polish)**: Pruebas E2E y documentación operativa.

### Parallel Opportunities

- **Research**: DEC-001 (adaptadores de ejecución), DEC-002 (formato de playbooks/YAML), DEC-003 (motor de condiciones lógicas) pueden desarrollarse en paralelo.
- **Design**: data-model.md y contracts/ pueden escribirse en paralelo tras research.md.
- **Implementation**: Servicios de ejecución, gestión de playbooks y acción individual pueden implementarse en paralelo tras el esquema de DB.

## Implementation Strategy

### Incremental Delivery

1. **Incremento 1 (MVP)**: Creación básica de playbooks y ejecución manual (US1 + US2).
2. **Incremento 2**: Ejecución automática trigger por eventos de incidentes (US2 extendido).
3. **Incremento 3**: Acciones condicionales SI/NO y validación previa (US3).
4. **Incremento 4**: Validación y rollback para acciones de riesgo (US4).
5. **Incremento 5**: Historial y auditoría de ejecuciones (US5).
6. **Incremento 6**: Batería E2E y documentación operativa (Polish).

---

## Phase-by-Phase Plan

### Phase 0: Research (DEC-001 to DEC-006)

- **DEC-001**: Definir formato de playbooks (YAML/JSON estructurado con condiciones expresables)
- **DEC-002**: Diseñar motor de ejecución (workflow engine ligero o cola de tareas con cron)
- **DEC-003**: Diseñar tipos de acción soportados (reiniciar servicio, aplicar configuración, ejecutar comando, notificar equipo, validar estado, esperar tiempo)
- **DEC-004**: Diseñar sistema de validación previa y rollback (cuándo solicitar confirmación, qué acciones tienen rollback)
- **DEC-005**: Diseñar esquema de auditoría sin exponer credenciales (campos a incluir, formato de log)
- **DEC-006**: Definir DTOs y formatos de respuesta para roles OBSERVADOR vs SUPERADMIN

### Phase 1: Design (Data Model, Contracts, Quickstart)

- **data-model.md**: Esquema Prisma con modelos `Playbook`, `PlaybookStep`, `PlaybookExecution`, `ActionResult`
- **contracts/automation-management-api.yaml**: OpenAPI 3.1 con todos los endpoints
- **quickstart.md**: Guía de verificación paso a paso con flujos E2E esperados

### Phase 2: Implementation

- **Incremento 1**: Implementar servicio `PlaybookService` con CRUD; API routes para crear/listar playbooks; validador YAML/JSON; interfaz de creación básica.
- **Incremento 2**: Implementar motor de ejecución `AutomationService` con trigger por eventos de incidentes; API route para ejecutar playbooks manualmente; integración con eventos trigger.
- **Incremento 3**: Implementar servicio `ActionService` con tipos de acción soportados (reinicio, configuración, comando, notificación); validación de resultados; registro de ejecución.
- **Incremento 4**: Implementar lógica de validación previa y rollback; API routes para solicitar confirmación y ejecutar rollback; componentes UI de resumen de cambios.
- **Incremento 5**: Implementar servicio de historial `ExecutionHistoryService`; API routes para listar/filtar ejecuciones; componentes UI de detalle de ejecución y logs.

### Phase 3: Tests

- Unitarias y de integración para cada servicio y tipo de acción
- Pruebas de seguridad RBAC para OBSERVADOR vs SUPERADMIN
- Pruebas E2E con Playwright flujos completos

### Phase 4: Polish

- Documentación operativa
- Optimizaciones de rendimiento
- Refinamiento de UI/XD

---