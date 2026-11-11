"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  CheckCircle2,
  Loader2,
  MessageSquarePlus,
  Plug,
  RefreshCw,
  Send,
  Sparkles,
  Wrench,
} from "lucide-react";
import {
  LLM_PROVIDER_PRESETS,
  getProviderPreset,
  detectProviderType,
  type AgentProfileDto,
  type AgentProviderDto,
  type ChatMessageItem,
  type ProviderTestResult,
} from "./types";

// ============================================================================
// Sección 1 — Proveedor de IA
// ============================================================================

function ProviderCard({ onSaved }: { onSaved: () => void }) {
  const [provider, setProvider] = useState<AgentProviderDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [providerType, setProviderType] = useState<string>("OPENROUTER");
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [changingToken, setChangingToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ProviderTestResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const preset = getProviderPreset(providerType);
  const loadedToken = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/agent/provider", { cache: "no-store" });
      const data = (await res.json()) as { items?: AgentProviderDto[] };
      const active = data.items?.find((item) => item.isActive) ?? null;
      setProvider(active);
      if (active && !loadedToken.current) {
        setProviderType(active.providerType);
        setName(active.name);
        setBaseUrl(active.baseUrl);
        setModel(active.model);
        loadedToken.current = true;
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applyPreset = (type: string) => {
    setProviderType(type);
    const nextPreset = getProviderPreset(type);
    if (nextPreset) {
      setName((current) => (current && !loadedToken.current ? current : nextPreset.name));
      setBaseUrl(nextPreset.defaultBaseUrl);
      setModel(nextPreset.models[0]?.id ?? "");
    }
    setTestResult(null);
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/v1/agent/provider/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: baseUrl.trim(),
          model: model.trim(),
          apiToken: apiToken.trim() || undefined,
        }),
      });
      const data = (await res.json()) as ProviderTestResult & { message?: string };
      setTestResult({
        ok: Boolean(data.ok),
        message: data.message ?? "Respuesta sin detalle.",
        latencyMs: data.latencyMs ?? null,
      });
    } catch {
      setTestResult({ ok: false, message: "No se pudo contactar al servidor.", latencyMs: null });
    } finally {
      setTesting(false);
    }
  };

  const saveProvider = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/v1/agent/provider", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerType,
          name: name.trim() || preset?.name || "Proveedor LLM",
          baseUrl: baseUrl.trim(),
          model: model.trim(),
          apiToken: apiToken.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setSaveError(data?.message ?? "No se pudo guardar el proveedor.");
        return;
      }
      setSaved(true);
      setApiToken("");
      setChangingToken(false);
      await load();
      onSaved();
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaveError("Error de red al guardar el proveedor.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
        <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando proveedor…</p>
      </section>
    );
  }

  const canSave = Boolean(baseUrl.trim() && model.trim());

  return (
    <section className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100">
            <Plug className="w-4.5 h-4.5 text-indigo-600" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Proveedor de IA</h2>
            <p className="text-xs text-slate-500">
              {provider?.hasApiKey
                ? `Clave configurada ····${provider.apiKeyLast4 ?? "✓"} (nunca se muestra). Usa "Cambiar clave" para rotarla.`
                : "Sin clave configurada todavía."}
            </p>
          </div>
        </div>
        {provider?.lastTestAt && (
          <span
            className={`text-[10px] px-2 py-1 rounded-full border font-medium ${
              provider.lastTestStatus === "OK"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : provider.lastTestStatus === "FAILED"
                ? "bg-rose-50 text-rose-700 border-rose-200"
                : "bg-slate-100 text-slate-600 border-slate-200"
            }`}
          >
            Último test: {provider.lastTestStatus === "OK" ? "OK" : "FALLÓ"}
            {provider.lastTestLatencyMs ? ` · ${provider.lastTestLatencyMs}ms` : ""}
          </span>
        )}
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {LLM_PROVIDER_PRESETS.map((item) => (
          <button
            key={item.type}
            type="button"
            onClick={() => applyPreset(item.type)}
            className={`p-2.5 rounded-lg border text-left transition-colors ${
              providerType === item.type
                ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300"
                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <p className="text-xs font-semibold text-slate-700 truncate">{item.name}</p>
            <p className="text-[10px] text-slate-400 truncate">{item.badge}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Nombre del proveedor</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">URL base (API compatible OpenAI)</span>
          <input
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="https://openrouter.ai/api/v1"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Modelo</span>
          {preset && preset.models.length > 0 && model !== "__custom__" ? (
            <select
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {!preset.models.some((m) => m.id === model) && model && (
                <option value={model}>{model} (actual)</option>
              )}
              {preset.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.tag}
                </option>
              ))}
              <option value="__custom__">✏️ Escribir otro modelo…</option>
            </select>
          ) : (
            <input
              value={model === "__custom__" ? "" : model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="id-del-modelo (ej. google/gemma-4-31b-it:free)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}
          <p className="mt-1 text-[11px] text-slate-400">
            La capa gratuita de OpenRouter rota constantemente; si un modelo deja de estar disponible, escribe aquí su slug.
          </p>
          {preset?.apiKeyHelpUrl && (
            <a href={preset.apiKeyHelpUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[11px] text-indigo-600 hover:underline">
              Obtener una clave API de {preset.name} ↗
            </a>
          )}
        </label>

        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">
            Clave API {provider?.hasApiKey && !changingToken ? "(guardada)" : preset?.requiresApiKey ? "(requerida)" : "(opcional)"}
          </span>
          {provider?.hasApiKey && !changingToken ? (
            <button
              type="button"
              onClick={() => setChangingToken(true)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 text-left"
            >
              Cambiar clave (··{provider.apiKeyLast4 ?? "✓"})
            </button>
          ) : (
            <input
              type="password"
              value={apiToken}
              onChange={(event) => setApiToken(event.target.value)}
              placeholder={preset?.tokenPrefixPlaceholder ?? "Clave API"}
              autoComplete="off"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          )}
        </label>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => void testConnection()}
          disabled={testing || !baseUrl.trim() || !model.trim()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          Probar conexión
        </button>
        <button
          type="button"
          onClick={() => void saveProvider()}
          disabled={saving || !canSave}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Guardar proveedor
        </button>
        {saved && <span className="text-xs text-emerald-600 font-medium">Guardado ✓</span>}
      </div>

      {testResult && (
        <div
          className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs border ${
            testResult.ok
              ? "bg-emerald-50 border-emerald-100 text-emerald-700"
              : "bg-rose-50 border-rose-100 text-rose-700"
          }`}
        >
          {testResult.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>{testResult.message}</span>
        </div>
      )}
      {saveError && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs bg-rose-50 border border-rose-100 text-rose-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {saveError}
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Sección 2 — Comportamiento
// ============================================================================

function ProfileCard({ onSaved }: { onSaved: () => void }) {
  const [profile, setProfile] = useState<AgentProfileDto | null>(null);
  const [name, setName] = useState("");
  const [tone, setTone] = useState("");
  const [instructions, setInstructions] = useState("");
  const [escalationRules, setEscalationRules] = useState("");
  const [greeting, setGreeting] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch("/api/v1/agent/profile", { cache: "no-store" });
        const data = (await res.json()) as AgentProfileDto;
        setProfile(data);
        setName(data.name);
        setTone(data.tone ?? "");
        setInstructions(data.instructions ?? "");
        setEscalationRules(data.escalationRules ?? "");
        setGreeting(data.greeting ?? "");
        setEnabled(data.enabled);
      } finally {
        setLoading(false);
      }
    };
    void loadProfile();
  }, []);

  const saveProfile = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/agent/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, name: name.trim(), tone, instructions, escalationRules, greeting }),
      });
      const data = (await res.json()) as { message?: string };
      if (!res.ok) {
        setError(data?.message ?? "No se pudo guardar el comportamiento.");
        return;
      }
      setSaved(true);
      onSaved();
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Error de red al guardar el comportamiento.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
        <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando perfil…</p>
      </section>
    );
  }

  return (
    <section className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100">
            <Wrench className="w-4.5 h-4.5 text-indigo-600" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Comportamiento</h2>
            <p className="text-xs text-slate-500">Cómo se presenta y actúa el agente al diagnosticar tu infraestructura.</p>
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="w-4 h-4 accent-indigo-600" />
          <span className="text-xs font-medium text-slate-600">Agente activo</span>
        </label>
      </header>

      <div className="space-y-3">
        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Nombre del agente</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>

        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Tono</span>
          <textarea
            value={tone}
            onChange={(event) => setTone(event.target.value)}
            rows={3}
            placeholder="Ej.: Comunícate con tono técnico claro, directo y sobrio; dirige a los operadores por 'usted'…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>

        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">
            Instrucciones <span className="text-slate-400">(variables: {"{{hora}}"}, {"{{fecha}}"}, {"{{dia}}"})</span>
          </span>
          <textarea
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            rows={8}
            placeholder={"# REGLAS\n1. Ante un log CRITICAL, indica la causa probable primero…\n2. Si el servidor está UNREACHABLE, sugiere revisar conectividad SSH…"}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>

        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Reglas de escalado</span>
          <textarea
            value={escalationRules}
            onChange={(event) => setEscalationRules(event.target.value)}
            rows={5}
            placeholder="Cuándo el agente debe sugerir crear un incidente o notificar por los canales configurados…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>

        <label className="block">
          <span className="block text-xs font-medium text-slate-600 mb-1">Saludo inicial</span>
          <input
            value={greeting}
            onChange={(event) => setGreeting(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void saveProfile()}
          disabled={saving || !name.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Guardar comportamiento
        </button>
        {saved && <span className="text-xs text-emerald-600 font-medium">Guardado ✓</span>}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs bg-rose-50 border border-rose-100 text-rose-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Sección 3 — Chat de prueba (streaming)
// ============================================================================

function ChatCard({ ready, onNeedSetup }: { ready: boolean; onNeedSetup: () => void }) {
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const message = input.trim();
    if (!message || streaming) return;

    const history = messages
      .filter((item) => !item.error)
      .map((item) => ({ role: item.role, content: item.content }));

    setMessages((current) => [...current, { role: "user", content: message }]);
    setInput("");
    setStreaming(true);
    setLatencyMs(null);

    const assistantIndex = messages.length + 1;
    setMessages((current) => [...current, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/v1/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });

      if (!response.ok || !response.body) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        setMessages((current) =>
          current.map((item, index) =>
            index === assistantIndex
              ? { ...item, content: data?.message ?? "No se pudo iniciar el turno del agente.", error: true }
              : item
          )
        );
        return;
      }

      // Parseo del stream SSE en el navegador.
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const raw of events) {
          const eventLine = raw.split("\n").find((line) => line.startsWith("event:"));
          const dataLine = raw.split("\n").find((line) => line.startsWith("data:"));
          if (!eventLine || !dataLine) continue;
          const eventType = eventLine.slice(6).trim();
          let payload: { text?: string; message?: string; latencyMs?: number } = {};
          try {
            payload = JSON.parse(dataLine.slice(5).trim());
          } catch {
            continue;
          }

          if (eventType === "delta" && payload.text) {
            setMessages((current) =>
              current.map((item, index) =>
                index === assistantIndex ? { ...item, content: item.content + payload.text } : item
              )
            );
          } else if (eventType === "done") {
            setLatencyMs(payload.latencyMs ?? null);
          } else if (eventType === "error") {
            setMessages((current) =>
              current.map((item, index) =>
                index === assistantIndex
                  ? { ...item, content: item.content || payload.message || "Error del proveedor.", error: Boolean(item.content) ? false : true }
                  : item
              )
            );
          }
        }
      }
    } catch {
      setMessages((current) =>
        current.map((item, index) =>
          index === assistantIndex && !item.content
            ? { ...item, content: "Error de red durante el turno. Intenta de nuevo.", error: true }
            : item
        )
      );
    } finally {
      setStreaming(false);
    }
  };

  return (
    <section className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col min-h-[480px]">
      <header className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100">
            <Bot className="w-4.5 h-4.5 text-indigo-600" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Chat de prueba</h2>
            <p className="text-xs text-slate-500">Streaming en vivo con el proveedor y el perfil configurados.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {latencyMs !== null && <span className="text-[10px] text-slate-400 font-mono">{latencyMs}ms</span>}
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              setLatencyMs(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" /> Nueva conversación
          </button>
        </div>
      </header>

      {!ready && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Configura y guarda primero un proveedor de IA.{" "}
            <button type="button" onClick={onNeedSetup} className="underline font-medium">
              Ir a la sección Proveedor
            </button>
          </span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 py-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-slate-400">
            <Bot className="w-8 h-8" />
            <p className="text-sm max-w-sm">
              Prueba el agente: pregúntale por el estado de un servidor, la causa de un log CRITICAL o qué hacer ante un servicio caído.
            </p>
          </div>
        )}
        {messages.map((message, index) => (
          <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                message.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-md"
                  : message.error
                  ? "bg-rose-50 text-rose-700 border border-rose-100 rounded-bl-md"
                  : "bg-slate-100 text-slate-800 rounded-bl-md"
              }`}
            >
              {message.content || (streaming && index === messages.length - 1 ? "▌" : "")}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
        className="flex items-end gap-2 pt-3 border-t border-slate-100"
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder={ready ? "Escribe tu consulta de operaciones… (Enter para enviar)" : "Configura un proveedor de IA primero"}
          disabled={!ready || streaming}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!ready || streaming || !input.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 h-[46px]"
        >
          {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </section>
  );
}

// ============================================================================
// Página
// ============================================================================

export default function AgentPageClient() {
  const [providerReady, setProviderReady] = useState<boolean | null>(null);

  useEffect(() => {
    const checkProvider = async () => {
      try {
        const res = await fetch("/api/v1/agent/provider", { cache: "no-store" });
        const data = (await res.json()) as { items?: AgentProviderDto[] };
        setProviderReady(Boolean(data.items?.some((item) => item.isActive && item.hasApiKey)));
      } catch {
        setProviderReady(false);
      }
    };
    void checkProvider();
  }, []);

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 shadow-sm">
          <Bot className="w-6 h-6 text-white" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Agente Inteligente</h1>
          <p className="text-sm text-slate-500">
            Entrena a tu asistente de operaciones: proveedor LLM, comportamiento y chat de prueba.
          </p>
        </div>
      </header>

      <ProviderCard onSaved={() => setProviderReady(true)} />
      <ProfileCard onSaved={() => undefined} />
      <ChatCard ready={Boolean(providerReady)} onNeedSetup={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
    </div>
  );
}
