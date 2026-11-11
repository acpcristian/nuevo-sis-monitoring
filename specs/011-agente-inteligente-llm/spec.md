# Especificación: Agente Inteligente LLM

**Branch**: `011-agente-inteligente-llm` | **Date**: 2026-11-10 | **Status**: Borrador

---

## Resumen Ejecutivo

Implementar una sección de configuración de **Agente Inteligente** que permita a los SUPERADMIN gestionar proveedores LLM gratuitos (OpenRouter, Groq, Together AI, Hugging Face, Ollama local, etc.), definir prompts de sistema, configurar roles de agente especializados (diagnóstico de logs, análisis de incidentes, asistente de automatización, resumidor), mantener historial de conversaciones con auditoría, medir uso y costos, y probar el agente mediante una interfaz de chat integrada. Todo con almacenamiento cifrado de claves API (AES-256-GCM), validación de permisos en backend, auditoría append-only y arquitectura read-only por defecto.

---

## Actores y Permisos

| Actor | Descripción | Permisos en esta feature |
|-------|-------------|--------------------------|
| **SUPERADMIN** | Administrador de la plataforma | CRUD completo: proveedores, modelos, prompts, roles, historial, métricas, chat de prueba |
| **OBSERVADOR** | Operador de solo lectura | **Sin acceso** a esta sección (requiere SUPERADMIN) |

> **Regla constitucional (Principio IV)**: El backend **MUST** rechazar con `403 Forbidden` cualquier petición de mutación (POST/PUT/PATCH/DELETE) proveniente de un usuario con rol OBSERVADOR y generar evento de auditoría.

---

## Escenarios de Usuario

### ESC-001: Configurar un proveedor LLM gratuito
**Dado** que soy SUPERADMIN y accedo a `/settings/agent`
**Cuando** agrego un nuevo proveedor (ej. OpenRouter) con su API key y selecciono modelo
**Entonces** la clave se cifra en reposo (AES-256-GCM), se valida conectividad básica, y queda registrado en auditoría como `AGENT_PROVIDER_CREATED`

### ESC-002: Definir roles de agente especializados
**Dado** que tengo al menos un proveedor configurado
**Cuando** creo un rol "Analista de Logs" con prompt de sistema específico, temperatura 0.2, max tokens 4000
**Entonces** el rol queda disponible para selección en el chat de prueba y para uso futuro en automatizaciones

### ESC-003: Probar el agente en chat integrado
**Dado** que tengo un proveedor y un rol configurados
**Cuando** abro la pestaña "Chat de prueba", selecciono proveedor+rol, y envío un mensaje
**Entonces** recibo respuesta streaming del LLM, la conversación se persiste en historial con auditoría `AGENT_CHAT_MESSAGE`, y se contabilizan tokens/costo

### ESC-004: Ver historial y métricas de uso
**Dado** que he usado el chat de prueba
**Cuando** accedo a la pestaña "Historial y Métricas"
**Entonces** veo lista paginada de conversaciones, filtros por proveedor/rol/fecha, totales de tokens entrada/salida, costo estimado, y latencia media

### ESC-005: Rotar o revocar clave API
**Dado** que un proveedor tiene una clave configurada
**Cuando** actualizo la clave o la elimino
**Entonces** la nueva clave se cifra, la antigua se purga de memoria, y se audita `AGENT_PROVIDER_UPDATED` / `AGENT_PROVIDER_DELETED`

### ESC-006: Configurar rate limiting por proveedor
**Dado** que un proveedor tiene límites conocidos (ej. OpenRouter: 20 req/min gratis)
**Cuando** establezco `max_requests_per_minute` y `max_tokens_per_minute`
**Entonces** el backend rechaza peticiones que excedan el límite con `429 Too Many Requests` y mensaje informativo

---

## Requisitos Funcionales

