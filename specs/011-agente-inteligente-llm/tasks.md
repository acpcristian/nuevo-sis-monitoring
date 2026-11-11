# Tasks — 011 Agente Inteligente LLM (MVP)

Estado: ✅ MVP completo y verificado en vivo (2026-11-11).

## Fase A — Datos y dominio
- [x] T1. Migración Prisma `20261110000000_agent_llm` aplicada (agent_provider_configs + agent_profile singleton). Fix: `authTag` requería `@map("auth_tag")`.
- [x] T2. `src/core/domain/llm-providers.ts` (7 presets con catálogo real 2026 de OpenRouter: capa free rotada, modelo por defecto `nvidia/nemotron-3.5-super-vl:free`) + `src/shared/validations/agent.schema.ts`.

## Fase B — Servicios
- [x] T3. `agent-provider.service.ts`: cifrado SecretVault, un solo activo, testConnection (max_tokens 200 por modelos de reasoning), clave nunca expuesta.
- [x] T4. `agent-profile.service.ts`: perfil + assembleSystemPrompt con {{hora}}/{{fecha}}/{{dia}} + inventario real.
- [x] T5. `llm-chat.service.ts`: streaming SSE, timeout 60s, errores tolerados.

## Fase C — API
- [x] T6. `/api/v1/agent/provider` (GET/PUT) + `/provider/test` (POST).
- [x] T7. `/api/v1/agent/profile` (GET/PUT) + `/api/v1/agent/chat` (POST SSE delta/done/error).
- [x] T8. Auditoría AGENT_PROVIDER_UPDATED/TESTED, AGENT_PROFILE_UPDATED (sanitizeDiff redacta hasApiKey), 403+audit para OBSERVADOR.

## Fase D — UI
- [x] T9. Página `/agent` (AgentPageClient): Proveedor, Comportamiento, Chat de prueba con streaming. Select de modelo con opción "Escribir otro modelo…" (la capa free rota).
- [x] T10. Nav Sidebar "Agente IA" (Operaciones) + breadcrumb DashboardShell.

## Fase E — Verificación (DoD)
- [x] T11. typecheck ✅ · build ✅ (/agent + 4 rutas API). Lint no configurado en repo (next lint interactivo).
- [x] T12. E2E en vivo (3001):
  - Chat sin proveedor → evento error NO_PROVIDER ✅
  - Test clave inválida OpenRouter → 401 amigable (321ms) ✅
  - Test URL imposible → error sin colgarse ✅
  - OBSERVADOR → 403 ✅
  - Proveedor real con clave del dueño → test OK (605ms), chat streaming 41 deltas (firstToken 2.0s), 2.7s total ✅
  - Segundo turno con historial → recuerda la recomendación ✅
  - Clave en BD cifrada (AES-256-GCM, IV propio, fingerprint SHA256) ✅
  - Auditoría append-only sin secretos ✅
- [x] T13. Pendiente de verificación humana: aspecto visual de la UI en el navegador.

## Notas del proveedor (2026-11-11)
- OpenRouter free: catálogo rotado. Llama 3.3 70B free ya NO existe (404). Gemma-4 free con 429 upstream intermitente. Nemotron 3.5 Super free funcionó.
- Modelos de reasoning (nemotron) consumen tokens antes del contenido: test usa max_tokens 200; chat recomienda maxOutputTokens >= 4096.
