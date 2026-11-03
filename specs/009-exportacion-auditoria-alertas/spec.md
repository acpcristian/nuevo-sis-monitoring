# Feature Specification: Exportación de Auditoría y Alertas de Seguridad

**Feature Branch**: `main`
**Created**: 2026-11-03
**Status**: Implementada
**Depende de**: 008-auditoria-sesiones, 004-notificaciones

## Contexto

1. La auditoría ya es visible en `/audit`, pero para análisis forense, entregas a auditoría
   externa o respaldo se necesita **descargar** el registro con los filtros aplicados.
2. Ante un intento de modificación no autorizado o una ráfaga de inicios de sesión fallidos,
   el sistema solo deja el rastro en la tabla de auditoría: nadie se entera hasta que alguien
   entra a mirar. Se requiere **aviso proactivo** por los canales ya configurados.

## User Stories

### US1 — Exportar la auditoría filtrada (P1)

Como SUPERADMIN quiero descargar los eventos de auditoría en CSV/JSON con los filtros de la
pantalla, para analizarlos fuera de la plataforma o entregarlos como evidencia.

**Criterios de aceptación**
1. `GET /api/v1/audit/export?action=&userId=&from=&to=&format=csv|json` — solo SUPERADMIN.
2. CSV con cabeceras `fecha, actor, accion, objetivo, ip, detalle` y escape RFC 4180.
3. BOM UTF-8 para que Excel respete los acentos.
4. Tope defensivo de 5000 filas; el JSON informa el total exportado.
5. La propia exportación se audita como `REPORT_EXPORTED` (dataset `audit`, filtros y filas).
6. Botón «Exportar CSV» en `/audit` que usa los filtros activos.
7. OBSERVADOR recibe 403 (auditado) y la UI no le muestra la pantalla.

### US2 — Alerta por intentos no autorizados y logins fallidos repetidos (P1)

Como responsable de seguridad quiero recibir un aviso por los canales activos cuando alguien
intenta saltarse el RBAC o acumula fallos de acceso, para responder a tiempo.

**Criterios de aceptación**
1. Cada `UNAUTHORIZED_ATTEMPT` dispara una alerta de severidad `HIGH` (asíncrona, no bloquea el 403).
2. `LOGIN_FAILED` de un mismo usuario: al alcanzar 5 fallos en 10 minutos se envía una alerta
   `CRITICAL`; se repite solo en múltiplos del umbral (5, 10, 15…).
3. El envío usa `NotificationService.sendNotification` (todos los canales activos y su dedup
   anti-tormenta de 5 minutos).
4. El mensaje nunca contiene contraseñas ni secretos: solo usuario, acción/IP y conteo.
5. Cada alerta emitida se registra como `SECURITY_ALERT_SENT` con canales y entregas.
6. Sin canales configurados, el sistema registra igualmente el evento con `channels: 0` y no falla.

## Requerimientos Funcionales

- **FR-001**: El export MUST reutilizar los filtros de `GET /api/v1/audit`.
- **FR-002**: El CSV MUST escapar comas, comillas, saltos de línea y punto y coma.
- **FR-003**: El export MUST limitarse a 5000 filas y ordenar por fecha descendente.
- **FR-004**: El export MUST auditarse como `REPORT_EXPORTED` antes de responder.
- **FR-005**: Toda denegación RBAC MUST disparar alerta `HIGH` sin retrasar la respuesta.
- **FR-006**: Los fallos de login MUST contarse por usuario en ventana de 10 minutos.
- **FR-007**: La alerta MUST emitirse al llegar al umbral y en múltiplos del mismo.
- **FR-008**: Toda alerta emitida MUST auditarse como `SECURITY_ALERT_SENT`.
- **FR-009**: Un fallo del canal de notificación MUST NOT romper login ni RBAC.

## Requerimientos No Funcionales

- **NFR-001**: Sin dependencias nuevas (catálogo de acciones y CSV propios).
- **NFR-002**: Las alertas se ejecutan en segundo plano (`void ... .catch`), sin latencia añadida.
- **NFR-003**: Exportaciones acotadas en memoria (máx. 10 000 filas absolutas).
- **NFR-004**: La consulta de conteo usa el índice de auditoría por acción/fecha.

## Success Criteria

- **SC-001**: Un SUPERADMIN descarga un CSV válido con los eventos filtrados.
- **SC-002**: El evento `REPORT_EXPORTED` aparece en la auditoría tras la descarga.
- **SC-003**: Un OBSERVADOR no puede exportar (403) ni mutar (403 + alerta).
- **SC-004**: Tras 5 logins fallidos aparece `SECURITY_ALERT_SENT` con `failures: 5`.
- **SC-005**: El login correcto sigue funcionando aunque el envío de alertas falle.

## Fuera de alcance

- Bloqueo automático de cuentas por fuerza bruta (lockout).
- Programación de exportaciones o envío automático por correo.
- Retención/rotación del log de auditoría.