### RF-001: Gestión de Proveedores LLM
- **RF-001.1**: CRUD de proveedores (nombre, tipo, endpoint base, API key cifrada, estado activo/inactivo)
- **RF-001.2**: Tipos de proveedor soportados: `OPENROUTER`, `GROQ`, `TOGETHER_AI`, `HUGGINGFACE`, `OLLAMA_LOCAL`, `OPENAI_COMPATIBLE`, `ANTHROPIC_DIRECT`, `CUSTOM`
- **RF-001.3**: Para `OLLAMA_LOCAL`: endpoint local (ej. `http://localhost:11434`), sin API key requerida
- **RF-001.4**: Para `CUSTOM`: endpoint base + headers personalizados (JSON) + formato de request/response configurable
- **RF-001.5**: Validación de conectividad al crear/actualizar (health check ligero: listar modelos o ping)
- **RF-001.6**: API key **NUNCA** se devuelve en GET; solo se permite sobrescribir (Principio III)

### RF-002: Catálogo de Modelos por Proveedor
- **RF-002.1**: Sincronización de modelos disponibles desde el proveedor (endpoint `/models` o equivalente)
- **RF-002.2**: Selección de modelo por defecto por proveedor
- **RF-002.3**: Metadatos por modelo: contexto máximo (tokens), costo por 1K tokens (input/output), capacidades (tools, vision, json_mode)
- **RF-002.4**: Filtrado de modelos gratuitos vs. de pago (etiqueta `free: true/false`)

### RF-003: Roles de Agente (Agent Roles)
- **RF-003.1**: CRUD de roles: nombre único, descripción, prompt de sistema (system prompt), temperatura (0.0–2.0), max tokens salida, top-p, frequency/presence penalty
- **RF-003.2**: Plantillas de prompt predefinidas por caso de uso:
  - `DIAGNOSIS_ASSISTANT`: "Eres un experto en diagnóstico de infraestructura..."
  - `LOG_ANALYZER`: "Analiza los siguientes logs y extrae patrones, errores, correlaciones..."
  - `INCIDENT_SUMMARIZER`: "Resume el siguiente incidente para reporte ejecutivo..."
  - `AUTOMATION_HELPER`: "Genera pasos de playbook seguros para..."
  - `CUSTOM`: prompt libre
- **RF-003.3**: Configuración de herramientas (tools/function calling) por rol: lista de funciones habilitadas con esquemas JSON Schema
- **RF-003.4**: Asociación rol → proveedor+modelo preferido (override opcional)

### RF-004: Chat de Prueba (Playground)
- **RF-004.1**: Interfaz tipo chat con streaming de respuesta (Server-Sent Events o ReadableStream)
- **RF-004.2**: Selector de proveedor + modelo + rol al iniciar conversación
- **RF-004.3**: Contexto de conversación: historial completo de la sesión actual (ventana configurable, ej. últimos 20 mensajes)
- **RF-004.4**: Indicadores en vivo: tokens usados (entrada/salida), latencia, costo estimado
- **RF-004.5**: Botones: "Nueva conversación", "Copiar respuesta", "Regenerar", "Exportar conversación (JSON/Markdown)"
- **RF-004.6**: Manejo de errores: timeout (30s), rate limit (429), modelo no disponible, clave inválida → mensaje amigable + botón reintentar

### RF-005: Historial de Conversaciones y Auditoría
- **RF-005.1**: Persistencia de cada mensaje: role (user/assistant/system), contenido, tokens, proveedor, modelo, rol de agente, latencia ms, timestamp
- **RF-005.2**: Agrupación por `conversation_id` (UUID)
- **RF-005.3**: Auditoría append-only: `AGENT_CHAT_MESSAGE` (cada mensaje), `AGENT_CONVERSATION_STARTED`, `AGENT_CONVERSATION_ENDED`
- **RF-005.4**: Filtros: rango de fechas, proveedor, modelo, rol de agente, usuario
- **RF-005.5**: Exportación: CSV/JSON de conversación completa o rango filtrado

