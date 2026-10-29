# Tasks: Gestión e Inventario de Servidores

**Input**: Design documents from `/specs/001-server-inventory/`  
**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/server-inventory-api.yaml](contracts/server-inventory-api.yaml), [quickstart.md](quickstart.md), [.specify/memory/constitution.md](../../.specify/memory/constitution.md)

---

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Ejecutable en paralelo (archivos independientes, sin bloqueo por tareas incompletas).
- **[Story]**: Mapeo exacto a las Historias de Usuario de la especificación (`[US1]`, `[US2]`, `[US3]`, `[US4]`).
- Rutas de archivo exactas en cada tarea.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicialización del proyecto, dependencias del stack tecnológico y configuración de herramientas base.

- [ ] T001 Inicializar proyecto TypeScript y Next.js 15+ con configuración estricta (`strict: true`, `noUncheckedIndexedAccess: true`) en `package.json` y `tsconfig.json`
- [ ] T002 [P] Instalar dependencias de producción y desarrollo (`prisma`, `@prisma/client`, `zod`, `ssh2`, `@types/ssh2`, `lucide-react`, `vitest`, `@playwright/test`) en `package.json`
- [ ] T003 [P] Configurar validación de variables de entorno críticas (`ENCRYPTION_KEY`, `DATABASE_URL`) mediante Zod en `src/shared/env.ts`
- [ ] T004 [P] Configurar ejecutores de pruebas Vitest y Playwright en `vitest.config.ts` y `playwright.config.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura compartida, modelos de base de datos, servicio criptográfico y control de acceso que **DEBEN** estar completos antes de implementar cualquier historia de usuario.

**⚠️ CRITICAL**: El trabajo en las historias de usuario no puede comenzar hasta completar esta fase.

- [ ] T005 Definir esquema relacional de PostgreSQL con modelos `Server`, `ServerCredential`, `ConnectivityCheck`, `Tag`, `ServerTag` e `InventoryAuditLog` en `src/infrastructure/db/schema.prisma`
- [ ] T006 Implementar cliente singleton de persistencia y gestión de conexiones en `src/infrastructure/db/prisma.ts`
- [ ] T007 Implementar servicio criptográfico de grado empresarial `SecretVault` con AES-256-GCM, IV de 12 bytes aleatorio y auth tag en `src/infrastructure/crypto/secret-vault.ts`
- [ ] T008 [P] Implementar pruebas unitarias para `SecretVault` (cifrado, descifrado, detección de manipulación y cálculo de fingerprint) en `tests/unit/crypto/secret-vault.test.ts`
- [ ] T009 Definir tipos de dominio, enumeraciones (`os_type`, `environment`, `lifecycle_state`, `health_status`) y jerarquía de errores en `src/core/domain/server.types.ts` y `src/shared/errors/domain-errors.ts`
- [ ] T010 Implementar servicio de auditoría inmutable `AuditService` (registro append-only de usuario, acción, marcas temporales y diff sin secretos) en `src/core/services/audit.service.ts`
- [ ] T011 [P] Implementar guard de autorización backend y extracción de sesión (`SUPERADMIN` vs `OBSERVADOR`) en `src/infrastructure/security/rbac-guard.ts`
- [ ] T012 [P] Implementar adaptador de sondeo no intrusivo SSH para Linux (handshake y banner en solo lectura, timeout de 5s, sin comandos modificadores) en `src/infrastructure/network/ssh-probe.ts`
- [ ] T013 [P] Implementar adaptador de sondeo TCP/WinRM HTTPS para Windows Server (comprobación de socket y latencia, timeout de 5s) en `src/infrastructure/network/winrm-probe.ts`

**Checkpoint**: Base foundational completa. Las historias de usuario pueden implementarse de forma incremental e independiente.

---

## Phase 3: User Story 1 - Registro y Alta de un Nuevo Servidor (Priority: P1) 🎯 MVP

**Goal**: Permitir al SUPERADMIN dar de alta servidores Linux y Windows en el inventario con verificación de conectividad no intrusiva previa, credenciales cifradas con AES-256-GCM y auditoría de la operación.

**Independent Test**: Iniciar sesión como SUPERADMIN, enviar el formulario de alta con credenciales técnicas válidas hacia un servidor de prueba; verificar respuesta HTTP 201, conectividad inicial confirmada, credencial cifrada en base de datos sin filtrarse en la respuesta, y registro en `inventory_audit_logs`.

### Tests for User Story 1 ⚠️
- [ ] T014 [P] [US1] Pruebas de integración para endpoint de alta de servidor y sondeo SSH (camino feliz con clave SSH y camino infeliz de timeout) en `tests/integration/api/server-create.test.ts`

### Implementation for User Story 1
- [ ] T015 [P] [US1] Definir esquemas de validación Zod para alta de servidor (`CreateServerSchema` y `ServerCredentialSchema`) en `src/shared/validations/server.schema.ts`
- [ ] T016 [US1] Implementar servicio de negocio `ServerService.createServer` coordinando validación, cifrado de credencial, sondeo inicial y auditoría en `src/core/services/server.service.ts`
- [ ] T017 [US1] Implementar endpoint REST `POST /api/v1/servers` con verificación obligatoria de rol SUPERADMIN en `src/app/api/v1/servers/route.ts`
- [ ] T018 [US1] Implementar endpoint de prueba de conectividad bajo demanda `POST /api/v1/servers/[id]/test-connection` en `src/app/api/v1/servers/[id]/test-connection/route.ts`
- [ ] T019 [P] [US1] Implementar componente de formulario de alta `ServerForm` con selector de SO y carga de clave SSH en `src/components/servers/ServerForm.tsx`
- [ ] T020 [US1] Implementar página de registro de servidor en `src/app/(dashboard)/servers/new/page.tsx`

**Checkpoint**: User Story 1 (MVP) completamente funcional y verificable de extremo a extremo.

---

## Phase 4: User Story 2 - Consulta, Filtrado y Visualización Detallada del Inventario (Priority: P1)

**Goal**: Proporcionar a SUPERADMIN y OBSERVADOR una vista unificada del inventario con filtros multifactoriales en tiempo real (< 1s), estados accesibles visualmente y ocultamiento estricto de secretos para observadores.

**Independent Test**: Consultar el inventario con rol OBSERVADOR; aplicar filtros combinados por entorno/SO/salud; verificar que no se filtran secretos en JSON, los badges muestran icono + texto, y se devuelven los servidores esperados.

### Tests for User Story 2 ⚠️
- [ ] T021 [P] [US2] Pruebas de integración para listado, paginación, filtros multifactoriales y purga de credenciales para rol OBSERVADOR en `tests/integration/api/server-list.test.ts`

### Implementation for User Story 2
- [ ] T022 [US2] Implementar servicio de consultas con filtrado indexado (entorno, SO, salud, etiquetas) y búsqueda en `src/core/services/server-query.service.ts`
- [ ] T023 [US2] Implementar serializador DTO `ServerPresenter` que sanea las credenciales (exponiendo solo tipo y huella pública sin secreto) en `src/core/services/server-presenter.ts`
- [ ] T024 [US2] Implementar endpoints REST `GET /api/v1/servers` y `GET /api/v1/servers/[id]` con soporte de paginación y filtros en `src/app/api/v1/servers/route.ts` y `src/app/api/v1/servers/[id]/route.ts`
- [ ] T025 [P] [US2] Implementar componente de badge de salud accesible `ServerStatusBadge` (iconografía + texto descriptivo, no dependiente del color) en `src/components/servers/ServerStatusBadge.tsx`
- [ ] T026 [P] [US2] Implementar tabla interactiva de inventario con filtros multifactoriales y búsqueda instantánea en `src/components/servers/ServerTable.tsx`
- [ ] T027 [US2] Implementar página principal del catálogo de inventario en `src/app/(dashboard)/servers/page.tsx`
- [ ] T028 [US2] Implementar vista de ficha técnica detallada del servidor en `src/app/(dashboard)/servers/[id]/page.tsx`

**Checkpoint**: User Stories 1 y 2 completamente operativas e independientes.

---

## Phase 5: User Story 3 - Gestión del Ciclo de Vida y Edición de Metadatos (Priority: P2)

**Goal**: Permitir al SUPERADMIN editar metadatos organizacionales y transicionar el servidor a `MAINTENANCE` o `DISABLED` silenciando alertas y sondeos para mitigar fatiga, bloqueando mutaciones a observadores con `403 Forbidden`.

**Independent Test**: Poner un servidor en `MAINTENANCE`; verificar suspensión de sondeos automáticos, emisión de evento de auditoría con motivo y confirmación de que un usuario OBSERVADOR recibe rechazo `403 Forbidden` al intentar editar.

### Tests for User Story 3 ⚠️
- [ ] T029 [P] [US3] Pruebas de seguridad de autorización verificando respuesta `403 Forbidden` y auditoría ante intentos de edición por rol OBSERVADOR en `tests/integration/security/rbac-authorization.test.ts`
- [ ] T030 [P] [US3] Pruebas unitarias de máquina de estados para transiciones de ciclo de vida (`ACTIVE` <-> `MAINTENANCE` <-> `DISABLED`) en `tests/unit/domain/lifecycle-state.test.ts`

### Implementation for User Story 3
- [ ] T031 [US3] Implementar servicio de ciclo de vida `ServerLifecycleService` gestionando transiciones de estado, silenciado de sondeos y auditoría en `src/core/services/server-lifecycle.service.ts`
- [ ] T032 [US3] Implementar endpoints REST `PATCH /api/v1/servers/[id]` (metadatos) y `PATCH /api/v1/servers/[id]/lifecycle` (estado) en `src/app/api/v1/servers/[id]/route.ts` y `src/app/api/v1/servers/[id]/lifecycle/route.ts`
- [ ] T033 [P] [US3] Implementar modal de ventana de mantenimiento con captura obligatoria de motivo en `src/components/servers/MaintenanceModal.tsx`
- [ ] T034 [US3] Integrar controles de ciclo de vida y edición de metadatos en la vista de detalle en `src/app/(dashboard)/servers/[id]/page.tsx`

**Checkpoint**: Ciclo de vida y mantenimiento funcional con seguridad estricta en backend.

---

## Phase 6: User Story 4 - Retiro y Desincorporación Formal del Inventario (Priority: P3)

**Goal**: Permitir al SUPERADMIN retirar de forma permanente servidores decomisados (`RETIRED`), destruyendo físicamente sus credenciales en reposo pero preservando el histórico de auditoría e incidentes.

**Independent Test**: Ejecutar baja de un servidor enviando el nombre de confirmación exacto; verificar código HTTP 200, eliminación física de la clave en `server_credentials`, paso a estado `RETIRED` y persistencia intacta de logs de auditoría pasados.

### Tests for User Story 4 ⚠️
- [ ] T035 [P] [US4] Pruebas de integración para desincorporación de servidores, purgado físico de credenciales y preservación de auditoría en `tests/integration/api/server-retire.test.ts`

### Implementation for User Story 4
- [ ] T036 [US4] Implementar servicio de desincorporación `ServerDecommissionService` con validación de nombre, purgado de credenciales y auditoría en `src/core/services/server-decommission.service.ts`
- [ ] T037 [US4] Implementar endpoint REST `DELETE /api/v1/servers/[id]` con validación del payload de confirmación en `src/app/api/v1/servers/[id]/route.ts`
- [ ] T038 [P] [US4] Implementar diálogo de confirmación de retiro con verificación por escritura del nombre en `src/components/servers/DecommissionDialog.tsx`

**Checkpoint**: Las 4 historias de usuario están implementadas y verificadas de forma aislada.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Pruebas de extremo a extremo (E2E), endurecimiento de seguridad y validación de criterios de aprobación.

- [ ] T039 [P] Implementar suite de pruebas E2E con Playwright cubriendo el flujo completo de alta, visualización con filtros, mantenimiento y baja en `tests/e2e/server-inventory.spec.ts`
- [ ] T040 [P] Redactar guía operativa de despliegue, configuración de secretos y resolución de problemas en `docs/server-inventory-guide.md`
- [ ] T041 Ejecutar validación final de todos los criterios de aceptación y escenarios del [quickstart.md](quickstart.md) verificando conformidad estricta con la Constitución v1.0.0

---

## Dependencies & Execution Order

### Phase Dependencies

```
[Phase 1: Setup] ──► [Phase 2: Foundational] ──► [Phase 3: US1 (MVP)] ──► [Phase 4: US2] ──► [Phase 5: US3] ──► [Phase 6: US4] ──► [Phase 7: Polish]
```

- **Phase 1 (Setup)**: Sin dependencias previas.
- **Phase 2 (Foundational)**: Bloquea todas las historias de usuario. Debe completarse antes de avanzar.
- **Phase 3 (User Story 1 - P1)**: Depende de Phase 2. Entrega el MVP funcional de inventario.
- **Phase 4 (User Story 2 - P1)**: Depende de Phase 2 y consume entidades de US1.
- **Phase 5 (User Story 3 - P2)**: Depende de Phase 3 y 4.
- **Phase 6 (User Story 4 - P3)**: Depende del modelo consolidado de servidor.
- **Phase 7 (Polish)**: Requiere que las historias de usuario deseadas estén concluidas.

### Parallel Opportunities

- **Setup**: `T002`, `T003` y `T004` pueden desarrollarse en paralelo tras `T001`.
- **Foundational**: `T008` (tests cripto), `T011` (guard RBAC), `T012` (sondeo SSH) y `T013` (sondeo WinRM) pueden ejecutarse en paralelo tras definir el esquema base (`T005`-`T007`).
- **User Story 1**: Los tests `T014`, los esquemas Zod `T015` y el formulario UI `T019` pueden ejecutarse en paralelo antes de la integración final.
- **User Story 2**: Los tests `T021`, el badge de salud `T025` y la tabla `T026` son paralelizables.
- **User Story 3**: Los tests `T029`, `T030` y el modal `T033` son paralelizables.
- **User Story 4**: El test `T035` y el componente de diálogo `T038` son paralelizables.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar **Phase 1: Setup** (T001 - T004).
2. Completar **Phase 2: Foundational** (T005 - T013).
3. Completar **Phase 3: User Story 1** (T014 - T020).
4. **Validación Independiente**: Ejecutar tests de creación y sondeo SSH/WinRM con verificación de secretos cifrados.
5. El sistema ya es capaz de incorporar servidores de forma segura a la base de datos con comprobación de estado.

### Incremental Delivery

1. **Incremento 1 (MVP)**: Alta y verificación de servidores (`US1`).
2. **Incremento 2**: Catálogo de consulta, filtrado en tiempo real y vista segura para rol OBSERVADOR (`US2`).
3. **Incremento 3**: Control de ventanas de mantenimiento programado y suspensión de alertas (`US3`).
4. **Incremento 4**: Retiro definitivo con destrucción de secretos en reposo (`US4`).
5. **Incremento 5**: Batería E2E y documentación técnica de operaciones (`Polish`).
