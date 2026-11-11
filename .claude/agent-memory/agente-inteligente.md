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
Knowledge Base (QA+bloques), historial de conversaciones persistido con métricas de tokens/costo, rate limiting, circuit breaker, Anthropic directo, media con reglas, tools de dominio (inventario/logs via function calling).
