# Tasks — 013 Agente fase 2b (KB + historial)

Estado: ✅ completo y verificado en vivo (2026-11-11).

- [x] T1. Schema: `AgentKbEntry` (kind QA|BLOQUE, presupuesto 24000), `AgentConversation`, `AgentMessage` (cascade) + migración `20261112000000_agent_kb_historial` aplicada + generate.
- [x] T2. `agent-kb.service.ts`: presupuesto real (formato exacto del prompt), getEnabledContext, create/update/delete + APIs `/agent/kb` (GET/POST) y `/agent/kb/[id]` (PUT/DELETE) con auditoría AGENT_KB_UPDATED (estructura, no contenido).
- [x] T3. `agent-conversations.service.ts` (tokens estimados chars/4) + APIs `/agent/conversations` (GET paginado), `/agent/conversations/[id]` (GET detalle / DELETE), `/agent/metrics` (GET totales).
- [x] T4. Chat: request `{ message, conversationId? }` — historial desde la BD (cliente ya no manda historial), user message persistido siempre, assistant solo en turno exitoso, `done` con conversationId + tokens { input, output, estimated }.
- [x] T5. Prompt: sección "BASE DE CONOCIMIENTO (FUENTE DE VERDAD)" después de reglas de escalado.
- [x] T6. audit-actions: AGENT_KB_UPDATED, AGENT_CONVERSATION_STARTED + grupo "Agente inteligente".
- [x] T7. UI: KnowledgeCard (tabs QA/Bloques, toggle activa/inactiva, contador X/24000, eliminar), HistoryCard (5 stats, lista paginada, expandible con mensajes, Exportar JSON, eliminar), ChatCard con conversationId + chip "~tk estimado".
- [x] T8. Gates: typecheck EXIT=0 · build ✅ (10 rutas /agent*).
- [x] T9. E2E en vivo (3001):
  - QA entrenada → el agente real respondió el hecho exacto ("22:00 a 06:00, turno B") ✅
  - Presupuesto: entrada que supera 24000 → 400 KB_BUDGET_EXCEEDED con mensaje claro ✅ (23000 chars entró porque 144+23011<24000 — presupuesto legítimo)
  - Conversación persistida: lista (título del primer mensaje, turnos, tokens), detalle (user+assistant, latencia), 2º turno con historial de BD respondió desde el contexto ✅
  - Métricas coherentes (conversations/turns/tokens/avgLatency) ✅
  - OBSERVADOR POST /kb → 403 ✅
  - Limpieza: conversación y entradas de prueba eliminadas; métricas y KB en 0 ✅
- [x] T10. Commit + push a main.

Notas: tokens ESTIMADOS (chars/4) hasta incorporar usage real del proveedor (fase posterior); el cliente ya no envía historial, la BD es la fuente de verdad.
