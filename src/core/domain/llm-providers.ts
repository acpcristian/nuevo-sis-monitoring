/**
 * Presets curados de proveedores LLM para la sección "Agente".
 * Todos los que exponen API son compatibles con el formato OpenAI
 * /chat/completions (OpenRouter, OpenAI, DeepSeek, Groq, Together);
 * Ollama expone el mismo formato en local. Anthropic directo tiene su
 * propia variante y se soporta como proveedor dedicado en fase 2.
 */
export type LlmProviderType =
  | "OPENROUTER"
  | "FREELLMAPI"
  | "OPENAI"
  | "ANTHROPIC"
  | "DEEPSEEK"
  | "GROQ"
  | "OLLAMA_LOCAL"
  | "CUSTOM";

export interface LlmModelPreset {
  id: string;
  label: string;
  tag: string;
  /** El modelo es gratuito en su capa base (orientativo). */
  free?: boolean;
}

export interface LlmProviderPreset {
  type: LlmProviderType;
  name: string;
  badge: string;
  defaultBaseUrl: string;
  apiKeyHelpUrl?: string;
  tokenPrefixPlaceholder?: string;
  /** El proveedor funciona sin clave API (Ollama local). */
  requiresApiKey: boolean;
  models: LlmModelPreset[];
  /** Nota de ayuda bajo el campo de modelo (específica del proveedor). */
  modelHint?: string;
}

