# Plan MVP — Agente Inteligente LLM (feature 011)

**Fecha**: 2026-11-10 | **Estado**: En ejecución (MVP) | **Alcance decidido por el dueño**: MVP primero, proveedor OpenRouter por defecto, loop autónomo.

---

## Alcance del MVP (aprobado)

Implementar el núcleo de la sección "Agente" del CRM de referencia (crm-atencion.sys.toi.bo, revisado exhaustivamente el 2026-11-10) adaptado a NUEVO SIS (monitoreo de servidores):

1. **Proveedor de IA** — configuración con test de conexión y clave cifrada.
2. **Comportamiento del agente** — perfil entrenable: nombre, tono, instrucciones con variables dinámicas, reglas de escalado, saludo.
3. **Chat de prueba** — streaming SSE contra el proveedor activo, con prompt ensamblado del perfil.

### Fuera de este MVP (fases siguientes del spec 011)
- Knowledge Base (QA + bloques + límite de contexto con warning).
- Historial de conversaciones persistido, métricas de tokens/costo, rate limiting, circuit breaker.
- Media con regla de entrega, tools/function calling de dominio (inventario, logs).
- Catálogo de modelos sincronizado desde el proveedor (MVP usa presets curados).

## Decisiones de diseño

| # | Decisión | Justificación |
|---|----------|---------------|
| D1 | Proveedor = registro con `isActive` único; chat usa el activo | Permite varios proveedores configurados sin UI compleja; compatible con el CRM (un config activo) |
| D2 | Solo proveedores OpenAI-compatible en MVP (OpenRouter, OpenAI, DeepSeek, Groq, Ollama, Custom). Anthropic directo = fase siguiente | El MVP apunta a OpenRouter (gratuito, multi-modelo); chat-completions unificado |
| D3 | Perfil singleton (una fila, seed en migración) | Replica el modelo del CRM (perfil único entrenable); roles múltiples = fase siguiente |
| D4 | Clave API con SecretVault AES-256-GCM existente + `keyFingerprint` | Principio III; nunca se devuelve al cliente (solo fingerprint/last4) |
| D5 | Chat no persiste conversaciones en MVP (efímero, en memoria del cliente); auditoría solo de configuración | Alcance MVP; historial+métricas ya están en el spec para fase 2 |
| D6 | Variables dinámicas `{{hora}}`, `{{fecha}}`, `{{dia}}` resueltas server-side en cada turno; `{{inventario}}` opcional inserta resumen de servidores/servicios | Patrón del CRM (`{{hora}}/{{dia}}/{{fecha}}`) + dominio propio de monitoreo |
| D7 | Todos los endpoints solo SUPERADMIN (OBSERVADOR → 403 + auditoría) | Principio IV y spec 011 |
| D8 | Streaming con `ReadableStream` (SSE) desde Route Handler; timeout 60 s; errores del proveedor como eventos `error` en el stream (nunca tumban el turno) | Spec 011 + regla operativa de LLM del CLAUDE.md |
| D9 | Auditoría: `AGENT_PROVIDER_UPDATED`, `AGENT_PROVIDER_TESTED`, `AGENT_PROFILE_UPDATED` en `inventory_audit_logs` (append-only) | Principio VI |
| D10 | UI en `/agent`, ítem de nav bajo "Operaciones" con icono Bot | Estructura existente del dashboard |

## Modelo de datos (migración `20261110000000_agent_llm`)

```prisma
model AgentProviderConfig {
  id             String    @id @default(uuid())
  providerType   String    // OPENROUTER | OPENAI | ANTHROPIC | DEEPSEEK | GROQ | OLLAMA_LOCAL | CUSTOM
  name           String
  baseUrl        String
  model          String
  temperature    Float     @default(0.4)
  maxOutputTokens Int      @default(2048)
  encryptedPayload String? // null si el proveedor no requiere clave (Ollama)
  iv             String?
  authTag        String?
  keyFingerprint String?
  isActive       Boolean   @default(false)
  lastTestAt     DateTime?
  lastTestStatus String?
  lastTestLatencyMs Int?
  createdAt/updatedAt
  @@map("agent_provider_configs")
}

model AgentProfile {
  id          String   @id @default(uuid())
  enabled     Boolean  @default(false)
  name        String   @default("Agente de Operaciones")
  tone        String?  @db.Text
  instructions String? @db.Text
  escalationRules String? @db.Text @map("escalation_rules")
  greeting    String?  @db.Text
  updatedAt   DateTime @updatedAt
  @@map("agent_profile")
}
```

## API (todas SUPERADMIN)

| Endpoint | Función |
|----------|---------|
| `GET /api/v1/agent/provider` | Activo + lista (sin claves: fingerprint/last4, baseUrl, model) |
| `PUT /api/v1/agent/provider` | Crea/actualiza activo; cifra clave si viene; valida conectividad opcional |
| `POST /api/v1/agent/provider/test` | Test de conexión `{baseUrl, model, token?}` → `{ok, message, latencyMs}` |
| `GET /api/v1/agent/profile` | Perfil actual |
| `PUT /api/v1/agent/profile` | Actualiza comportamiento |
| `POST /api/v1/agent/chat` | Chat streaming SSE: `{message, history[]}` → eventos `delta`/`done`/`error` |

## Prompts

- System prompt = nombre + tono + instrucciones + reglas de escalado (escalado → "sugerir crear incidente / notificar"), con variables resueltas.
- Chat de prueba hace propio el rol "Asistente de Operaciones": responde sobre diagnóstico de logs/servidores con la info que se le pase en el mensaje (MVP sin tools).

## Verificación en vivo (DoD Reforzada)

1. typecheck + lint + build.
2. Dev server 3001: guardar proveedor OpenRouter con clave real → test de conexión con latencia.
3. Guardar perfil de comportamiento → chat de prueba con streaming real (respuesta coherente con instrucciones).
4. Caminos infelices: clave inválida (error claro sin colgarse), proveedor no configurado (409 amigable), token vacío, timeout.
5. OBSERVADOR → 403 + registro de auditoría.
6. UI visual → pendiente verificación humana (estilo).
