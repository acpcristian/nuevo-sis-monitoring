# Tasks: 003-incident-management

> Fase de gestión de incidentes. Implementación alineada a `spec.md` y `plan.md`,
> consumiendo el servicio `incident.service.ts` ya alineado al `schema.prisma`.

## 1. API y SLA

- [x] T001 Extender `schema.prisma`: `User`, `Incident` (+SLA/escalado/rootCause), `IncidentAuditLog` append-only
- [x] T002 Alinear `incident.service.ts` al schema (creación con validación de FK, SLA por categoría, transiciones válidas, auditoría)
- [x] T003 `POST /api/v1/incidents` con permisos (SUPERADMIN crea; OBSERVADOR 403) e ipAddress en auditoría
- [x] T004 `GET /api/v1/incidents` filtros: status/priority/category/assignedTo/breached/search + paginación
- [x] T005 `PATCH /api/v1/incidents/[id]` transiciones con máquina de estados + respuesta `INCIDENT_CREATED` para 404/422 claros
- [x] T006 `POST /api/v1/incidents/[id]` acciones: `close` (requiere rootCause), `escalate`, `sla-scan`
- [x] T007 Auditar transiciones en `incident_audit_logs` y `inventory_audit_logs` (Principios VI, VIII)

## 2. UI Incidentes

- [x] T008 `/incidents` listado: badges de estado/prioridad, banner de SLA vencido, filtros, búsqueda, paginación
- [x] T009 `/incidents/new`: formulario de creación (servidor, categoría, prioridad, SLA personalizado, eventId opcional)
- [x] T010 `/incidents/[id]`: detalle con timeline append-only, acciones de transición permitidas, raíz del problema y acciones correctivas al resolver, escalado con motivo
- [x] T011 Navegación global: enlace «Incidentes» en `TopNav` + landings en layout `(dashboard)`

## 3. Integración con logs/alertas

- [x] T012 Botón «Crear incidente» desde alerta activa (`/logs/alerts`) pasando alertId/serverId al formulario

## 4. Validación

- [ ] T013 `pnpm typecheck` + `pnpm test` + `pnpm build` en verde
- [ ] T014 E2E real contra despliegue Coolify: crear → asignar → en progreso → resolver (rootCause) → cerrar; SLA vencido visible; OBSERVADOR rechazado con 403
- [ ] T015 Quickstart `specs/003-incident-management/quickstart.md` ejecutado y criterios SC verificados

## Notas de evaluación de dependencias (Principio XV)

No se agregan dependencias externas: la UI usa Tailwind + lucide-react ya presentes;
el servicio de SLA/round-robin usa Prisma y `node:crypto` existentes.
