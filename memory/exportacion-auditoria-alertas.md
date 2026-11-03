# Exportación de auditoría + alertas de seguridad (009)

## Qué se agregó
- `GET /api/v1/audit/export?action=&userId=&from=&to=&format=csv|json` — solo SUPERADMIN.
  CSV con BOM UTF-8, cabeceras `fecha, actor, accion, objetivo, ip, detalle`, escape RFC 4180
  y descarga como `auditoria_<stamp>.csv`. Tope 5000 filas.
- `REPORT_EXPORTED` (dataset `audit`) con filtros, filas y `truncated`.
- Botón «Exportar CSV» en `/audit` que respeta los filtros activos.
- `SecurityAlertService` con:
  - `onUnauthorizedAttempt` → alerta `HIGH` en cada `UNAUTHORIZED_ATTEMPT`.
  - `onLoginFailed` → alerta `CRITICAL` al llegar a **5 fallos en 10 min** por usuario
    (se repite en múltiplos: 10, 15…).
  - `deliver()` reutiliza `NotificationService.sendNotification` (canales activos + dedup 5 min)
    y audita `SECURITY_ALERT_SENT` con `channels` y `delivered`.
  - Envío en segundo plano (`void ... .catch`): nunca retrasa ni rompe login/RBAC.
- Catálogo: `SECURITY_ALERT_SENT` visible en el filtro de `/audit`.

## Puntos de enganche
- `RbacGuard.assertSuperAdmin` → alerta tras auditar `UNAUTHORIZED_ATTEMPT`.
- `AuthService.login` → alerta en usuario inexistente/inactivo y en contraseña incorrecta
  (el break-glass del SUPERADMIN no genera fallo).

## Verificación E2E en vivo (2026-11-03, deploy `xkiemlhdzepblepymtnknibn`)
| Caso | Resultado |
|---|---|
| Login admin | 200 |
| `GET /audit/export?format=csv` | 200, `text/csv`, 14 153 bytes, 85 filas + cabecera |
| Cabeceras y escape CSV | `fecha,actor,accion,objetivo,ip,detalle`; JSON interno entre comillas dobles |
| `Content-Disposition` | `attachment; filename="auditoria_202611031336.csv"` |
| Export filtrado `action=LOGIN_SUCCESS` | 200, 25 filas, solo `LOGIN_SUCCESS` |
| Export `format=json` | 200, `dataset=audit`, `total=25` |
| Auditoría `REPORT_EXPORTED` | 5 eventos con `dataset/format/rows` correctos |
| Página `/audit` con sesión | 200 y botón «Exportar CSV» presente |
| OBSERVADOR `GET /audit/export` | **403** (`EXPORT_AUDIT`) |
| OBSERVADOR `POST /servers` | **403** (`CREATE_SERVER`) |
| 5 logins fallidos de `intruso.prueba` | 401 ×5 |
| Alerta por fallos repetidos | `SECURITY_ALERT_SENT`: `kind=REPEATED_LOGIN_FAILURES`, `failures=5`, `severity=CRITICAL`, `channels=0` |
| Alertas por intento no autorizado | `kind=UNAUTHORIZED_ATTEMPT`, `severity=HIGH`, acciones `EXPORT_AUDIT` y `CREATE_SERVER` |
| Estado final | `observador.prueba` desactivada con contraseña rotada (`Alerta2026z`) |

## Notas operativas
- Con `channels=0` la alerta queda registrada en auditoría pero no sale correo: crear/activar un
  canal EMAIL en `/channels` para recibirla (la dedup del servicio es de 5 minutos).
- El conteo de fallos usa el JSON `detailsDiff.username` de `LOGIN_FAILED`; el usuario
  inexistente se registra con `userId = "anonimo"` y su username real en el detalle.
- El export ordena por fecha descendente y trunca a 5000 filas sin paginar.
