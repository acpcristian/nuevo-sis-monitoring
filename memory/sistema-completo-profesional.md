# Sistema completo y profesional — estado al 2026-11-02

## Qué se construyó
- **Auth real**: usuarios en DB con hash scrypt (`auth.service.ts`), sesión cookie
  HttpOnly firmada HMAC-SHA256 (`session.ts` + `session.constants.ts`), login/logout/me
  (`/api/v1/auth/*`), `RbacGuard` cookie-first con fallback de headers (transición),
  `middleware.ts` que redirige a `/login`, semilla SUPERADMIN idempotente desde
  `SUPERADMIN_USER` / `SUPERADMIN_PASSWORD`.
- **Navegación global**: `src/app/(dashboard)/layout.tsx` + `components/nav/TopNav.tsx`
  (Servidores, Logs, Alertas, Incidentes, Notificaciones, Métricas, Automatización).
- **003 Incidentes**: SLA por categoría (30/120/480 min), máquina de estados, escalado,
  round-robin, auditoría append-only; UI lista/alta/detalle con timeline y cierre con
  causa raíz obligatoria.
- **004 Notificaciones**: canales cifrados AES-256-GCM (`SecretVault`), emisores reales
  (Slack, webhook, PagerDuty v2, SMTP nodemailer), dedup 5 min, backoff exponencial,
  historial de entregas, reintentos bajo demanda.
- **005 Métricas**: `/api/v1/metrics/overview` (KPIs, SLA 7 d, MTTR mediano, serie 24 h),
  `/metrics` con gráficos SVG nativos, export CSV/JSON auditado.
- **006 Automatización**: playbooks secuenciales fail-fast; acciones seguras ejecutables y
  mutantes `SKIPPED_APPROVAL` (human-in-the-loop); nacen DISABLED; todo auditado.

## Gotchas críticos
- **Edge Runtime**: `middleware.ts` NO puede importar módulos con `node:crypto`.
  Usar solo `session.constants.ts` en el middleware (bug detectado en build de Coolify).
- **Prisma Json** en strict: castear con `as unknown as Prisma.InputJsonValue`.
- **`Object.keys(rows[0])`** con `noUncheckedIndexedAccess` explota: castear `rows[0]` a
  `Record<string, unknown>` (bug que rompió un build de Coolify).
- **PowerShell 5.1** doble-codifica UTF-8: usar `[System.IO.File]::ReadAllText/WriteAllText`
  con `UTF8Encoding($false)` y el normalizador `fix_mojibake.ps1` para acentos.
- **Coolify envs nuevos**: `AUTH_SECRET`, `SUPERADMIN_USER=admin`,
  `SUPERADMIN_PASSWORD` (configurados por API en la app `gqe0clxgeedygjtnwqzpagpw`).
- Deploy: `POST /api/v1/deploy` con JSON en archivo temporal; el listado de deployments
  es un **array plano** (`GET /api/v1/deployments?resource_uuid=...`), no `{deployments}`.
- La URL del panel es self-signed: usar `curl -k`. La URL de la app es LAN-only
  (`http://gqe0clxgeedygjtnwqzpagpw.172.16.100.22.sslip.io`).

## Verificación E2E real (2026-11-02, contra Coolify)
- `GET /api/health` → 200 `{"status":"ok"}`.
- Login `admin` con `SUPERADMIN_PASSWORD` → 200 + cookie HttpOnly; `/api/v1/auth/me` → SUPERADMIN.
- Servidor creado (201) → log ingerido (201, `token=[REDACTED]` sanitizado) → incidente
  CRÍTICO con SLA 30 min (201) → ASSIGNED → IN_PROGRESS → RESOLVED (rootCause) → CLOSED,
  con 5 entradas de auditoría append-only.
- `/api/v1/metrics/overview` 200; export CSV `text/csv` con filas.
- Canal WEBHOOK inalcanzable: creación 201 sin secretos en respuesta; prueba → 502 controlado;
  entrega `RETRYING` con `nextRetryAt`; reenvío idéntico → `deduplicated: true`.
- Playbook: DISABLED → ejecutar 409; activar → ejecución SUCCESS; `RUN_COMMAND` →
  `SKIPPED_APPROVAL` (human-in-the-loop).
- OBSERVADOR vía header → 403; API sin sesión → 401; todas las páginas protegidas → 200 con
  sesión y 307 a `/login` sin ella.
- Break-glass: si el hash del SUPERADMIN no coincide con `SUPERADMIN_PASSWORD`, el login
  re-sincroniza el hash y audita `USER_UPDATED`.

