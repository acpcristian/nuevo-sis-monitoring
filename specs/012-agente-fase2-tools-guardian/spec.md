# Especificación: Agente IA Fase 2a — Tools de dominio + Rate limiting + Circuit breaker

**Feature**: 012 (extensión de 011-agente-inteligente-llm) | **Date**: 2026-11-11 | **Status**: Aprobado (dueño)

---

## Resumen

Dos bloques sobre el MVP del agente:

1. **Tools de dominio (function calling)**: el agente puede consultar datos vivos del sistema
   (inventario, logs, alertas, incidentes) mediante herramientas read-only expuestas al LLM.
   El loop agéntico ejecuta la herramienta, devuelve el resultado al modelo y recién entonces
   responde al usuario. La UI muestra qué herramienta se consultó en cada turno.
2. **Rate limiting + circuit breaker**: límites de peticiones por minuto/día configurables por
   proveedor (429 con Retry-After) y protección ante fallos del proveedor (abrir tras 5 fallos
   consecutivos de red/5xx, medio-abierto a los 30 s, cerrar tras 1 éxito).

## Permisos

- Chat + configuración: SUPERADMIN (igual que 011). OBSERVADOR → 403 + auditoría (ya existente).

## Requisitos Funcionales

### RF-T1: Catálogo de tools de dominio (read-only)
- T5 tools con JSON Schema (formato OpenAI):
  - `consultar_inventario` (filtros opcionales: environment, healthStatus)
  - `detalle_servidor` (nombre parcial o exacto)
  - `consultar_logs` (server opcional, severity opcional, límite ≤ 50)
  - `consultar_alertas` (alertas activas de logs)
  - `consultar_incidentes` (estado opcional; por defecto no cerrados)
- Executor puro read-only: nunca muta datos; recorta strings (≤ 200 chars por mensaje de log) y limita filas.

### RF-T2: Loop agéntico con streaming
- El chat mantiene streaming SSE. Nuevos eventos: `tool` { name, args } cuando el modelo pide una herramienta.
- Máximo 4 iteraciones tool→resultado→modelo por turno (evita loops infinitos).
- Si el modelo no soporta/emite tool_calls: degrada al comportamiento actual (responde con el contexto estático del prompt). Sin error.

### RF-T3: Toggle por perfil
- `agent_profile.tools_enabled` (default true). Desactivado → no se envían tools al proveedor y el prompt no menciona herramientas.

### RF-R1: Rate limiting por proveedor
- Campos en `agent_provider_configs`: `rate_limit_per_minute`, `rate_limit_per_day` (nullable = sin límite).
- Enforcement en el chat: ventana deslizante en memoria por proveedor. Excedido → evento SSE `error` con código `RATE_LIMITED`, mensaje con segundos de reintento; no se llama al proveedor.

### RF-R2: Circuit breaker por proveedor
- En memoria por proveedor: CLOSED → (5 fallos consecutivos de red/timeout/5xx) → OPEN (rechaza sin llamar, `CIRCUIT_OPEN`) → a los 30 s HALF_OPEN (permite 1 intento) → éxito → CLOSED; fallo → OPEN.
- 4xx de configuración (401/404) NO abren el breaker (esperar no los arregla).

## Seguridad
- Tools read-only; sin credenciales de servidor en resultados; strings saneados/recortados.
- Sin secretos en ningún evento SSE ni en errores del breaker/rate limit.
- Auditoría existente cubre cambios de config (AGENT_PROVIDER_UPDATED / AGENT_PROFILE_UPDATED).

## Criterios de éxito
- SC-1: Turno con tool real: SSE muestra evento `tool` y la respuesta final usa el dato devuelto (verificado con mock local del proveedor).
- SC-2: Límite 2/min → 3ª petición recibe RATE_LIMITED con retry_after y no golpea al proveedor.
- SC-3: 5 fallos consecutivos contra endpoint caído → 6ª petición recibe CIRCUIT_OPEN sin intento de red; a los 30 s half-open permite 1 intento.
- SC-4: Con OpenRouter real el chat sigue funcionando (con o sin tools) y degrada sin colgarse.
- SC-5: typecheck + build ✅.
