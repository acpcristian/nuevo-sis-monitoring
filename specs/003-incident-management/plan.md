# Implementation Plan: Gestión de Incidentes

**Branch**: `003-incident-management` | **Date**: 2026-10-30 | **Spec**: [spec.md](spec.md)

## Summary

Implementar el módulo de gestión de incidentes para la plataforma de monitoreo empresarial. Proporciona creación, asignación, escalado, resolución y cierre de incidentes con ciclo de vida completo (`OPEN` → `ASSIGNED` → `IN_PROGRESS` → `RESOLVED` → `CLOSED`), control de tiempo SLA por categoría, asignación Round-Robin o por carga de trabajo, asignación automática por categoría, auditoría append-only para cada transición, y control estricto de acceso basado en roles (SUPERADMIN vs. OBSERVADOR), garantizando cero exposición de secretos y trazabilidad completa mediante registros de auditoría inmutables.

---

## Technical Context

**Language/Version**: TypeScript 5.6+ / Node.js 24+ (`strict: true`, `noUncheckedIndexedAccess: true`).

**Primary Dependencies**:
- Web & API: Next.js 15+ (App Router, Server Components y Route Handlers)
- Validación de esquemas: Zod 3.23+
- Criptografía de incidentes: Módulo nativo `node:crypto` (AES-256-GCM)
- Red y Monitoreo: Integración con herramientas de monitoreo (Prometheus, Datadog, o agente local), y datos del spec 002 (logs)
- ORM & Persistencia: Prisma ORM o Drizzle ORM

**Storage**: PostgreSQL 16+ con soporte JSONB para metadatos dinámicos y políticas SLA.

**Testing**:
- Unitarias y de Integración: Vitest con entorno Node.js
- Pruebas E2E: Playwright para validación de interfaces y flujos de usuario completos

**Target Platform**: Servidor Linux / Docker container auto-hospedado (compatible con Coolify, Docker Compose o VPS dedicado). Extiende el despliegue del spec 001.

**Project Type**: Aplicación web Full-Stack empresarial con APIs REST internas.

**Performance Goals**:
- Creación de incidente con verificación en menos de 2 minutos (SC-001).
- Asignación automática de incidente crítico en menos de 15 minutos (SC-002).
- Tiempo de cumplimiento SLA en el 80% de los incidentes críticos (SC-003).
- Tiempo estricto de 10 segundos en operaciones de transición de estado para evitar bloqueos.

