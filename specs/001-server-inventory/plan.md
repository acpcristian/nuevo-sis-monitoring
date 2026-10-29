# Implementation Plan: Gestión e Inventario de Servidores

**Branch**: `001-server-inventory` | **Date**: 2026-10-28 | **Spec**: [specs/001-server-inventory/spec.md](spec.md)

**Input**: Feature specification from `/specs/001-server-inventory/spec.md`

---

## Summary

Implementar el módulo fundacional de gestión e inventario de servidores para la plataforma web de monitoreo empresarial. Proporciona registro, consulta, filtrado en tiempo real, gestión del ciclo de vida (`ACTIVE`, `MAINTENANCE`, `DISABLED`, `RETIRED`), verificación no intrusiva de conectividad (handshake SSH para Linux y socket/WinRM para Windows), almacenamiento cifrado en reposo de credenciales con AES-256-GCM y control estricto de acceso basado en roles (**SUPERADMIN** vs. **OBSERVADOR**), garantizando cero exposición de secretos y trazabilidad completa mediante registros de auditoría inmutables.

---

## Technical Context

**Language/Version**: TypeScript 5.6+ / Node.js 24+ (`strict: true`, `noUncheckedIndexedAccess: true`).

**Primary Dependencies**:
- Web & API: Next.js 15+ (App Router, Server Components y Route Handlers)
- Validación de esquemas: Zod 3.23+
- Criptografía de secretos: Módulo nativo `node:crypto` (AES-256-GCM)
- Red y Sondeo remoto: `ssh2` (cliente SSH no intrusivo para Linux), `node:net` / `undici` (comprobaciones de puerto y HTTPS WinRM para Windows)
- ORM & Persistencia: Prisma ORM o Drizzle ORM

**Storage**: PostgreSQL 16+ con soporte JSONB para etiquetas y metadatos dinámicos.

**Testing**:
- Unitarias y de Integración: Vitest con entorno Node.js
- Pruebas E2E: Playwright para validación de interfaces y flujos de usuario completos

**Target Platform**: Servidor Linux / Docker container auto-hospedado (compatible con Coolify, Docker Compose o VPS dedicado).

**Project Type**: Aplicación web Full-Stack empresarial con APIs REST internas.

**Performance Goals**:
- Carga y filtrado de catálogo de 1,000 servidores en menos de 1 segundo (SC-002).
- Alta de servidor con verificación inicial de conectividad en menos de 90 segundos (SC-001).
- Timeout estricto de 5 segundos en sondeos remotos individuales para evitar bloqueos.

**Constraints**:
- Cero exposición de secretos en respuestas de API, logs o interfaces (Principio III).
- Sondeos exclusivamente de solo lectura, sin ejecución de comandos modificadores (Principio V).
- Control de acceso obligatorio en backend para cada ruta de mutación (Principio IV).
- Registros de auditoría append-only sin credenciales (Principio VI).

**Scale/Scope**: Catálogo inicial dimensionado para supervisar hasta 1,000 servidores concurrentes y decenas de operadores simultáneos.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio Constitucional | Estado | Evidencia de Cumplimiento en el Diseño |
|---|---|---|
| **I. SDD como Fuente de Verdad** | ✅ PASS | Todo el diseño técnico deriva directamente de los requerimientos (`FR-001` a `FR-015`) de `spec.md`. |
| **II. Seguridad desde el Diseño** | ✅ PASS | Validación de entrada estricta mediante Zod en Route Handlers; sesiones autenticadas; canales HTTPS/TLS obligatorios. |
| **III. Gestión Segura de Credenciales** | ✅ PASS | Claves SSH y contraseñas cifradas en reposo con AES-256-GCM; IV único por registro; 0% de secretos devueltos en GET/PATCH; DTO Sanitizer para roles observadores. |
| **IV. Mínimo Privilegio y RBAC** | ✅ PASS | Validación en dos capas (Middleware + Service Guard); rol OBSERVADOR restringido a solo lectura (mutaciones devuelven `403 Forbidden`). |
| **V. Seguridad Operativa de Servidores** | ✅ PASS | Sondeos remotos no intrusivos basados en handshake y banner en modo solo lectura con timeout de 5s; prohibición de comandos de escritura o reinicios. |
| **VI. Evidencia y Trazabilidad** | ✅ PASS | Tabla `inventory_audit_logs` append-only que registra cada alta, cambio de estado y baja con usuario y marca temporal; raw logs inmutables. |
| **VII. Análisis de Logs Responsable** | ✅ PASS | Entradas procedentes de banners y respuestas remotas tratadas como datos no confiables sanitizados. |
| **VIII. Alertas y Ciclo de Incidente** | ✅ PASS | El paso a `MAINTENANCE` o `DISABLED` silencia automáticamente alertas para mitigar fatiga; estados explícitos (`UNREACHABLE`, `AUTH_FAILED`). |
| **IX. Calidad y Pruebas Obligatorias** | ✅ PASS | Estrategia de pruebas que cubre caminos felices, caídas de red, credenciales inválidas y rechazos de autorización. |
| **X. Arquitectura Modular** | ✅ PASS | Capas desacopladas (Presentación, Dominio, Criptografía, Repositorio, Conectores SSH/WinRM). Decisiones técnicas fundamentadas en `research.md`. |
| **XI. Resiliencia y Recuperación** | ✅ PASS | Timeouts estrictos (5s) y estados de salud diferenciados (`PENDING`, `ONLINE`, `DEGRADED`, `UNREACHABLE`). |
| **XII. Experiencia de Usuario y Accesibilidad** | ✅ PASS | Estados con representación redundante (texto + iconos accesibles); navegación en ≤ 3 clics; idioma oficial español con marcas temporales explícitas. |
| **XIII. Privacidad y Exposición Mínima** | ✅ PASS | La tabla de auditoría no almacena credenciales; las credenciales se purgan físicamente al retirar el servidor. |
| **XIV. Operación Reproducible** | ✅ PASS | Variables de configuración 12-Factor en `.env`; migraciones reproducibles en PostgreSQL; guía detallada en `quickstart.md`. |
| **XV. Dependencias y Licencias** | ✅ PASS | Dependencias estándares auditadas (`ssh2`, `zod`, `crypto` nativo); sin componentes externos de telemetría invasiva. |