### RF-006: Métricas de Uso y Costos
- **RF-006.1**: Agregados por proveedor/modelo/rol: total requests, tokens entrada, tokens salida, costo estimado USD, latencia p50/p95, errores
- **RF-006.2**: Serie temporal: requests/día, tokens/día, costo/día (últimos 30 días)
- **RF-006.3**: Top conversaciones por costo/tokens
- **RF-006.4**: Alertas de umbral: notificar (canal configurado) si costo diario > $X o tokens > Y

### RF-007: Rate Limiting y Cuotas
- **RF-007.1**: Configuración por proveedor: `max_requests_per_minute`, `max_tokens_per_minute`, `max_concurrent_requests`
- **RF-007.2**: Enforcement en backend (middleware o service guard) antes de llamar al proveedor
- **RF-007.3**: Respuesta `429` con `Retry-After` header y cuerpo JSON: `{ "error": "RATE_LIMITED", "retry_after_seconds": 30, "limit": 20, "window": "minute" }`
- **RF-007.4**: Cuota diaria opcional por proveedor (reset medianoche UTC)

### RF-008: Seguridad y Cumplimiento (Constitución)
- **RF-008.1**: API keys cifradas en reposo con AES-256-GCM (SecretVault existente), IV único por registro
- **RF-008.2**: Validación de rol SUPERADMIN en **cada** endpoint de mutación (Principio IV)
- **RF-008.3**: Auditoría append-only de todas las operaciones CRUD + chat (Principio VI)
- **RF-008.4**: Sanitización de contenido de logs/respuestas LLM antes de persistir (neutralizar prompt injection, XSS) (Principio VII.7)
- **RF-008.5**: Timeouts estrictos en llamadas a proveedores (connect 10s, read 60s) (Principio XI)
- **RF-008.6**: Circuit breaker por proveedor (abrir tras 5 fallos consecutivos, medio-abierto tras 30s) (Principio XI)

---

## Entidades Clave (Modelo de Datos)

| Entidad | Descripción | Campos Principales |
|---------|-------------|-------------------|
| `LlmProvider` | Proveedor LLM configurado | id, name, type, baseUrl, encryptedApiKey, iv, authTag, isActive, rateLimitConfig, lastHealthCheck, createdAt, updatedAt |
| `LlmModel` | Modelo disponible en un proveedor | id, providerId, modelId (string proveedor), displayName, maxContextTokens, costPer1kInput, costPer1kOutput, capabilities (JSON), isFree, isDefault |
| `AgentRole` | Rol/personalidad de agente | id, name, description, systemPrompt, temperature, maxOutputTokens, topP, frequencyPenalty, presencePenalty, toolsConfig (JSON), preferredProviderId, preferredModelId, isActive |
| `AgentConversation` | Sesión de chat | id, userId, providerId, modelId, roleId, title, startedAt, endedAt, totalInputTokens, totalOutputTokens, estimatedCostUsd |
| `AgentMessage` | Mensaje individual | id, conversationId, role (user/assistant/system), content, inputTokens, outputTokens, latencyMs, metadata (JSON) |
| `AgentUsageMetric` | Agregados diarios | id, date, providerId, modelId, roleId, requestCount, inputTokens, outputTokens, estimatedCostUsd, avgLatencyMs, p95LatencyMs, errorCount |

---

## Criterios de Éxito (Success Criteria)

| ID | Criterio | Medición |
|----|----------|----------|
| SC-001 | Configurar proveedor OpenRouter con API key y validar conectividad | < 30 segundos end-to-end; clave no visible en BD ni logs |
| SC-002 | Crear rol "Analista de Logs" con prompt personalizado y usarlo en chat | Rol persiste; chat responde coherentemente con el prompt |
| SC-003 | Chat streaming funcional con indicadores de tokens/costo/latencia | Primera token < 3s; streaming fluido; contadores precisos |
| SC-004 | Historial paginado con filtros y exportación CSV/JSON | Carga < 1s para 1000 conversaciones; exportación correcta |
| SC-005 | Rate limiting efectivo: exceder límite devuelve 429 con Retry-After | Prueba automatizada: 21 requests en 1 min → 1 allowed, 20 rejected |
| SC-006 | Métricas diarias calculadas correctamente | Comparar totales BD vs. suma de mensajes = match 100% |
| SC-007 | Circuit breaker abre tras 5 fallos y recupera automáticamente | Simular 5 errores 5xx → breaker open → 30s → half-open → success → closed |
| SC-008 | Auditoría completa: cada acción genera registro inmutable | Verificar tabla `agent_audit_log` (o `inventory_audit_logs` extendida) |
| SC-009 | OBSERVADOR recibe 403 en todos los endpoints de mutación | Test automatizado negativo para POST/PUT/PATCH/DELETE |

