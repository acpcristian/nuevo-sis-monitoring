# Auditoría visible + invalidación de sesiones (008)

## Qué se agregó
- `GET /api/v1/audit` — consulta paginada (máx. 200) con filtros `action`, `userId`, `from`,
  `to`, `limit`, `offset`; solo SUPERADMIN; resuelve `actorUsername`.
- `/audit` — pantalla con filtros (acción agrupada, actor, rango de fechas), badges por familia,
  detalle JSON expandible y paginación de 25.
- `User.sessionVersion` + `sv` en el token de sesión.
- `RbacGuard.extractUser` ahora es **async** y revalida contra la BD en cada petición:
  usuario existente, `isActive`, `sessionVersion` y rol efectivo.
- `(dashboard)/layout.tsx` revalida y redirige a `/login` si la sesión fue revocada.

## Reglas de revocación
| Evento | Efecto |
|---|---|
| Desactivar usuario | 401 inmediato (chequeo `isActive`) |
| Cambiar rol | 401 inmediato + el nuevo rol aplica al re-loguear |
| Reset administrativo de contraseña | 401 inmediato (`sv++`) |
| Cambio propio de contraseña | `sv++` + cookie nueva (la sesión continúa) |
| Token emitido antes del deploy (sin `sv`) | rechazado → re-login obligatorio |

## Verificación E2E en vivo (2026-11-03)
| Caso | Resultado |
|---|---|
| Cookie emitida antes del deploy | 401 |
| Login nuevo | 200 |
| `GET /api/v1/audit` | 200, 67 eventos, actor resuelto (`admin`, `observador.prueba`) |
| Filtro `action=LOGIN_SUCCESS` | 200, solo eventos de esa acción |
| OBSERVADOR `GET /users` y `GET /audit` | 403 / 403 |
| Desactivar cuenta → petición con cookie vieja | 401 inmediato |
| Cambio de rol → petición con cookie vieja | 401 «Sesión finalizada» |
| Re-login tras cambio de rol | 200 con el rol nuevo (SUPERADMIN) y `/users` 200 |
| Cambio propio de contraseña | 200 y `GET /users` con la misma cookie 200 |
| Revertir contraseña + login original | 200 |
| Página `/audit` con sesión | 200 y enlace en la navegación |

## Notas operativas
- El deploy ejecuta `prisma db push`, que agrega `session_version` sin migración manual.
- Todos los usuarios deben volver a iniciar sesión una vez tras este deploy (tokens sin `sv`).
- La cuenta `observador.prueba` quedó **desactivada** con contraseña rotada.
