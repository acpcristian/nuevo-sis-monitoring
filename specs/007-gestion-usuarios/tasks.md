# Tasks: 007-gestion-usuarios

## 1. Validación y contrato

- [x] T001 `src/shared/validations/user.schema.ts`: username (3–50, `[A-Za-z0-9._-]`), contraseña (10–128, letra + dígito), alta, actualización, reset y cambio propio
- [x] T002 Mensajes de validación en español aptos para UI

## 2. Servicio

- [x] T003 `UserService.list/get` con proyección sin `passwordHash`
- [x] T004 `UserService.create` con unicidad (409) y hash scrypt
- [x] T005 `UserService.update` con autobloqueo y protección del último SUPERADMIN activo
- [x] T006 `UserService.resetPassword` y `changeOwnPassword` (verifica actual, impide reutilizar)
- [x] T007 Auditoría `USER_CREATED`, `USER_UPDATED`, `USER_PASSWORD_RESET`, `USER_PASSWORD_CHANGED`

## 3. API

- [x] T008 `GET/POST /api/v1/users` (solo SUPERADMIN, 403 auditado)
- [x] T009 `GET/PATCH/POST /api/v1/users/[id]` (detalle, edición, `reset-password`)
- [x] T010 `POST /api/v1/auth/password` (cambio propio, cualquier rol autenticado)

## 4. UI

- [x] T011 `/users`: KPIs, alta con generador de contraseña, tabla y acciones por fila
- [x] T012 Enlace «Usuarios» solo para SUPERADMIN en `TopNav`
- [x] T013 Modal «Mi contraseña» para todos los usuarios
- [x] T014 Estados de error visibles (409/422/403) sin exponer secretos

## 5. Validación

- [x] T015 Unit tests: política de contraseña y reglas de protección del servicio (104/104 tests)
- [x] T016 Gate técnico: `tsc --noEmit` + `vitest run` + `next build` en verde
- [ ] T017 E2E en vivo: crear OBSERVADOR → login → 403 en mutaciones → reset → login con nueva → cambio propio → desactivar → login rechazado

## Dependencias

- Ninguna nueva: zod, Prisma, lucide-react y `node:crypto` ya presentes (Principio XV).
