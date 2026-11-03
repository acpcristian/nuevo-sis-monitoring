# Plan Técnico: 007-gestion-usuarios

## 1. Modelo de datos

No requiere migración: `User` ya existe en `schema.prisma` con `username` único, `displayName`,
`role` (`UserRole`: SUPERADMIN | OBSERVADOR), `passwordHash`, `isActive`, `lastLoginAt`.
Se evita el borrado físico para no romper la trazabilidad (los `Incident.createdBy` y la
auditoría guardan identificadores históricos).

## 2. Servicio (`src/core/services/user.service.ts`)

| Método | Responsabilidad |
|---|---|
| `list()` | Devuelve `UserSummary` sin `passwordHash`, ordenado por rol/estado/usuario |
| `get(id)` | Detalle o `NotFoundError` |
| `create(input, actor)` | Valida duplicado, hashea con scrypt, audita `USER_CREATED` |
| `update(id, input, actor)` | Aplica diff con reglas de protección, audita `USER_UPDATED` |
| `resetPassword(id, newPassword, actor)` | Hashea y audita `USER_PASSWORD_RESET` |
| `changeOwnPassword(id, current, new, actor)` | Verifica actual, rechaza reutilización, audita `USER_PASSWORD_CHANGED` |

### Invariantes de seguridad

1. **Autobloqueo**: `update` rechaza `isActive: false` y cambio de `role` sobre el propio actor.
2. **Último SUPERADMIN**: si el cambio quitaría el rol o el estado activo al último SUPERADMIN
   activo, se lanza `ConflictError` (HTTP 409). Se cuenta con `prisma.user.count` dentro de la
   misma operación lógica.
3. **Secretos**: `passwordHash` nunca se proyecta en `UserSummary` ni en `detailsDiff`.
4. **Auditoría**: `AuditService.sanitizeDiff` ya enmascara claves que contienen `password`.

## 3. Validación (`src/shared/validations/user.schema.ts`)

- `UsernameSchema`: trim, 3–50, `/^[a-zA-Z0-9._-]+$/`.
- `PasswordSchema`: 10–128, al menos una letra y un dígito.
- `CreateUserSchema`, `UpdateUserSchema`, `ResetPasswordSchema`, `ChangeOwnPasswordSchema`.
- Mensajes en español para la UI.

## 4. API (`src/app/api/v1`)

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| GET | `/users` | SUPERADMIN | Lista de usuarios |
| POST | `/users` | SUPERADMIN | Alta |
| GET | `/users/[id]` | SUPERADMIN | Detalle |
| PATCH | `/users/[id]` | SUPERADMIN | Nombre/rol/estado |
| POST | `/users/[id]` | SUPERADMIN | `action: "reset-password"` |
| POST | `/auth/password` | autenticado | Cambio de contraseña propio |

Errores homogéneos `{ error_code, message }` y códigos 400/401/403/404/409/422/500.
El guard `RbacGuard.assertSuperAdmin` registra el intento denegado.

## 5. UI

- `src/app/(dashboard)/users/page.tsx` (cliente): tarjetas KPI (total, activos, superadmins),
  formulario de alta con generador de contraseña (`crypto.getRandomValues`), tabla con acciones
  editar / activar-desactivar / restablecer contraseña, banners de éxito y error.
- `TopNav`: enlace «Usuarios» visible solo para SUPERADMIN + modal «Mi contraseña» para todos.
- `(dashboard)/layout.tsx` ya entrega `{ username, role }` a la navegación.

## 6. Pruebas

- Unit: política de usuario/contraseña (zod) y reglas de protección del servicio con Prisma
  mockeado (último SUPERADMIN, autodesactivación, reutilización de contraseña).
- Gate: `tsc --noEmit`, `vitest run`, `next build`.
- E2E en vivo tras el deploy: crear OBSERVADOR → login → 403 en mutaciones → reset de contraseña
  → login con la nueva → cambio propio de contraseña → desactivar → login rechazado.

## 7. Constitución (chequeo)

| Principio | Cumplimiento |
|---|---|
| I. SDD | Spec/plan/tasks en `specs/007-gestion-usuarios` |
| II. Auditoría | 4 acciones nuevas auditadas (quién, a quién, IP, timestamp) |
| III. Secretos | scrypt + `passwordHash` excluido de API/auditoría |
| IV. Mínimo privilegio | Mutaciones solo SUPERADMIN; OBSERVADOR solo lectura |
| V. Human-in-the-loop | No aplica (sin acciones remotas) |
| VI. Trazabilidad | Eventos inmutables en `inventory_audit_logs` |
| XV. Dependencias | Ninguna nueva |