---

## Supuestos y Decisiones de Diseño

1. **Proveedores gratuitos prioritarios**: OpenRouter (modelos gratuitos rotativos), Groq (Llama 3 ultra-rápido), Together AI, Hugging Face Inference API, Ollama local. OpenAI/Anthropic directos como "premium" opcional.
2. **Costo estimado**: Para modelos gratuitos = $0. Para modelos de pago, usar pricing público del proveedor (hardcodeado o configurable) y calcular `tokens/1000 * price`. Mostrar siempre "estimado".
3. **Streaming**: Usar `ReadableStream` / SSE desde Route Handler Next.js 15. No WebSockets (simplifica infra).
4. **Historial**: Ventana de contexto por defecto = últimos 20 mensajes o 8k tokens (lo que sea menor). Configurable por rol.
5. **Tools/Function Calling**: Soporte inicial solo para proveedores compatibles OpenAI (OpenRouter, Groq, Together, Ollama con function calling). Esquema JSON Schema por herramienta.
6. **Idioma**: UI 100% español; prompts de sistema en español; respuestas LLM en español (forzar via system prompt).
7. **Deploy**: Variables de entorno para claves maestras de cifrado (`ENCRYPTION_KEY` ya existe). No secrets nuevos en `.env` salvo claves API de proveedores (gestionadas via UI).
8. **Base de datos**: Extender schema Prisma existente. Migración idempotente.

---

## Dependencias Externas

- **Proveedores LLM**: APIs públicas (requieren cuenta gratuita y API key)
- **node:crypto**: Ya usado en proyecto para AES-256-GCM (SecretVault)
- **Zod**: Validación de entrada (ya en dependencias)
- **Prisma**: ORM existente

---

## Fuera de Alcance (Out of Scope)

- Fine-tuning o entrenamiento de modelos
- RAG (Retrieval-Augmented Generation) con base de conocimiento propia (fase futura)
- Agentes autónomos que ejecuten acciones en servidores (requiere especificación separada con human-in-the-loop, Principio V)
- Integración con proveedores de mensajería para notificaciones del agente (ya cubierto en 004-notificaciones)
- UI para OBSERVADOR (solo SUPERADMIN en esta fase)
- Multi-tenancy (single-tenant por diseño constitucional)

---

## Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Proveedor gratuito cambia límites/API sin aviso | Alto | Circuit breaker + health check periódico + fallback a otro proveedor |
| Prompt injection en logs/respuestas LLM | Crítico | Sanitización estricta (HTML escape, longitud máxima, patrones sospechosos) antes de persistir |
| Fuga de API key en logs/frontend | Crítico | Nunca loguear claves; frontend solo recibe `keyFingerprint` (SHA256 truncado); auditoría sin secretos |
| Costos inesperados en modelos de pago | Medio | Alertas de umbral diario + cuota dura configurable + solo modelos gratuitos por defecto |
| Latencia alta / timeouts en proveedores gratuitos | Medio | Timeouts agresivos (10s connect, 60s read); streaming; cache de modelos; retry con backoff |

---

## Próximos Pasos

1. **`/speckit-clarify`** — Resolver aclaraciones pendientes (máx 3)
2. **`/speckit-plan`** — Generar plan técnico con Constitution Check
3. **`/speckit-tasks`** — Descomponer en tareas ordenadas por dependencia
4. **`/speckit-implement`** — Implementar siguiendo DoD Reforzada (typecheck+lint+build+E2E behavior test)