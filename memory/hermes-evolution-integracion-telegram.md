---
type: project
title: Reparación e integración Hermes + Evolution API (Coolify, proyecto "Monitoreo")
date: 2026-11-14
---

## Contexto
El dueño instaló en Coolify (proyecto `Monitoreo`, panel `https://panel.elalto.gob.bo`,
API token en `.env` local `COOLIFY_*`) dos servicios Docker Compose:
- `evolution-api-kymbrg8rwfsvvdf7wg5ittxl` — Evolution API v2.3.7 (`evo-api.elalto.gob.bo`, healthy) + postgres:16 + redis:7 (healthy).
- `hermes-agent-agjc2gijkx6v1wsobs3gxlcj` (uuid `ckkfmc55atpcephzjronnudj`, app `oziko3vdsxlt4bspmvreuzxa`) — `nousresearch/hermes-agent:latest`, comando `gateway run`, volumen `hermes-data:/opt/data`, FQDN `hermes-agent.elalto.gob.bo`.

La app del sistema (`nuevo-sis-monitoring`, uuid `gqe0clxgeedygjtnwqzpagpw`, `nexcontrol.elalto.gob.bo`) es una aplicación standalone aparte, no dentro del proyecto Monitoreo.

## Por qué Hermes estaba `running:unhealthy` (3 causas encadenadas)
1. **Crash en loop al arrancar**: `HERMES_DASHBOARD=1` + bind 0.0.0.0 sin proveedor de auth → Hermes se niega a arrancar ("Refusing to bind dashboard to 0.0.0.0"). FIX: crear env `HERMES_DASHBOARD_SESSION_TOKEN=<token 48 hex>` en Coolify y agregarla al compose.
2. **Puerto del template desactualizado**: el compose de Coolify apuntaba Traefik y healthcheck al puerto 8642, pero la imagen actual expone el dashboard en **9119** (`HERMES_DASHBOARD_READY port=9119`). FIX: `SERVICE_FQDN_HERMES_9119` (genera labels Traefik al 9119) + healthcheck a `http://localhost:9119/api/status` (ruta pública del dashboard).
3. **Healthcheck con `wget`**: la imagen Debian trae `curl`, NO `wget` → el healthcheck del template fallaba siempre. FIX: `test: [CMD-SHELL, "curl -fsS http://localhost:9119/api/status || exit 1"]`.

Resultado: `running:healthy`, `/api/status` → 200, `/` → 302 (login). **Telegram conectado en modo polling** con `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USERS=884382309`, `TELEGRAM_HOME_CHANNEL` (vars del servicio en Coolify).

## Estado de la integración Hermes↔Telegram↔Sistema
- Telegram ↔ Hermes: **conectado y funcional** (conector nativo de Hermes; NO usa Evolution API). Evolution API quedó instalada y healthy, útil para WhatsApp (Hermes también tiene puente WhatsApp nativo; Evolution no es necesaria para Telegram).
- Proveedor LLM: **OpenRouter** con la clave del dueño (env `OPENROUTER_API_KEY` del servicio en Coolify + compose patch5). Modelo activo `nvidia/nemotron-3-ultra-550b-a55b:free` (ya venía en config.yaml del volumen). Los warnings "nous requested but Nous Portal not configured" son solo del cliente AUXILIAR (resúmenes), no bloquean el agente principal.
- Nota: `/opt/data/.env` (volumen del dueño) ya contiene `API_SERVER_KEY` y GANA sobre la env del contenedor (aviso stage2 en logs).

## Cómo manipular el servicio Hermes desde la API de Coolify (v4.7.5)
- Logs del sub-servicio: `GET /api/v1/services/{uuid}/logs?sub_service_name=hermes-agent&lines=N` (el query param exacto es `sub_service_name`; los otros devuelven 400 "Sub service name is required").
- Crear env: `POST /api/v1/services/{uuid}/envs` con form-urlencoded `key=...&value=...` (JSON falla por el escaping de PowerShell 5.1).
- Actualizar compose: `PATCH /api/v1/services/{uuid}` con `docker_compose_raw` **en base64** (no YAML plano).
- Reiniciar: `POST /api/v1/services/{uuid}/restart`.
- El panel usa certificado que PowerShell no valida → usar `curl.exe -sk` siempre.

## Credenciales/tokens generados (vivir en Coolify, no en git)
- `HERMES_DASHBOARD_SESSION_TOKEN=54ec20d1461623f557a5cd7b06eef29de026da9a0f94b019` (env del servicio; autoriza Bearer en dashboard/WS).
- `API_SERVER_KEY=3e938ef1...` creada por mí, pero SOMBREADA por la del `.env` del volumen del dueño.

