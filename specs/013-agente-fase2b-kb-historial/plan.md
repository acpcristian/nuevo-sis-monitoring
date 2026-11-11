# Plan — 013 Agente fase 2b

## Decisiones
1. **Migración** `20261112000000_agent_kb_historial`: tablas `agent_kb_entries`, `agent_conversations`, `agent_messages` (cascade delete).
2. **Tokens estimados**: chars/4 (input = mensajes del prompt, output = respuesta), marcados "estimado" en UI. `ChatTurnResult` gana `promptChars`.
3. **Chat**: request `{ message, conversationId? }` — historial viene de la BD cuando hay conversationId (el cliente ya no manda historial); `done` incluye `conversationId` y tokens.
4. **KB**: servicio con `getEnabledContext()` (string ≤ 24000) inyectado por `assembleSystemPrompt`; validación de presupuesto en create/update/toggle.
5. **UI**: dos cards nuevas en `/agent` — "Base de Conocimiento" (tabs QA/Bloques, toggle, contador X/24000) y "Historial y métricas" (stats + lista paginada + expandible + exportar JSON + eliminar). ChatCard usa conversationId.
6. Auditoría: `AGENT_KB_UPDATED`, `AGENT_CONVERSATION_STARTED` en audit-actions + grupo Agente.

## Orden
1. Schema + migración + generate.
2. `agent-kb.service.ts` + validaciones + APIs `/agent/kb` (y `[id]`).
3. `agent-conversations.service.ts` + APIs `/agent/conversations`, `/[id]`, `/agent/metrics`.
4. Chat: schema (conversationId), route persiste turnos, `ChatTurnResult.promptChars`.
5. Prompt: sección KB en `assembleSystemPrompt`.
6. audit-actions.
7. UI: KBCard + HistoryCard + ChatCard conversationId + types.
8. typecheck + build.
9. E2E (3001): KB QA entrenada → respuesta cita el hecho; presupuesto 24000 → 400; conversación persistida → historial + detalle + export; métricas coherentes; OBSERVADOR 403; limpieza de datos de prueba.