---

## Project Structure

### Documentation (this feature)

```text
specs/001-server-inventory/
├── spec.md                  # Especificación funcional aprobada
├── checklists/
│   └── requirements.md      # Lista de validación de calidad de requisitos
├── plan.md                  # Este plan de implementación técnico
├── research.md              # Decisiones técnicas y arquitectónicas (Fase 0)
├── data-model.md            # Esquema de base de datos y modelo de entidades (Fase 1)
├── contracts/
│   └── server-inventory-api.yaml # Contrato OpenAPI 3.1 para la API REST (Fase 1)
├── quickstart.md            # Guía de verificación de extremo a extremo (Fase 1)
└── tasks.md                 # Tareas dependency-ordered (generadas por /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/                                 # Next.js App Router (Páginas y API Route Handlers)
│   ├── (dashboard)/
│   │   └── servers/                     # Vistas del inventario de servidores
│   │       ├── page.tsx                 # Lista y filtrado de servidores
│   │       ├── [id]/page.tsx            # Ficha de detalle de servidor
│   │       └── new/page.tsx             # Formulario de alta (SUPERADMIN)
│   └── api/
│       └── v1/
│           └── servers/
│               ├── route.ts             # GET (listar) / POST (crear)
│               └── [id]/
│                   ├── route.ts         # GET (detalle) / PATCH (editar) / DELETE (retirar)
│                   ├── test-connection/ # POST (prueba de conectividad)
│                   └── lifecycle/       # PATCH (cambio de estado de ciclo de vida)
├── components/                          # Componentes de UI reutilizables
│   ├── servers/
│   │   ├── ServerTable.tsx              # Tabla con ordenamiento y filtros
│   │   ├── ServerStatusBadge.tsx        # Insignia accesible (icono + texto)
│   │   ├── ServerForm.tsx               # Formulario de alta/edición
│   │   └── TestConnectionModal.tsx      # Modal de diagnóstico en tiempo real
│   └── ui/                              # Primitivas accesibles de interfaz
├── core/                                # Capa de Dominio y Lógica de Negocio
│   ├── domain/
│   │   ├── server.entity.ts             # Entidades de dominio
│   │   └── server.types.ts              # Tipos y estados de ciclo de vida
│   └── services/
│       ├── server.service.ts            # Casos de uso de gestión de servidores
│       ├── connectivity.service.ts      # Coordinador de sondeos
│       └── audit.service.ts             # Registro append-only de auditoría
├── infrastructure/                      # Capa de Infraestructura y Adaptadores
│   ├── crypto/
│   │   └── secret-vault.ts              # Cifrado/Descifrado AES-256-GCM
│   ├── network/
│   │   ├── ssh-probe.ts                 # Adaptador de sondeo SSH (ssh2)
│   │   └── winrm-probe.ts               # Adaptador de sondeo WinRM / socket
│   ├── db/
│   │   ├── prisma.ts                    # Cliente de base de datos
│   │   └── schema.prisma                # Esquema de modelos de base de datos
│   └── security/
│       └── rbac-guard.ts                # Guard de autorización backend (SUPERADMIN/OBSERVADOR)
└── shared/                              # Validaciones compartidas
    ├── validations/
    │   └── server.schema.ts             # Esquemas de validación Zod
    └── errors/
        └── domain-errors.ts             # Jerarquía de errores estandarizados

tests/
├── unit/
│   ├── crypto/secret-vault.test.ts      # Pruebas de cifrado/descifrado y manipulación
│   └── domain/server-status.test.ts     # Pruebas de transiciones de estado
├── integration/
│   ├── api/servers-routes.test.ts       # Pruebas de endpoints REST con roles
│   └── network/ssh-probe.test.ts        # Pruebas con servidor SSH mock
└── e2e/
    └── server-inventory.spec.ts         # Pruebas de flujo completo con Playwright
```

**Structure Decision**: Se adopta una arquitectura modular unificada basada en **Next.js App Router** con separación clara de capas (`core` para reglas de negocio y entidades puras, `infrastructure` para acceso a datos, criptografía y sondeos de red, y `components`/`app` para presentación y API REST).

---

## Complexity Tracking

> **Sin violaciones a la Constitución**. Todas las decisiones técnicas respetan los 15 principios normativos sin requerir excepciones.