export const LLM_PROVIDER_PRESETS: LlmProviderPreset[] = [
  {
    type: "OPENROUTER",
    name: "OpenRouter",
    badge: "Multi-modelo · capa gratuita",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    apiKeyHelpUrl: "https://openrouter.ai/keys",
    tokenPrefixPlaceholder: "sk-or-v1-...",
    requiresApiKey: true,
    modelHint: "La capa gratuita de OpenRouter rota constantemente; si un modelo deja de estar disponible, escribe aquí su slug.",
    models: [
      { id: "nvidia/nemotron-3.5-super-vl:free", label: "Nemotron 3.5 Super", tag: "Gratuito · muy capaz", free: true },
      { id: "google/gemma-4-31b-it:free", label: "Gemma 4 31B", tag: "Gratuito · rotación upstream", free: true },
      { id: "liquid/lfm-2.5-2.6b:free", label: "Liquid LFM 2.5", tag: "Gratuito · ultraligero", free: true },
      { id: "deepseek/deepseek-chat", label: "DeepSeek V3", tag: "De pago · gran rendimiento" },
      { id: "anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", tag: "De pago · calidad superior" },
    ],
  },
  {
    type: "FREELLMAPI",
    name: "FreeLLM API",
    badge: "Router gratis · 635 modelos",
    // FreeLLM API es un router auto-alojado (docker/npx): expone /v1 compatible
    // OpenAI con streaming y tool calling. En producción vive en el servidor de
    // Coolify (172.16.100.22:3001); para una instancia local usar 127.0.0.1.
    defaultBaseUrl: "http://172.16.100.22:3001/v1",
    apiKeyHelpUrl: "https://github.com/tashfeenahmed/freellmapi",
    tokenPrefixPlaceholder: "freellmapi-...",
    requiresApiKey: true,
    modelHint: "El catálogo de FreeLLM API se actualiza solo: usa «auto» o escribe cualquier id de freellmapi.co/models.",
    models: [
      // Modelos virtuales del router: "auto" elige el mejor endpoint libre
      // disponible y "fusion" sintetiza un panel de modelos con un juez.
      // El catálogo completo (635 endpoints) vive en freellmapi.co/models;
      // cualquier id del catálogo se puede escribir manualmente.
      { id: "auto", label: "Auto — el router elige", tag: "Gratuito · failover automático", free: true },
      { id: "fusion", label: "Fusion — multi-modelo", tag: "Gratuito · panel + juez", free: true },
    ],
  },
  {
    type: "GROQ",
    name: "Groq Cloud",
    badge: "Ultra veloz · capa gratuita",
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    apiKeyHelpUrl: "https://console.groq.com/keys",
    tokenPrefixPlaceholder: "gsk_...",
    requiresApiKey: true,
    models: [
      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", tag: "Capa gratuita · velocidad extrema", free: true },
      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B", tag: "Capa gratuita · instantáneo", free: true },
      { id: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1 (distill)", tag: "Capa gratuita · razonamiento", free: true },
    ],
  },
  {
    type: "OPENAI",
    name: "OpenAI (ChatGPT)",
    badge: "Oficial · de pago",
    defaultBaseUrl: "https://api.openai.com/v1",
    apiKeyHelpUrl: "https://platform.openai.com/api-keys",
    tokenPrefixPlaceholder: "sk-proj-...",
    requiresApiKey: true,
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini", tag: "Económico y veloz" },
      { id: "gpt-4o", label: "GPT-4o", tag: "Máxima inteligencia" },
      { id: "o1-mini", label: "o1 mini", tag: "Razonamiento puro" },
    ],
  },
  {
    type: "DEEPSEEK",
    name: "DeepSeek",
    badge: "Oficial · bajo costo",
    defaultBaseUrl: "https://api.deepseek.com/v1",
    apiKeyHelpUrl: "https://platform.deepseek.com/api_keys",
    tokenPrefixPlaceholder: "sk-...",
    requiresApiKey: true,
    models: [
      { id: "deepseek-chat", label: "DeepSeek V3", tag: "Gran rendimiento y bajo costo" },
      { id: "deepseek-reasoner", label: "DeepSeek R1", tag: "Razonamiento profundo" },
    ],
  },
  {
    type: "ANTHROPIC",
    name: "Anthropic (Claude)",
    badge: "Oficial · de pago",
    defaultBaseUrl: "https://api.anthropic.com/v1",
    apiKeyHelpUrl: "https://console.anthropic.com/settings/keys",
    tokenPrefixPlaceholder: "sk-ant-api03-...",
    requiresApiKey: true,
    models: [
      { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku", tag: "Ultra rápido" },
      { id: "claude-3-5-sonnet-20241022", label: "Claude 3.5 Sonnet", tag: "Calidad superior" },
    ],
  },
  {
    type: "OLLAMA_LOCAL",
    name: "Ollama local",
    badge: "Sin clave API · red local",
    defaultBaseUrl: "http://127.0.0.1:11434/v1",
    requiresApiKey: false,
    models: [
      { id: "llama3.1:8b", label: "Llama 3.1 8B", tag: "Local · sin costo", free: true },
      { id: "qwen2.5:7b", label: "Qwen 2.5 7B", tag: "Local · sin costo", free: true },
    ],
  },
  {
    type: "CUSTOM",
    name: "Personalizado / Otro",
    badge: "Compatible con OpenAI",
    defaultBaseUrl: "https://",
    tokenPrefixPlaceholder: "Tu clave API...",
    requiresApiKey: false,
    models: [],
  },
];

export function getProviderPreset(type: string): LlmProviderPreset | undefined {
  return LLM_PROVIDER_PRESETS.find((preset) => preset.type === type);
}

/** Detecta el proveedor a partir de la URL base (para precargar el formulario). */
export function detectProviderType(baseUrl: string): LlmProviderType {
  const url = baseUrl.toLowerCase();
  if (url.includes("openrouter.ai")) return "OPENROUTER";
  if (url.includes("api.openai.com")) return "OPENAI";
  if (url.includes("anthropic.com")) return "ANTHROPIC";
  if (url.includes("deepseek.com")) return "DEEPSEEK";
  if (url.includes("groq.com")) return "GROQ";
  if (url.includes("11434")) return "OLLAMA_LOCAL";
  // FreeLLMAPI auto-alojado: por nombre de host o su puerto default 3001 + /v1.
  if (url.includes("freellmapi") || /:(127\.0\.0\.1|localhost):3001\/v1/.test(url)) return "FREELLMAPI";
  return "CUSTOM";
}
