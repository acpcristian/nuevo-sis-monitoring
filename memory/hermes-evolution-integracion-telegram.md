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
- Pendiente bloqueante: **proveedor LLM de Hermes** — los logs avisan `nous requested but Nous Portal not configured` (auxiliar); el agente necesita `OPENROUTER_API_KEY`/`ANTHROPIC_API_KEY`/etc. o login Nous Portal. Se puede inyectar por env del compose o `/opt/data/.env` (el .env del volumen GANA sobre el env del contenedor, con override=True).
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
