# Feature Specification: Gestión de Usuarios y Contraseñas

**Feature Branch**: `main` (proyecto de despliegue continuo)
**Created**: 2026-11-03
**Status**: Implementada
**Depende de**: 001-server-inventory (RBAC base), auth real (scrypt + sesión HMAC)

## Contexto

La plataforma solo tiene el usuario semilla `admin` (SUPERADMIN) creado desde
`SUPERADMIN_USER` / `SUPERADMIN_PASSWORD`. No existe forma de dar de alta operadores con rol
`OBSERVADOR`, ni de rotar contraseñas sin redeploy, ni de desactivar accesos de personal que
sale de la institución. Esto obliga a compartir la cuenta de máxima privilegio, violando el
Principio de mínimo privilegio (IV) y degradando la trazabilidad de la auditoría (VI).

## User Stories

### US1 — Alta de operadores con mínimo privilegio (P1)

Como SUPERADMIN quiero crear usuarios `OBSERVADOR` con su propia contraseña para que el
personal de turno consulte la plataforma sin poder modificar nada.

**Criterios de aceptación**
1. Solo un SUPERADMIN autenticado puede crear usuarios (el resto recibe 403 auditado).
2. El nombre de usuario es único, de 3–50 caracteres `[A-Za-z0-9._-]`.
3. La contraseña cumple la política: mínimo 10 caracteres, al menos una letra y un dígito.
4. La respuesta nunca incluye `passwordHash` ni la contraseña.
5. El alta queda auditada como `USER_CREATED` (usuario afectado, rol, actor, IP).

### US2 — Gestión del ciclo de vida del usuario (P2)

Como SUPERADMIN quiero cambiar nombre visible, rol y estado (activo/inactivo) de un usuario
para reflejar altas, cambios de responsabilidad y bajas de personal.

**Criterios de aceptación**
1. `PATCH /api/v1/users/[id]` permite `displayName`, `role` e `isActive`.
2. Un SUPERADMIN no puede desactivarse ni cambiar su propio rol (evita autobloqueo).
3. El sistema rechaza cualquier cambio que deje **cero** SUPERADMIN activos.
4. Todo cambio queda auditado como `USER_UPDATED` con el diff antes/después.
5. Un usuario inactivo no puede iniciar sesión.

### US3 — Rotación de contraseñas (P3)

Como SUPERADMIN quiero restablecer la contraseña de un usuario que la olvidó, y como usuario
quiero cambiar mi propia contraseña, sin depender de un redeploy.

**Criterios de aceptación**
1. `POST /api/v1/users/[id]` con `action: "reset-password"` define una nueva contraseña
   (solo SUPERADMIN) y audita `USER_PASSWORD_RESET` sin registrar el valor.
2. `POST /api/v1/auth/password` permite a cualquier usuario autenticado cambiar su contraseña
   aportando la actual; audita `USER_PASSWORD_CHANGED`.
3. Rechazar contraseña actual incorrecta (400) y reutilización de la misma contraseña (409).
4. La nueva contraseña cumple la misma política que el alta.

### US4 — Interfaz de administración (P4)

Como SUPERADMIN quiero una pantalla `/users` para ver, crear y administrar usuarios y ver su
último acceso, sin usar la API a mano.

**Criterios de aceptación**
1. Tabla con usuario, nombre visible, rol, estado, último acceso y fecha de alta.
2. Alta con selector de rol y generador de contraseña segura.
3. Acciones por fila: editar (nombre/rol/estado) y restablecer contraseña.
4. El enlace «Usuarios» solo aparece para SUPERADMIN en la navegación global.
5. Todos los usuarios disponen de «Mi contraseña» en la barra superior.

## Requerimientos Funcionales

- **FR-001**: El sistema MUST persistir usuarios en la tabla `users` con `passwordHash` scrypt;
  nunca en texto plano ni reversible.
- **FR-002**: El sistema MUST restringir toda mutación de usuarios a SUPERADMIN, registrando
  el intento denegado como `UNAUTHORIZED_ATTEMPT`.
- **FR-003**: El sistema MUST impedir que quede la plataforma sin SUPERADMIN activo.
- **FR-004**: El sistema MUST impedir que un SUPERADMIN se desactive o se degrade a sí mismo.
- **FR-005**: El sistema MUST excluir `passwordHash` de toda respuesta de API y de la auditoría.
- **FR-006**: El sistema MUST auditar `USER_CREATED`, `USER_UPDATED`, `USER_PASSWORD_RESET` y
  `USER_PASSWORD_CHANGED` con actor, IP y timestamp.
- **FR-007**: El sistema MUST rechazar usernames duplicados con 409 y contraseñas fuera de
  política con 422.
- **FR-008**: El sistema MUST permitir al usuario autenticado cambiar su propia contraseña
  verificando la actual.
- **FR-009**: La UI MUST reflejar el estado real del backend (activar/desactivar, errores).

## Requerimientos No Funcionales

- **NFR-001**: Hash scrypt con salt aleatorio de 16 bytes y comparación `timingSafeEqual`.
- **NFR-002**: Respuestas de listado paginadas por límite razonable (`take 200`) y ordenadas
  por estado/rol/usuario.
- **NFR-003**: Sin dependencias nuevas (zod, Prisma y lucide-react ya presentes).
- **NFR-004**: La contraseña generada en UI usa `crypto.getRandomValues` y nunca se registra.

## Success Criteria

- **SC-001**: Un SUPERADMIN crea un OBSERVADOR y este inicia sesión con sus credenciales.
- **SC-002**: El OBSERVADOR recibe 403 en `POST/PATCH/DELETE` y en `GET /api/v1/users`.
- **SC-003**: El sistema rechaza desactivar/degradar al último SUPERADMIN activo.
- **SC-004**: Reset de contraseña y cambio propio funcionan; la contraseña anterior deja de ser
  válida en el siguiente login.
- **SC-005**: 100 % de las mutaciones de usuario aparecen en `inventory_audit_logs` con actor e IP.

## Fuera de alcance

- Recuperación de contraseña por correo (requiere SMTP institucional estable).
- Multi-tenant / organizaciones.
- Invalidación inmediata de sesiones ya emitidas (tokens HMAC stateless, TTL 8 h); se mitiga
  desactivando la cuenta y con la rotación de `AUTH_SECRET`.
- Borrado físico de usuarios (se prefiere desactivar para preservar la trazabilidad).
