# Gestión de usuarios (007) — implementación y verificación

## Qué se agregó
- `src/shared/validations/user.schema.ts` — username `[A-Za-z0-9._-]{3,50}`, contraseña
  10–128 con letra + dígito, esquemas de alta/edición/reset/cambio propio.
- `src/core/services/user.service.ts` — list/get/create/update/resetPassword/changeOwnPassword.
- API: `GET|POST /api/v1/users`, `GET|PATCH|POST /api/v1/users/[id]`,
  `POST /api/v1/auth/password`.
- UI: `/users` (KPIs, alta con generador, edición, activar/desactivar, reset) y modal
  «Mi contraseña» en `TopNav` (visible para todos los roles).
- Auditoría nueva: `USER_CREATED`, `USER_UPDATED`, `USER_PASSWORD_RESET`,
  `USER_PASSWORD_CHANGED` (nunca guarda la contraseña; el sanitizador la enmascara).

## Reglas de negocio implementadas
1. Solo SUPERADMIN lista y muta usuarios; OBSERVADOR recibe 403 auditado.
2. Un SUPERADMIN no puede desactivarse ni cambiar su propio rol (409).
3. La plataforma no puede quedar sin SUPERADMIN activo (409 + mensaje accionable).
4. `passwordHash` no aparece en ninguna respuesta ni en el listado.
5. Username duplicado → 409; contraseña fuera de política → 422.
6. Cambio propio exige la contraseña actual (400 si no coincide) y prohíbe reutilizarla (409).
7. Reset administrativo invalida la contraseña anterior en el siguiente login.

## Verificación E2E en vivo (2026-11-03)
| Caso | Resultado |
|---|---|
| Login admin + `GET /api/v1/users` | 200, 1 usuario, sin `passwordHash` |
| Alta `observador.prueba` (OBSERVADOR) | 201 |
| Alta duplicada | 409 `CONFLICT` |
| Contraseña débil (`corta1`) | 422 `VALIDATION_ERROR` |
| Login del OBSERVADOR | 200 |
| OBSERVADOR `GET /users` / `POST /incidents` | 403 / 403 |
| OBSERVADOR `GET /servers` | 200 (lectura permitida) |
| Reset admin a nueva contraseña | 200; login viejo 401, nuevo 200 |
| Cambio propio (b → c) | 200; reutilizar c 409; login b 401, c 200 |
| Desactivar cuenta | 200; login 401 |
| Reactivar + editar nombre | 200; login 200 |
| Admin se autodesactiva / cambia su rol | 409 / 409 |
| Usuario inexistente | 404 |
| `/users` con sesión / sin sesión | 200 / 307 → `/login` |
| `POST /auth/password` sin sesión | 401 |

Cuenta de prueba `observador.prueba` quedó **desactivada** para no dejar credenciales
conocidas activas; puede reactivarse desde `/users` y asignarle una contraseña nueva.

## Limitación conocida
La sesión es un token HMAC stateless de 8 h. Desactivar a un usuario impide nuevos logins,
pero un token ya emitido sigue siendo válido hasta su expiración. Para invalidación inmediata
se debe rotar `AUTH_SECRET` en Coolify (invalida todas las sesiones) o reducir el TTL.
