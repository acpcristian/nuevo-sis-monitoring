# Tasks — 012 Agente fase 2a (tools + guardián)

Estado: ✅ completo y verificado en vivo (2026-11-11).

- [x] T1. Schema Prisma: `rateLimitPerMinute`/`rateLimitPerDay` (nullable) en AgentProviderConfig, `toolsEnabled` (default true) en AgentProfile + migración `20261111000000_agent_fase2` aplicada + `prisma generate`.
- [x] T2. `agent-guard.service.ts`: ventana deslizante por minuto, cuota diaria UTC, circuit breaker (5 fallos → OPEN 30 s → HALF_OPEN → CLOSED) + errores `RateLimitedError`/`CircuitOpenError`. Reset al reconfigurar el proveedor.
- [x] T3. `agent-tools.service.ts`: 5 tools read-only (`consultar_inventario`, `detalle_servidor`, `consultar_logs`, `consultar_alertas`, `consultar_incidentes`) con JSON Schema + executor con recorte de strings. Formato wire OpenAI: `{ type:"function", function:{...} }` (getToolDefinitions) + getToolSummaries para el prompt.
- [x] T4. `llm-chat.service.ts`: streaming con tool_calls (acumulación por índice), loop agéntico ≤ 4 rondas, evento `tool`, registro de éxito/fallo en el guardián. Fix verificado: `onDelta` cableado en TODAS las llamadas del loop.
- [x] T5. `agent-provider.service.ts`: límites persistidos/devueltos; credenciales incluyen providerId + límites.
- [x] T6. `agent-profile.service.ts`: `toolsEnabled` + sección "HERRAMIENTAS DE DOMINIO" en el prompt cuando activo.
- [x] T7. `agent.schema.ts`: `rateLimitPerMinute`/`rateLimitPerDay` (nullable) + `toolsEnabled`.
- [x] T8. Ruta `/api/v1/agent/chat`: eventos `tool`, `done.tools`, y errores `RATE_LIMITED`/`CIRCUIT_OPEN` con `retry_after_seconds`.
- [x] T9. UI: campos del guardián en card Proveedor, toggle "Tools de dominio" en card Comportamiento, chips 🛠 de tool en el chat.
- [x] T10. Gates: typecheck EXIT=0 · build ✅.
- [x] T11. E2E en 3001 (verificado en vivo):
  - (a) Loop de tools con mock local OpenAI-compatible: evento `tool` + respuesta citando el dato del tool result (total=0 real) ✅; deltas visibles tras fix ✅.
  - (b) Rate limit 2/min → 1ª y 2ª OK, 3ª `RATE_LIMITED` retry_after=60 sin llamar al proveedor ✅.
  - (c) Breaker contra URL caída: 5 fallos (error tolerado, sin colgarse) → 6ª `CIRCUIT_OPEN` sin red; tras 30 s half-open permite el intento (falla con error real, no CIRCUIT_OPEN) ✅.
  - (d) Toggle `toolsEnabled=false` → 0 tool events, respuesta directa ✅; reactivado ✅.
  - (e) OpenRouter real + Nemotron free: invocó `consultar_inventario()` real, respondió "0 servidores" con el dato vivo, 37 deltas, done con tools ✅.
- [x] T12. Commit + push a main.

## Gotchas de la verificación (no repetir)
- El PUT de prueba con `apiToken` **sobrescribe** la clave cifrada del proveedor activo (diseño de rotación): para E2E de config usar proveedor desechable o restaurar la clave al final. (Ocurrió: la clave real se pisó con la del mock y se restauró manualmente.)
- Las `tools` del request DEBEN ir wrapped en `{ type:"function", function:{...} }` — formato plano da 400 "missing field".
- Omitir `rateLimitPerMinute` en el PUT conserva el límite anterior (rotación opt-in igual que la clave).
