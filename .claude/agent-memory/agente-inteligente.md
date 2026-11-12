---
type: project
---

# Feature 011 — Agente Inteligente LLM (MVP completado)

**2026-11-11** — MVP de la sección "Agente" (inspirada en el CRM de WhatsApp del dueño, crm-atencion.sys.toi.bo, revisado vía better-auth + chunks JS).

## Qué quedó
- `/agent` (nav "Agente IA" en Operaciones): Proveedor de IA + Comportamiento + Chat de prueba con streaming.
- Tablas `agent_provider_configs` (un activo por índice parcial) y `agent_profile` singleton; migración `20261110000000_agent_llm`.
- APIs `/api/v1/agent/provider|provider/test|profile|chat` — SUPERADMIN only (OBSERVADOR 403+audit), auditoría `AGENT_*` en audit-actions.
- Clave API cifrada con SecretVault (AES-256-GCM); en UI solo "Cambiar clave (··last4)".
- Prompt ensamblado con {{hora}}/{{fecha}}/{{dia}} + resumen real del inventario; regla: no inventar datos fuera del contexto.

## Gotchas aprendidos (no repetir)
- `authTag` en Prisma necesita `@map("auth_tag")` — sin map el client busca columna camelCase y lanza P2022 con mensaje engañoso ("column `existe` does not exist").
- OpenRouter free rota: Llama 3.3 70B free desapareció (404); Gemma-4 free con 429 upstream intermitente. El select de la UI permite escribir cualquier slug.
- Modelos de reasoning (nemotron) queman tokens en reasoning: test de conexión usa max_tokens 200 y acepta `content || reasoning`; chat recomienda maxOutputTokens 4096.
- La capa free de OpenRouter comparte pool upstream: 429 temporales son normales, no errores de config.
- `prisma generate` falla con EPERM mientras el dev server corre (bloquea query_engine.dll): matar primero el proceso del puerto.
- La clave del dueño está configurada y activa (fingerprint SHA256:6453...c273d2ea); no volver a pedirla.

## Pendiente (fase 2 del spec)
Knowledge Base (QA+bloques), historial de conversaciones persistido con métricas de tokens/costo, Anthropic directo, media con reglas. ~~Rate limiting, circuit breaker, tools de dominio~~ → hecho en 012.

## Feature 012 — Fase 2a (2026-11-11): Tools de dominio + Rate limiting + Circuit breaker
- `agent-tools.service.ts`: 5 tools read-only (inventario/detalle servidor/logs/alertas/incidentes) con JSON Schema; formato wire `{ type:"function", function:{...} }` — NUNCA plano o el proveedor responde 400 "missing field".
- `agent-guard.service.ts`: rate limit (ventana deslizante 60s + cuota diaria UTC) y circuit breaker (5 fallos de red/5xx → OPEN 30s → HALF_OPEN) EN MEMORIA por providerId; reset al reconfigurar el proveedor. 4xx de config no abren el breaker.
- `llm-chat.service.ts`: loop agéntico ≤ 4 rondas tool→resultado→modelo; streaming con `delta.tool_calls` acumulados por índice; SSE nuevo: `tool` (resumen) y `done.tools`. FIX importante: onDelta debe cablearse en CADA llamada del loop (primera iteración no bastaba).
- `agent_profile.tools_enabled` (default true) + `agent_provider_configs.rate_limit_per_minute|day` (nullable = sin límite); migración `20261111000000_agent_fase2`.
- Verificado E2E con mock OpenAI local (tool loop), rate limit (3ª petición → RATE_LIMITED retry_after 60s), breaker (URL caída → 5 fallos → CIRCUIT_OPEN → half-open a los 30s) y OpenRouter real (Nemotron invocó consultar_inventario y respondió con el dato vivo).
- GOTCHA GRAVE: el PUT de prueba con `apiToken` PISA la clave cifrada del proveedor activo (diseño de rotación). Para E2E de config, restaurar la clave al final o usar proveedor desechable con fila aparte.
- Omitir `rateLimitPerMinute`/`rateLimitPerDay` en el PUT conserva el valor anterior (rotación opt-in como la clave).

