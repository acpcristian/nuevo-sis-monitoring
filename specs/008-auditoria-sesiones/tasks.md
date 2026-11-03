# Tasks: 008-auditoria-sesiones

## 1. Sesiones versionadas

- [x] T001 `User.sessionVersion` (default 0) en `schema.prisma`
- [x] T002 Token con `sv`; rechazo de tokens sin versión en `verifySessionToken`
- [x] T003 `RbacGuard.extractUser` async con revalidación en BD (existencia, `isActive`, `sv`) y rol efectivo desde BD
- [x] T004 Migrar las 46 llamadas de rutas a `await RbacGuard.extractUser(request)`
- [x] T005 `(dashboard)/layout.tsx` revalida y redirige a `/login` si la sesión murió
- [x] T006 Incremento de `sessionVersion` al cambiar rol/estado, resetear contraseña y cambiar la propia
- [x] T007 `POST /auth/password` reemite cookie con la nueva versión
- [x] T008 `GET /auth/me` devuelve datos revalidados desde la BD

## 2. Auditoría consultable

- [x] T009 Catálogo `audit-actions.ts` (acciones + etiquetas en español, sin Prisma)
- [x] T010 `AuditService.list` con filtros, paginación acotada y resolución de actor
- [x] T011 `GET /api/v1/audit` solo SUPERADMIN, con validación de acción y fechas
- [x] T012 Pantalla `/audit` con filtros, badges, detalle expandible y paginación
- [x] T013 Enlace «Auditoría» solo para SUPERADMIN en `TopNav`

## 3. Validación

- [x] T014 Tests de token con versión y revalidación de sesión (6 casos)
- [x] T015 Tests de consulta de auditoría (4 casos) — 118/118 en total
- [x] T016 Gate técnico: `tsc --noEmit` + `vitest run` + `next build` en verde
- [x] T017 E2E en vivo: auditoría con filtros; desactivar usuario → 401; cambio de rol inmediato; cambio propio conserva sesión

## Dependencias

- Ninguna nueva (Principio XV).
