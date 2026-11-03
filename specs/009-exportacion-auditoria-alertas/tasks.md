# Tasks: 009-exportacion-auditoria-alertas

## 1. Exportación de auditoría

- [x] T001 Refactor `AuditService` con `buildWhere` y `resolveActors`
- [x] T002 `exportRows(filters, maxRows)` con tope de 5000 y máximo absoluto de 10 000
- [x] T003 Utilidad CSV (`escapeCsvValue`, `toCsv`) con escape RFC 4180
- [x] T004 `GET /api/v1/audit/export` (CSV/JSON), solo SUPERADMIN y validación de filtros
- [x] T005 Auditoría `REPORT_EXPORTED` con dataset `audit`, filtros y `truncated`
- [x] T006 Botón «Exportar CSV» en `/audit` con los filtros activos

## 2. Alertas de seguridad

- [x] T007 `SecurityAlertService.onUnauthorizedAttempt` (severidad HIGH)
- [x] T008 `SecurityAlertService.onLoginFailed` (umbral 5 / 10 min, múltiplos del umbral)
- [x] T009 Auditoría `SECURITY_ALERT_SENT` con canales y entregas; `deliver` tolerante a fallos
- [x] T010 Enganche en `RbacGuard.assertSuperAdmin` (asíncrono, sin bloquear el 403)
- [x] T011 Enganche en `AuthService.login` (usuario inactivo/inexistente y contraseña incorrecta)
- [x] T012 `SECURITY_ALERT_SENT` añadido al catálogo y al filtro de `/audit`

## 3. Validación

- [x] T013 Tests CSV (4 casos)
- [x] T014 Tests de exportación de auditoría (4 casos)
- [x] T015 Tests de alertas de seguridad (7 casos) — 132/132 en total
- [x] T016 Gate técnico: `tsc --noEmit` + `vitest run` + `next build` en verde
- [x] T017 E2E en vivo: CSV/JSON descargados, export auditado, OBSERVADOR 403 + alerta,
      5 logins fallidos → `SECURITY_ALERT_SENT`

## Dependencias

- Ninguna nueva (Principio XV).