## Plan de integración acordado (pendiente de implementar)
1. MCP server HTTP en NUEVO SIS (`/api/v1/mcp`, auth por Bearer API key de servicio) con tools: servidores/salud, alertas, incidentes (crear con auditoría), resumen de logs, métricas. Hermes lo consume vía `mcp_servers:` en config.yaml con `url` + `Authorization: Bearer ${...}` y `trust` según alcance.
2. Canal TELEGRAM de notificaciones push en NUEVO SIS (nuevo ChannelType) enviando directo a la Bot API con `TELEGRAM_BOT_TOKEN` del servidor → alertas/incidentes empujan al chat `884382309`.
3. Configurar proveedor LLM de Hermes (clave del dueño).

## ✅ INTEGRACIÓN IMPLEMENTADA Y VERIFICADA E2E (2026-11-14)
Decisiones del dueño: OpenRouter como proveedor; **Opción A** (solo consultas + crear incidentes por Telegram); push de **TODAS** las categorías.

Implementación en NUEVO SIS (deploy `36cba30`, commit "feat(integracion)"):
- `ChannelType.TELEGRAM` (schema+validación+`deliverTelegram` Bot API directa, config cifrada AES-256-GCM, summary sin token). Migración `20261113000000` (ALTER TYPE + tabla `service_api_keys`). En producción el Dockerfile corre `prisma db push`, así que la migración es para paridad dev.
- Servidor MCP **estadoless sin dependencias** en `/api/v1/mcp` (`src/core/services/mcp.service.ts` + route): JSON-RPC 2.0, `initialize`/`ping`/`tools/list`/`tools/call`, respuestas JSON directas (sin SSE). 7 tools: 5 de lectura reutilizando `AgentToolsService` + `crear_incidente` (auditada, actor `hermes-telegram`) + `estado_general`. NO expone control de servicios.
- Claves de servicio: modelo `ServiceApiKey` (hash SHA-256, nunca en claro), CRUD `/api/v1/integration-keys` (solo SUPERADMIN; POST devuelve la clave UNA vez). Acciones de auditoría nuevas `API_KEY_CREATED/REVOKED`, `MCP_TOOL_CALL` + grupo en audit-actions.ts.
- Tests: `tests/unit/api/mcp-protocol.test.ts`, `tests/unit/services/telegram-channel.test.ts` (mock de `AuditService.recordEvent` porque no hay BD en unit tests).

Configuración de producción (verificada en vivo):
- Login SUPERADMIN posible: las credenciales vienen de las envs de la app en Coolify (`SUPERADMIN_USER`/`SUPERADMIN_PASSWORD`, admin/9 chars). DNS local a veces no resuelve `nexocontrol` → usar `curl --resolve nexocontrol.elalto.gob.bo:443:172.16.100.22`.
- Dominio real: **nexocontrol**.elalto.gob.bo (con "o"; nexcontrol no existe).
- Clave de servicio creada: `hermes-telegram` (id `f3680bda-579c-4f76-bc2d-a6cf4c50c3fb`, fingerprint SHA256:7a05e761...; la clave en claro se registró en config de Hermes, NO está en git).
- Canal TELEGRAM `telegram-operaciones` (id `af96b468-e0f0-415b-b42e-ab575356100a`, chatId 884382309, categories [] = todas). `POST /channels/{id}` vacío = test de canal.
- MCP registrado en Hermes vía dashboard: `POST/PUT /api/mcp/servers` con `servers: {nexcontrol: {url, headers: {Authorization: Bearer <key>}, ssl_verify: false}}`. **`ssl_verify: false` es NECESARIO**: el cert de elalto.gob.bo usa una CA que el contenedor Python no confía; el `/test` del dashboard falla con `CERTIFICATE_VERIFY_FAILED` sin ese flag. IMPORTANTE: tras añadir/ editar MCP servers hay que **reiniciar el servicio en Coolify**, si no el runtime del gateway sigue con la config vieja e intenta OAuth (fallo visto en cron).
- Pruebas E2E reales hechas con jobs cron one-shot (`POST /api/cron/jobs` con `deliver: "telegram"`, repetir `repeat: 1`, luego DELETE): (1) turno LLM puro OK, (2) turno usando tools MCP `estado_general` + `consultar_inventario` OK con entrega a Telegram sin errores. Auditoría del sistema registra `MCP_TOOL_CALL` actor `mcp:hermes-telegram` e `INCIDENT_CREATED` actor `hermes-telegram`.
- Test de canal: mensaje de prueba entregado a Telegram ("Envío de prueba correcto").
- Verificación pendiente humana: que el dueño escriba al bot por Telegram y responda el agente (los updates entrantes no pueden probarse sin su mensaje).

Recetas Coolify nuevas aprendidas: deploy de la app = `POST /api/v1/deploy` con body JSON `{"uuid": ...}` en archivo (los guiones/trailing del form fallan); deployment status con `GET /api/v1/deployments/{deployment_uuid}`.
