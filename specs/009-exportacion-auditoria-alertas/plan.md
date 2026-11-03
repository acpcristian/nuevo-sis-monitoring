# Plan Técnico: 009-exportacion-auditoria-alertas

## 1. Exportación de auditoría

### Servicio

`AuditService` se refactoriza con dos piezas privadas reutilizables:

- `buildWhere(filters)` — `where` de Prisma compartido por listado y exportación.
- `resolveActors(rows)` — resuelve `actorUsername` en una sola consulta `users(id in [...])`.

Nuevo `exportRows(filters, maxRows = 5000)`:

- mismos filtros, sin `skip`, orden `timestamp desc`;
- `take` acotado a 10 000 absolutas;
- devuelve `AuditListItem[]`.

`list()` queda con la misma semántica (paginada, máx. 200).

### Utilidad CSV

`src/shared/utils/csv.ts`:

- `escapeCsvValue` — comillas dobles si el valor contiene `, " \n \r ;`.
- `toCsv(rows, columns?)` — cabeceras configurables y separador `\r\n`.

### Endpoint

`GET /api/v1/audit/export?action=&userId=&from=&to=&format=csv|json`

1. `extractUser` + `assertSuperAdmin("EXPORT_AUDIT")`.
2. Valida `action` contra `AUDIT_ACTIONS` y `from/to` ISO.
3. `exportRows(..., 5000)`.
4. Audita `REPORT_EXPORTED` con `{ dataset: "audit", format, rows, filters, truncated }`.
5. CSV: BOM `\uFEFF`, `Content-Disposition: attachment; filename="auditoria_<stamp>.csv"`,
   `Cache-Control: no-store`.

### UI

`/audit` incorpora `buildFilterParams()` (compartido con el listado) y un enlace
`<a href>` a la exportación con `format=csv`; el navegador descarga con la cookie de sesión.

## 2. Alertas de seguridad

`src/core/services/security-alert.service.ts`:

```
LOGIN_FAILURE_THRESHOLD = 5
LOGIN_FAILURE_WINDOW_MINUTES = 10
```

- `onUnauthorizedAttempt({ userId, attemptedAction, targetId, ipAddress })`
  - resuelve el username si no se provee;
  - severidad `HIGH`; mensaje con usuario, acción, objetivo e IP.
- `onLoginFailed({ username, ipAddress })`
  - `count` de `LOGIN_FAILED` en la ventana filtrando `detailsDiff.username` (JSON path);
  - emite si `count >= 5` y `count % 5 === 0` (alertas en 5, 10, 15…);
  - severidad `CRITICAL`.
- `deliver()` centraliza el envío y la auditoría:
  - `NotificationService.sendNotification` (canales activos + dedup de 5 min);
  - registra `SECURITY_ALERT_SENT` con `{ kind, ...detalle, severity, channels, delivered }`;
  - cualquier excepción se captura: una alerta nunca rompe la operación.
- `notifyUnauthorizedAttempt` / `notifyLoginFailure` — envoltorios `void ... .catch` para
  invocar desde rutas sin esperar.

### Puntos de enganche

| Punto | Disparador |
|---|---|
| `RbacGuard.assertSuperAdmin` | tras auditar `UNAUTHORIZED_ATTEMPT` |
| `AuthService.login` (usuario inexistente/inactivo) | tras auditar `LOGIN_FAILED` |
| `AuthService.login` (contraseña incorrecta, no break-glass) | tras auditar `LOGIN_FAILED` |

No se engancha en `AuditService.recordEvent` para no acoplar auditoría con notificaciones
(evita recursión y efectos laterales en cada evento).

## 3. Catálogo

`audit-actions.ts` agrega `SECURITY_ALERT_SENT` con etiqueta «Alerta de seguridad enviada»
en el grupo «Acceso y usuarios», visible en el filtro de `/audit`.

## 4. Pruebas

- Unit: escape CSV (comas, comillas, saltos, `;`, null) y orden de columnas.
- Integración: `exportRows` (filtros, tope, sin eventos, actor resuelto).
- Integración: alertas (bajo umbral, en umbral, múltiplos, intento no autorizado,
  sin canales, fallo de SMTP no propaga).
- Gate: `tsc --noEmit`, `vitest run`, `next build`.
- E2E en vivo: export CSV/JSON, auditoría del export, 403 de OBSERVADOR con alerta,
  5 logins fallidos → `SECURITY_ALERT_SENT`.

## 5. Constitución (chequeo)

| Principio | Cumplimiento |
|---|---|
| II. Auditoría | El export se audita; las alertas dejan rastro con canales y entregas |
| III. Secretos | Mensajes sin contraseñas; `detailsDiff` sanitizado en origen |
| IV. Mínimo privilegio | Export solo SUPERADMIN; OBSERVADOR 403 auditado + alerta |
| VI. Trazabilidad | `SECURITY_ALERT_SENT` incluye tipo, usuario, IP y conteo |
| XI. Resiliencia | Fallo de notificación no rompe login ni RBAC |
| XV. Dependencias | Ninguna nueva |