**Constraints**:
- Cero exposición de secretos en respuestas de API, logs o interfaces (Principio III).
- Control de acceso obligatorio en backend para cada ruta de mutación (Principio IV).
- Registros de auditoría append-only sin credenciales (Principio VI).
- Estados de salud explícitos (`OPEN`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`) sin asumir normalidad ante datos ausentes (Principio VIII).
- "Hecho" = typecheck + lint + build + pruebas de resiliencia y seguridad (Principio IX y DoD Reforzada).

**Scale/Scope**: Gestión de incidentes dimensionada para hasta 500 incidentes concurrentes y decenas de operadores simultáneos.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio Constitucional | Estado | Evidencia de Cumplimiento en el Diseño |
|---|---|---|
| **I. SDD como Fuente de Verdad** | ✅ PASS | Todo el diseño técnico deriva directamente de los requerimientos (`FR-001` a `FR-010`) de `spec.md`. |
| **II. Seguridad desde el Diseño** | ✅ PASS | Validación de entrada estricta mediante Zod en Route Handlers; sesiones autenticadas; canales HTTPS/TLS obligatorios. |
| **III. Gestión Segura de Credenciales** | ✅ PASS | Claves de encriptación rotadas en reposo con AES-256-GCM; IV único por incidente; 0% de secretos devueltos en GET/PATCH; DTO Sanitizer para roles observadores. |
| **IV. Mínimo Privilegio y RBAC** | ✅ PASS | Validación en dos capas (Middleware + Service Guard); rol OBSERVADOR restringido a solo lectura (mutaciones devuelven `403 Forbidden`). |
| **V. Seguridad Operativa de Servidores** | ✅ PASS | El análisis de logs es de solo lectura; no ejecuta comandos de modificación en servidores remotos. |
| **VI. Evidencia y Trazabilidad** | ✅ PASS | Tabla `incident_audit_logs` append-only que registra cada alta, transición, asignación y baja con usuario y marca temporal; raw logs inmutables. |
| **VII. Análisis de Logs Responsable** | ✅ PASS | Entradas procedentes de banners y respuestas remotas tratadas como datos no confiables sanitizados. |
| **VIII. Alertas y Ciclo de Incidente** | ✅ PASS | Estados explícitos (`OPEN`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`); control SLA y anti-flapping. |
| **IX. Calidad y Pruebas Obligatorias** | ✅ PASS | Estrategia de pruebas que cubre caminos felices, caídas de tiempo, credenciales inválidas y rechazos de autorización. |
| **X. Arquitectura Modular** | ✅ PASS | Capas desacopladas (Presentación, Dominio, Criptografía, Repositorio, Conectores de monitoreo). Decisiones técnicas fundamentadas en `research.md`. |
| **XI. Resiliencia y Recuperación** | ✅ PASS | Timeouts estrictos (10s) y estados de salud diferenciados (`OPEN`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `CLOSED`). |
| **XII. Experiencia de Usuario y Accesibilidad** | ✅ PASS | Estados con representación redundante (texto + iconos accesibles); navegación en ≤ 3 clics; idioma oficial español con marcas temporales explícitas. |
| **XIII. Privacidad y Exposición Mínima** | ✅ PASS | La tabla de auditoría no almacena credenciales; los datos sensibles se purgan físicamente en exports; las credenciales se redactan antes del almacenamiento. |

---

## Project Structure

### Documentation (this feature)

```text
specs/003-incident-management/
├── spec.md                  # Especificación funcional aprobada
├── plan.md                  # Este plan de implementación técnico
├── research.md              # Decisiones técnicas y arquitectónicas (Fase 0)
├── data-model.md            # Esquema de base de datos y modelo de entidades (Fase 1)
├── contracts/
│   └── incident-management-api.yaml # Contrato OpenAPI 3.1 para la API REST (Fase 1)
├── quickstart.md            # Guía de verificación de extremo a extremo (Fase 1)
└── tasks.md                 # Tareas dependency-ordered (generadas por /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/                                 # Next.js App Router (Páginas y API Route Handlers)
│   ├── (dashboard)/
│   │   └── incidents/                     # Vistas del incidente de gestión
│   │       ├── page.tsx                 # Lista y filtrado de incidentes
│   │       ├── [id]/page.tsx            # Ficha de detalle del incidente
│   │       └── new/page.tsx             # Formulario de alta (SUPERADMIN)
│   └── api/
       └── v1/
           └── incidents/
               ├── route.ts             # GET (listar) / POST (crear)
               └── [id]/
                   ├── route.ts         # GET (detalle) / PATCH (transitar estado)
                   └── lifecycle/       # PATCH (transición de estado)
├── components/                          # Componentes de UI reutilizables
│   ├── incidents/
│   │   ├── IncidentTable.tsx              # Tabla con ordenamiento y filtros
│   │   ├── IncidentStatusBadge.tsx        # Insignia accesible (icono + texto)
│   │   ├── IncidentForm.tsx               # Formulario de alta/edición
│   │   └── IncidentLifecycleModal.tsx     # Modal de transición de estado
│   └── ui/                              # Primitivas accesibles de interfaz
├── core/                                # Capa de Dominio y Lógica de Negocio
│   ├── domain/
│   │   ├── incident.entity.ts             # Entidades de dominio
│   │   └── incident.types.ts              # Tipos y estados de ciclo de vida
│   └── services/
│       ├── incident.service.ts            # Casos de uso de gestión de incidentes
│       ├── incident-lifecycle.service.ts  # Machine de estados y SLA
│       └── audit.service.ts             # Registro append-only de auditoría
├── infrastructure/                      # Capa de Infraestructura y Adaptadores
│   ├── crypto/
│   │   └── incident-vault.ts              # Cifrado/Descifrado AES-256-GCM
│   ├── monitoring/
│   │   ├── prometheus-adapter.ts          # Adaptador de métricas Prometheus
│   │   └── alert-rules.json               # Reglas de alerta automática
│   ├── db/
│   │   ├── prisma.ts                    # Cliente de base de datos
│   │   └── schema.prisma                # Esquema de modelos de base de datos
│   └── security/
│       └── rbac-guard.ts                # Guard de autorización backend (SUPERADMIN/OBSERVADOR)
└── shared/                              # Validaciones compartidas
    ├── validations/
    │   └── incident.schema.ts             # Esquemas de validación Zod
    └── errors/
        └── domain-errors.ts             # Jerarquía de errores estandarizados

test/
├── unit/
│   ├── incident/incident-state.test.ts     # Pruebas de máquina de estados
│   └── incident/incident-service.test.ts   # Pruebas de servicio de incidentes
├── integration/
│   ├── api/incidents-routes.test.ts       # Pruebas de endpoints REST con roles
│   └── security/rbac-incidents.test.ts    # Pruebas de autorización para OBSERVADOR
└── e2e/
    └── incident-management.spec.ts         # Pruebas de flujo completo con Playwright

**Structure Decision**: Se adopta una arquitectura modular unificada basada en **Next.js App Router** con separación clara de capas (`core` para reglas de negocio y entidades puras, `infrastructure` para acceso a datos, criptografía y conectores de monitoreo, y `components`/`app` para presentación y API REST).
```

