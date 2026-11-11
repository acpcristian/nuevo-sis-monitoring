# Especificación: Agente IA Fase 2b — Knowledge Base + Historial y métricas

**Feature**: 013 (extensión de 011/012) | **Date**: 2026-11-11 | **Status**: Aprobado (dueño)

---

## Resumen

Dos bloques que completan la fase 2 del agente:

1. **Knowledge Base (entrenamiento documental)**: pares Pregunta→Respuesta (QA) y Bloques de
   conocimiento libre que el operador administra y que se inyectan al prompt del agente como
   fuente de verdad del negocio. Presupuesto de contexto: 24000 caracteres en total.
2. **Historial de conversaciones + métricas**: cada turno del chat de prueba se persiste
   (mensajes, latencia, tokens estimados); vista de historial paginada con expandible,
   exportación JSON por conversación y resumen de métricas de uso.

## Permisos

- Todo SUPERADMIN-only (igual que 011/012). OBSERVADOR → 403 + auditoría.

## Requisitos Funcionales

### RF-K1: Entradas de Knowledge Base
- Tipos: `QA` (pregunta + respuesta) y `BLOQUE` (título + contenido).
- CRUD completo + toggle habilitado/deshabilitado por entrada.
- Presupuesto total del contexto inyectado: **24000 chars** (suma de entradas habilitadas).
  Crear/habilitar más allá del presupuesto → 400 con mensaje claro (como el CRM de referencia).
- Orden por posición (crear = última posición).

### RF-K2: Inyección al prompt
- Sección `# BASE DE CONOCIMIENTO (entrenamiento del operador)` en el prompt de sistema con
  las entradas habilitadas (QA como `P:/R:`, bloques como título+contenido).
- Instrucción: es fuente de verdad del negocio; si no está ni en la KB ni en el contexto, decirlo.

### RF-H1: Persistencia de conversaciones
- `agent_conversations`: título (60 chars del primer mensaje), usuario, inicio, último mensaje,
  turnCount, tokens estimados entrada/salida.
- `agent_messages`: role, contenido, tokens estimados in/out, latencia ms, herramientas usadas.
- El chat envía/crea `conversationId`: si viene, el historial se carga de la BD (fuente de
  verdad, últimos 20 mensajes); si no, se crea conversación nueva (auditoría
  `AGENT_CONVERSATION_STARTED`). El cliente ya NO envía historial.
- Solo turnos exitosos agregan mensaje del assistant; el user se persiste siempre.

### RF-H2: Vista historial + métricas
- `GET /api/v1/agent/metrics`: totales (conversaciones, turnos, tokens est. in/out, latencia media).
- `GET /api/v1/agent/conversations?page=`: paginado (10) con título, fecha, turnos, tokens.
- `GET /api/v1/agent/conversations/[id]`: mensajes completos → usados para expandir y exportar JSON.
- `DELETE /api/v1/agent/conversations/[id]`: borra conversación + mensajes.
- Tokens: ESTIMADOS (chars/4), etiquetados como estimados en la UI (el pricing por modelo viene en fase posterior).

## Seguridad
- KB nunca inyecta nada del lado cliente: todo server-side en el prompt.
- Auditoría `AGENT_KB_UPDATED` (estructura/tamaños, no contenido completo) y `AGENT_CONVERSATION_STARTED`.
- Sin secretos en ningún endpoint nuevo.

## Criterios de éxito
- SC-1: Entrada QA habilitada → el agente responde el hecho entrenado (verificado en vivo).
- SC-2: Presupuesto 24000 chars → excederlo devuelve 400 con mensaje claro.
- SC-3: Turno de chat → conversación visible en historial con mensajes, tokens y latencia; expandible y exportable JSON.
- SC-4: Métricas totales coherentes con lo persistido.
- SC-5: OBSERVADOR → 403 en mutaciones de KB y conversaciones.
- SC-6: typecheck + build ✅.
