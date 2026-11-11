# Plan — 012 Agente fase 2a

## Decisiones técnicas
1. **Migración única** `20261111000000_agent_fase2`: agrega `rate_limit_per_minute`, `rate_limit_per_day` (Int?, nullable) a `agent_provider_configs` y `tools_enabled` (Boolean, default true) a `agent_profile`.
2. **Guardián en memoria** (`agent-guard.service.ts`): mapa por providerId — ventana deslizante 60 s + contador por día UTC + breaker (CLOSED/OPEN/HALF_OPEN). Válido para single-instance; documentado.
3. **Tools** (`agent-tools.service.ts`): catálogo estático con JSON Schema + `execute(name, args)` que consulta Prisma directamente (read-only) y recorta strings. El executor vive server-side; nunca se serializa hacia el cliente más que el resumen del evento `tool`.
4. **Chat** (`llm-chat.service.ts`): refactor del stream — además de `delta.content`, acumula `delta.tool_calls` por índice (id/name/arguments fragmentados). Al terminar un turno con tool_calls: emite `tool`, ejecuta, agrega `assistant` (con tool_calls) + `role:"tool"` (tool_call_id) y repite (≤4 iteraciones). Solo el contenido final fluye como deltas.
5. **Errores nuevos**: `RateLimitedError` / `CircuitOpenError` → SSE `error` con códigos `RATE_LIMITED` (retry_after_seconds) y `CIRCUIT_OPEN`.
6. **UI**: campos de límites en la card Proveedor; toggle de tools en la card Comportamiento; chips de tool en el Chat. Preserva estilos actuales.

## Orden
1. Schema + migración + `prisma generate` (matar dev servers primero — EPERM).
2. Guardián (rate limit + breaker) + errores.
3. Tools + executor.
4. Refactor chat (loop agéntico) + credenciales con límites.
5. Servicios provider/profile + validaciones Zod.
6. Ruta chat: mapeo de nuevos errores.
7. UI + types.
8. typecheck + build.
9. E2E (puerto 3001): mock local OpenAI-compatible en puerto efímero para el loop de tools; rate limit real; breaker contra endpoint caído; restaurar proveedor OpenRouter real al final.
