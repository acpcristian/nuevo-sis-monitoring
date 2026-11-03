# Tasks: 006-automatizacion

## 1. Modelo y servicio
- [x] T001 `Playbook` (trigger JSON, steps JSON, estado) + `PlaybookExecution` (stepsLog append-only)
- [x] T002 Motor secuencial fail-fast; las acciones mutantes (RESTART_SERVICE/APPLY_CONFIG/RUN_COMMAND) quedan `SKIPPED_APPROVAL` — human-in-the-loop (Principio V)
- [x] T003 Acciones seguras ejecutables: CHECK_STATE (verificación pasiva), WAIT_SECONDS, NOTIFY_TEAM (usa el servicio de notificaciones real)
- [x] T004 Playbooks nacen `DISABLED`; activación consciente antes de ejecutar
- [x] T005 Auditoría `PLAYBOOK_CREATED/UPDATED/DELETED/EXECUTED/FAILED` con pasos y resultado

## 2. API y UI
- [x] T006 `GET/POST /api/v1/playbooks`, `GET/PATCH/DELETE/POST /api/v1/playbooks/[id]` (execute), solo SUPERADMIN muta
- [x] T007 `/automation`: constructor de pasos, activar/deshabilitar, ejecutar con resultado por paso, historial de ejecuciones
- [x] T008 Enlace «Automatización» en navegación global

## 3. Validación
- [x] T009 E2E contra despliegue: crear playbook con CHECK_STATE + WAIT_SECONDS → deshabilitado rechaza ejecución → activar y ejecutar OK; playbook con RUN_COMMAND registra SKIPPED_APPROVAL
- [x] T010 Gate técnico: typecheck + test + build en verde

## Dependencias
- Sin dependencias nuevas.