## Feature 013 — Fase 2b (2026-11-11): Knowledge Base + historial con métricas
- `agent-kb.service.ts`: presupuesto de 24000 chars sobre el FORMATO EXACTO del prompt (QA: `P:/R:`, bloque: `## título\ncontenido`, +2 por separador) — un contenido ≤24000 puede igualmente exceder el presupuesto total; validación en create/update/toggle, error `KB_BUDGET_EXCEEDED`.
- `getEnabledContext()` inyectado en `assembleSystemPrompt` como sección "BASE DE CONOCIMIENTO (FUENTE DE VERDAD)" después de reglas de escalado — verificado con modelo real: respondió el hecho entrenado exacto.
- `agent-conversations.service.ts`: conversaciones persistidas; tokens ESTIMADOS chars/4 (`estimateTokens`); user message persistido SIEMPRE, assistant solo en turno exitoso; `loadHistory` últimos 20 de la BD (el cliente ya NO envía historial).
- Chat request `{ message, conversationId? }`: si conversationId no existe → se crea conversación nueva (título = 60 chars del primer mensaje, audit AGENT_CONVERSATION_STARTED). `done` incluye conversationId + tokens { input, output, estimated }. `ChatTurnResult.promptChars` = chars del prompt inicial (para estimar tokens de entrada).
- APIs nuevas: `/agent/kb` (GET/POST), `/agent/kb/[id]` (PUT/DELETE), `/agent/conversations` (GET), `/agent/conversations/[id]` (GET/DELETE), `/agent/metrics` (GET). Audit: AGENT_KB_UPDATED (estructura/tamaños, no contenido), AGENT_CONVERSATION_STARTED.
- UI: KnowledgeCard (tabs QA/Bloques, toggle, contador X/24000) + HistoryCard (5 stats, paginado, expandible, Exportar JSON, eliminar) + ChatCard con conversationId y chip "~tk".
- Zod max(24000) en content rechaza ANTES del presupuesto del servicio: para probar KB_BUDGET_EXCEEDED usar contenido que pase Zod pero exceda el total (p.ej. 23900 con otras entradas activas).
- Pendiente fase 2 restante (pedido explícito): Anthropic directo, media con reglas (requiere R2), usage REAL de tokens del proveedor (hoy estimado chars/4), pricing por modelo.

## Proveedor FreeLLM API (2026-11-11)
- Agregado preset `FREELLMAPI` (pedido del dueño): router auto-alojado OpenAI-compatible (https://github.com/tashfeenahmed/freellmapi), 635 endpoints gratis, puerto default 3001 → baseUrl `http://127.0.0.1:3001/v1`, clave unificada `freellmapi-...` del dashboard.
- Modelos virtuales `auto` (el router elige) y `fusion` (síntesis multi-modelo con juez); cualquier id del catálogo (freellmapi.co/models) se escribe manualmente en el select.
- Solo tocó `llm-providers.ts` (union + preset + detect por "freellmapi" o `:3001/v1`) y `LLM_PROVIDER_TYPES` en agent.schema.ts — la capa backend/chat/tools es genérica OpenAI-compatible y no necesita cambios.
- Verificado E2E con mock local del router en :3001: `/agent/provider/test` OK (12ms) con clave válida y 401 amigable con clave mala. NO se tocó el proveedor activo (el endpoint de test es stateless).
- **Desplegado en producción (2026-11-11)**: Coolify app `freellmapi` uuid `5bxvz0iadtv2vfh7xwqkml5j` (proyecto "Monitoreo", red coolify), imagen `ghcr.io/tashfeenahmed/freellmapi:latest`, puerto host 3001, volumen `freellmapi-data:/app/server/data` vía `custom_docker_run_options` (el endpoint /storages solo acepta type=file en esta versión), ENCRYPTION_KEY + admin declarativo en `FREEAPI_CONFIG_JSON` (envs individuales vía POST /envs — el create no acepta envs ni ports_mapping; el campo de puertos es `ports_mappings` plural y el PATCH sí lo acepta). Estado `running:healthy`; /api/ping 200; /v1/models 401 sin clave.
- Dashboard: http://172.16.100.22:3001 — admin `admin@nexocontrol.local` (contraseña entregada en chat, NO guardarla aquí). Pendiente del dueño: cambiar contraseña, agregar claves de proveedores en el dashboard y configurar el agente SIS con baseUrl `http://172.16.100.22:3001/v1` + modelo `auto` + clave unificada.
