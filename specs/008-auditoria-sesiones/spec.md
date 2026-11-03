# Feature Specification: Auditoría Visible e Invalidación de Sesiones

**Feature Branch**: `main`
**Created**: 2026-11-03
**Status**: Implementada
**Depende de**: 007-gestion-usuarios, auth real (scrypt + sesión HMAC)

## Contexto

1. La auditoría existe en la base (`inventory_audit_logs`) pero no hay forma de consultarla
   desde la plataforma: ante un incidente de seguridad el operador debe pedir acceso a la BD.
2. Las sesiones son tokens HMAC stateless de 8 h. Al desactivar una cuenta o cambiar su rol o
   contraseña, el token ya emitido seguía siendo válido hasta expirar, dejando una ventana de
   acceso no autorizado.

## User Stories

### US1 — Consultar la auditoría desde la UI (P1)

Como SUPERADMIN quiero ver y filtrar el registro de auditoría para investigar quién hizo qué,
cuándo y desde qué IP.

**Criterios de aceptación**
1. `GET /api/v1/audit` paginado (máx. 200, por defecto 50) y ordenado por fecha descendente.
2. Filtros por acción, actor y rango de fechas.
3. Solo SUPERADMIN; OBSERVADOR recibe 403 auditado.
4. Cada evento muestra actor (username resuelto), acción legible, objetivo, IP y detalle JSON.
5. Los secretos nunca aparecen: el `detailsDiff` ya se sanitiza al escribir.
6. Pantalla `/audit` con filtros, paginación y detalle expandible; enlace solo para SUPERADMIN.

### US2 — Invalidación inmediata de sesiones (P2)

Como SUPERADMIN quiero que al desactivar una cuenta, cambiar su rol o restablecer su contraseña,
sus sesiones abiertas dejen de funcionar de inmediato.

**Criterios de aceptación**
1. Cada usuario tiene `sessionVersion`; el token de sesión incluye `sv`.
2. Toda petición autenticada por cookie revalida contra la BD: existencia, `isActive` y `sv`.
3. El rol efectivo se toma de la BD, no del token.
4. Desactivar, cambiar rol o resetear contraseña incrementa `sessionVersion` (revocación).
5. Al cambiar la propia contraseña se emite un token nuevo para no expulsar al usuario.
6. Las páginas del dashboard revalidan en el servidor y redirigen a `/login` si la sesión murió.
7. Los tokens anteriores a la versión (sin `sv`) se rechazan: re-login obligatorio tras el deploy.

## Requerimientos Funcionales

- **FR-001**: El sistema MUST registrar `session_version` en `users` (default 0).
- **FR-002**: El token MUST incluir `sv`; `verifySessionToken` MUST rechazar tokens sin `sv`.
- **FR-003**: El guard de API MUST validar la sesión contra la BD en cada petición.
- **FR-004**: El guard MUST usar el rol de la BD y rechazar cuentas inactivas o inexistentes.
- **FR-005**: Los cambios de rol/estado/contraseña MUST incrementar `sessionVersion`.
- **FR-006**: El cambio de contraseña propio MUST reemitir la cookie con la nueva versión.
- **FR-007**: `GET /api/v1/audit` MUST ser solo SUPERADMIN y aceptar filtros validados.
- **FR-008**: La UI `/audit` MUST mostrar paginación, filtros y detalle sanitizado.

## Requerimientos No Funcionales

- **NFR-001**: Una consulta adicional por petición autenticada (índice por `id` primario).
- **NFR-002**: Sin dependencias nuevas.
- **NFR-003**: Auditoría de solo lectura: no se exponen endpoints de escritura/borrado.
- **NFR-004**: Consultas de auditoría acotadas (máx. 200 filas) para no degradar la BD.

## Success Criteria

- **SC-001**: Un SUPERADMIN filtra la auditoría por acción y ve los eventos reales.
- **SC-002**: Un OBSERVADOR recibe 403 en `/api/v1/audit`.
- **SC-003**: Desactivar un usuario invalida su sesión en la siguiente petición (401).
- **SC-004**: Cambiar el rol aplica de inmediato sin esperar al re-login.
- **SC-005**: Cambiar la propia contraseña mantiene la sesión activa con el token nuevo.

## Fuera de alcance

- Exportación de la auditoría a CSV (cubierta por `/api/v1/metrics/export` para otros datasets).
- Retención/rotación automática de logs de auditoría.
- Sesiones concurrentes múltiples por usuario con revocación individual.