---

## Complexity Tracking

> **Sin violaciones a la Constitución**. Todas las decisiones técnicas respetan los 15 principios normativos sin requerir excepciones.

---

## Dependencies & Execution Order

### Phase Dependencies

```
[spec 001: server-inventory] ──► [spec 002: log-analysis] ──► [Phase 0: Research] ──► [Phase 1: Design] ──► [Phase 2: Implementation] ──► [Phase 3: Tests] ──► [Phase 4: Polish]
```

- **spec 001 (server-inventory)**: Dependencia crítica. El módulo de incidentes depende del inventario de servidores para asociación de incidentes y aplicar RBAC.
- **spec 002 (log-analysis)**: Dependencia crítica. El módulo de incidentes depende del análisis de logs para obtener eventos que desencadenan incidentes.
- **Phase 0 (Research)**: Resuelve decisiones técnicas (DEC-001 a DEC-006). No bloquea el desarrollo de UI.
- **Phase 1 (Design)**: Define esquema de DB, contratos API y guía de verificación. Bloquea la implementación de servicios.
- **Phase 2 (Implementation)**: Implementa servicios, API routes y componentes UI.
- **Phase 3 (Tests)**: Pruebas unitarias, integración y seguridad.
- **Phase 4 (Polish)**: Pruebas E2E y documentación operativa.

### Parallel Opportunities

- **Research**: DEC-001 (integración monitoreo), DEC-002 (motor de estados), DEC-003 (formato de notificaciones) pueden desarrollarse en paralelo.
- **Design**: data-model.md y contracts/ pueden escribirse en paralelo tras research.md.
- **Implementation**: Servicios de ciclo de vida, asignación y auditoría pueden implementarse en paralelo tras el esquema de DB.

---

## Implementation Strategy

### Incremental Delivery

1. **Incremento 1 (MVP)**: Creación de incidentes y vista de lista (US1 + US4).
2. **Incremento 2**: Asignación y escalado automático (US2).
3. **Incremento 3**: Resolución y cierre de incidentes (US3).
4. **Incremento 4**: Historial y reportes con cumplimiento SLA (US4 extendido).
5. **Incremento 5**: Batería E2E y documentación operativa (Polish).

---