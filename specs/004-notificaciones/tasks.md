# Tasks: 004-notificaciones

## 1. Datos y cifrado
- [x] T001 `NotificationChannel` (config cifrada AES-256-GCM vía `SecretVault`) + `NotificationDelivery` con `dedupKey` único por canal
- [x] T002 `configSummary` público sin secretos — las credenciales nunca se devuelven por API (Principio III)
- [x] T003 Enums `ChannelType` (EMAIL/SLACK/WEBHOOK/PAGERDUTY), `ChannelStatus`, `DeliveryStatus`

## 2. Servicio y API
- [x] T004 Emisores reales: Slack webhook, Webhook HTTP genérico, PagerDuty Events API v2 (fetch con timeout 10 s), SMTP real con nodemailer
- [x] T005 Deduplicación anti-tormenta por ventana temporal (sha256 de canal+título+severidad+bucket de 5 min)
- [x] T006 Reintentos con backoff exponencial (30 s × 2^n, tope 10 min, máx. 10 intentos) persistidos en `NotificationDelivery`
- [x] T007 `GET/POST /api/v1/channels`, `PATCH/DELETE/POST /api/v1/channels/[id]` (test, process-retries), solo SUPERADMIN muta
- [x] T008 `GET /api/v1/notifications` historial de entregas; `POST` envío manual auditado
- [x] T009 Auditoría de todo cambio de canal y de cada entrega/fallo/reintento

## 3. UI
- [x] T010 `/channels`: alta por tipo de canal, pruebas de envío, activar/desactivar, eliminar, historial de entregas
- [x] T011 Enlace «Notificaciones» en la navegación global

## 4. Validación
- [x] T012 E2E contra despliegue: crear canal → prueba (fallo controlado con URL inválida) → entrega RETRYING/FAILED visible → reintento
- [x] T013 Gate técnico: typecheck + test + build en verde

## Dependencias
- `nodemailer` + `@types/nodemailer` (MIT, mantenida, estándar de industria) — evaluada bajo Principio XV; los demás canales usan `fetch` nativo sin dependencias.
