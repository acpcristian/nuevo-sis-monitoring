# Plan Técnico: 008-auditoria-sesiones

## 1. Esquema

`User.sessionVersion Int @default(0) @map("session_version")` — se aplica con el
`prisma db push` que ya ejecuta el contenedor al arrancar. No hay migración manual.

## 2. Sesión versionada

```
payload = { uid, username, role, sv, exp }
```

- `createSessionToken(uid, username, role, sessionVersion)` — firma HMAC-SHA256.
- `verifySessionToken` rechaza tokens sin `sv` (invalida los previos al deploy).

### Revalidación en cada petición (`RbacGuard.extractUser`, ahora async)

1. Verifica firma y expiración (sin BD) — sigue siendo Edge-safe en `middleware.ts`.
2. Si hay cookie válida, consulta `users(id)` y exige:
   - usuario existente, `isActive = true`, `sessionVersion === sv`.
3. Devuelve el **rol de la BD** (un cambio de rol aplica al instante).
4. Mantiene el fallback por headers/Bearer para pruebas e integraciones.

Se migraron las 46 llamadas de rutas a `await RbacGuard.extractUser(request)`.

### Revocación

| Evento | Efecto |
|---|---|
| `PATCH /users/[id]` con cambio de rol o `isActive` | `sessionVersion++` |
| `POST /users/[id]` reset-password | `sessionVersion++` |
| `POST /auth/password` (propio) | `sessionVersion++` + cookie nueva |
| Cuenta desactivada | rechazo por `isActive` |

`(dashboard)/layout.tsx` revalida contra la BD y hace `redirect("/login")` si la sesión murió,
cubriendo también la navegación de páginas (el middleware Edge solo verifica presencia de cookie).

## 3. Auditoría consultable

- `src/core/domain/audit-actions.ts`: catálogo único (valores + etiquetas en español), sin
  dependencias de Prisma para poder importarse en cliente.
- `AuditService.list({ action, userId, from, to, limit, offset })`:
  - `where` dinámico, orden `timestamp desc`, `take` acotado a 200, `skip` ≥ 0.
  - Resuelve `actorUsername` con una sola consulta `users(id in [...])`.
  - Devuelve `{ items, total, limit, offset }`.
- `GET /api/v1/audit` (solo SUPERADMIN): valida `action` contra el catálogo y `from/to` ISO.

## 4. UI `/audit`

- Filtros: acción (select agrupado), actor (select de usuarios), desde/hasta (date).
- Tabla: fecha, actor, acción (badge por familia + nombre legible), objetivo, IP.
- Detalle expandible con el JSON sanitizado y el `id` del evento.
- Paginación de 25 con contador «X–Y de N».
- Enlace «Auditoría» en la navegación, solo SUPERADMIN.

## 5. Pruebas

- Unit: roundtrip del token con `sv`, firma manipulada, expiración, token ausente.
- Integración: `extractUser` con Prisma mockeado (versión correcta, desfase, inactivo,
  usuario inexistente, rol tomado de BD, fallback por header, sin credenciales).
- Integración: `AuditService.list` (resolución de actor, filtros, topes, sin eventos).
- Gate: `tsc --noEmit`, `vitest run`, `next build`.
- E2E en vivo: auditoría con filtros; desactivar usuario → 401 inmediato; cambio de rol →
  efecto inmediato; cambio de contraseña propio → sesión sigue viva.

## 6. Constitución (chequeo)

| Principio | Cumplimiento |
|---|---|
| II. Auditoría | Consulta de solo lectura del log inmutable; toda denegación se audita |
| III. Secretos | `detailsDiff` sanitizado; el token no contiene contraseña |
| IV. Mínimo privilegio | `/audit` solo SUPERADMIN; rol efectivo desde BD |
| VI. Trazabilidad | Actor, IP, timestamp y diff en cada evento |
| VIII. No asumir salud | No aplica |
| XV. Dependencias | Ninguna nueva |
