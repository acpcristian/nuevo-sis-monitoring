"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Bot,
  BookOpen,
  CheckCircle2,
  Download,
  History,
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
  type AgentKbEntryDto,
  type AgentKbListDto,
  type AgentMetricsDto,
  type AgentConversationDetailDto,
  type AgentConversationListItemDto,
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
  const [ratePerMinute, setRatePerMinute] = useState("");
  const [ratePerDay, setRatePerDay] = useState("");
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
        setRatePerMinute(active.rateLimitPerMinute === null ? "" : String(active.rateLimitPerMinute));
        setRatePerDay(active.rateLimitPerDay === null ? "" : String(active.rateLimitPerDay));
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
          rateLimitPerMinute: ratePerMinute.trim() === "" ? null : Number(ratePerMinute),
          rateLimitPerDay: ratePerDay.trim() === "" ? null : Number(ratePerDay),
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
            {preset?.modelHint ?? "Escribe aquí el id del modelo si no está en la lista."}
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

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="text-xs font-semibold text-slate-700 mb-0.5">Guardián de uso</p>
        <p className="text-[11px] text-slate-500 mb-2">
          Límites aplicados antes de cada turno (protege tu cuota del proveedor). Vacío = sin límite.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-medium text-slate-600 mb-1">Máx. peticiones por minuto</span>
            <input
              type="number"
              min={1}
              value={ratePerMinute}
              onChange={(event) => setRatePerMinute(event.target.value)}
              placeholder="sin límite"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-medium text-slate-600 mb-1">Máx. peticiones por día (UTC)</span>
            <input
              type="number"
              min={1}
              value={ratePerDay}
              onChange={(event) => setRatePerDay(event.target.value)}
              placeholder="sin límite"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
        </div>
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
  const [toolsEnabled, setToolsEnabled] = useState(true);
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
        setToolsEnabled(data.toolsEnabled);
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
        body: JSON.stringify({ enabled, toolsEnabled, name: name.trim(), tone, instructions, escalationRules, greeting }),
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

        <label className="flex items-start gap-2.5 cursor-pointer select-none rounded-lg border border-slate-200 bg-slate-50 p-3">
          <input
            type="checkbox"
            checked={toolsEnabled}
            onChange={(event) => setToolsEnabled(event.target.checked)}
            className="w-4 h-4 mt-0.5 accent-indigo-600"
          />
          <span>
            <span className="block text-xs font-medium text-slate-700">Tools de dominio (datos vivos)</span>
            <span className="block text-[11px] text-slate-500">
              Permite que el agente consulte en vivo el inventario, los logs, las alertas y los incidentes reales antes de responder (solo lectura).
            </span>
          </span>
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
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [tokensOut, setTokensOut] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const message = input.trim();
    if (!message || streaming) return;

    setMessages((current) => [...current, { role: "user", content: message }]);
    setInput("");
    setStreaming(true);
    setLatencyMs(null);
    setTokensOut(null);

    const assistantIndex = messages.length + 1;
    setMessages((current) => [...current, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/v1/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // El historial vive en la BD: solo se envía el mensaje y la conversación.
        body: JSON.stringify({
          message,
          ...(conversationId ? { conversationId } : {}),
        }),
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
          let payload: {
            text?: string;
            message?: string;
            latencyMs?: number;
            summary?: string;
            conversationId?: string;
            tokens?: { input?: number; output?: number };
          } = {};
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
          } else if (eventType === "tool" && payload.summary) {
            setMessages((current) =>
              current.map((item, index) =>
                index === assistantIndex ? { ...item, tools: [...(item.tools ?? []), payload.summary ?? ""] } : item
              )
            );
          } else if (eventType === "done") {
            setLatencyMs(payload.latencyMs ?? null);
            setTokensOut(payload.tokens?.output ?? null);
            if (payload.conversationId) setConversationId(payload.conversationId);
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
          {tokensOut !== null && (
            <span className="text-[10px] text-slate-400 font-mono" title="Tokens de salida estimados (chars/4)">
              ~{tokensOut} tk
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setMessages([]);
              setLatencyMs(null);
              setTokensOut(null);
              setConversationId(null);
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
              {message.tools && message.tools.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {message.tools.map((tool, toolIndex) => (
                    <span
                      key={toolIndex}
                      className="inline-flex items-center gap-1 rounded-full bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[10px] font-medium text-indigo-700 font-mono"
                    >
                      🛠 {tool}
                    </span>
                  ))}
                </div>
              )}
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
// Sección 4 — Base de Conocimiento (entrenamiento documental)
// ============================================================================

function KnowledgeCard() {
  const [tab, setTab] = useState<"QA" | "BLOQUE">("QA");
  const [items, setItems] = useState<AgentKbEntryDto[]>([]);
  const [usedChars, setUsedChars] = useState(0);
  const [budget, setBudget] = useState(24000);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/agent/kb", { cache: "no-store" });
      const data = (await res.json()) as AgentKbListDto;
      setItems(data.items ?? []);
      setUsedChars(data.usedChars ?? 0);
      setBudget(data.budget ?? 24000);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addEntry = async () => {
    setSaving(true);
    setError(null);
    try {
      const body =
        tab === "QA"
          ? { kind: "QA", question: question.trim(), answer: answer.trim() }
          : { kind: "BLOQUE", title: title.trim(), content: content.trim() };
      const res = await fetch("/api/v1/agent/kb", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { message?: string; items?: AgentKbEntryDto[]; usedChars?: number };
      if (!res.ok) {
        setError(data?.message ?? "No se pudo guardar la entrada.");
        return;
      }
      setQuestion("");
      setAnswer("");
      setTitle("");
      setContent("");
      setSaved(true);
      if (typeof data.usedChars === "number") setUsedChars(data.usedChars);
      if (data.items) setItems(data.items);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Error de red al guardar la entrada.");
    } finally {
      setSaving(false);
    }
  };

  const toggleEntry = async (entry: AgentKbEntryDto) => {
    setError(null);
    try {
      const res = await fetch(`/api/v1/agent/kb/${entry.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !entry.enabled }),
      });
      const data = (await res.json()) as { message?: string; items?: AgentKbEntryDto[]; usedChars?: number };
      if (!res.ok) {
        setError(data?.message ?? "No se pudo actualizar la entrada.");
        return;
      }
      if (typeof data.usedChars === "number") setUsedChars(data.usedChars);
      if (data.items) setItems(data.items);
    } catch {
      setError("Error de red al actualizar la entrada.");
    }
  };

  const deleteEntry = async (entry: AgentKbEntryDto) => {
    setError(null);
    try {
      const res = await fetch(`/api/v1/agent/kb/${entry.id}`, { method: "DELETE" });
      const data = (await res.json()) as { message?: string; items?: AgentKbEntryDto[]; usedChars?: number };
      if (!res.ok) {
        setError(data?.message ?? "No se pudo eliminar la entrada.");
        return;
      }
      if (typeof data.usedChars === "number") setUsedChars(data.usedChars);
      if (data.items) setItems(data.items);
    } catch {
      setError("Error de red al eliminar la entrada.");
    }
  };

  const visible = items.filter((item) => item.kind === tab);
  const canAdd =
    tab === "QA" ? Boolean(question.trim() && answer.trim()) : Boolean(title.trim() && content.trim());

  if (loading) {
    return (
      <section className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
        <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando base de conocimiento…</p>
      </section>
    );
  }

  return (
    <section className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100">
            <BookOpen className="w-4.5 h-4.5 text-indigo-600" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Base de Conocimiento</h2>
            <p className="text-xs text-slate-500">Entrena al agente con hechos del negocio: se inyectan como fuente de verdad.</p>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-full border font-mono font-medium ${usedChars > budget ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
          {usedChars} / {budget} chars
        </span>
      </header>

      <div className="flex gap-2">
        {(["QA", "BLOQUE"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => setTab(kind)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              tab === kind
                ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {kind === "QA" ? "Preguntas y respuestas" : "Bloques de conocimiento"}
          </button>
        ))}
      </div>

      {tab === "QA" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Pregunta</span>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={3}
              placeholder="Ej.: ¿Cuál es el horario de guardia nocturna?"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Respuesta</span>
            <textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              rows={3}
              placeholder="Ej.: De 22:00 a 06:00, responsable del turno B."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Título del bloque</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ej.: Procedimiento de reinicio del servidor de bases de datos"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-slate-600 mb-1">Contenido</span>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={5}
              placeholder="Todo lo que el agente debe saber sobre este tema…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void addEntry()}
          disabled={saving || !canAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Agregar entrada
        </button>
        {saved && <span className="text-xs text-emerald-600 font-medium">Guardado ✓</span>}
      </div>

      {visible.length > 0 && (
        <ul className="space-y-2">
          {visible.map((entry) => (
            <li
              key={entry.id}
              className={`rounded-lg border px-3 py-2.5 text-xs ${entry.enabled ? "border-slate-200 bg-slate-50" : "border-slate-100 bg-white opacity-60"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-700 truncate">
                    {entry.kind === "QA" ? entry.question : entry.title}
                  </p>
                  <p className="text-slate-500 mt-0.5 line-clamp-2 whitespace-pre-wrap">
                    {entry.kind === "QA" ? entry.answer : entry.content}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => void toggleEntry(entry)}
                    title={entry.enabled ? "Deshabilitar" : "Habilitar"}
                    className={`px-2 py-1 rounded-md border text-[10px] font-medium ${
                      entry.enabled
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-100 text-slate-500"
                    }`}
                  >
                    {entry.enabled ? "Activa" : "Inactiva"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteEntry(entry)}
                    title="Eliminar"
                    className="px-2 py-1 rounded-md border border-slate-200 bg-white text-[10px] text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {visible.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-2">
          Aún no hay entradas {tab === "QA" ? "de preguntas y respuestas" : "de conocimiento libre"}.
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-xs bg-rose-50 border border-rose-100 text-rose-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Sección 5 — Historial y métricas
// ============================================================================

function HistoryCard() {
  const [metrics, setMetrics] = useState<AgentMetricsDto | null>(null);
  const [items, setItems] = useState<AgentConversationListItemDto[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AgentConversationDetailDto | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (targetPage: number) => {
    setLoading(true);
    try {
      const [metricsRes, listRes] = await Promise.all([
        fetch("/api/v1/agent/metrics", { cache: "no-store" }),
        fetch(`/api/v1/agent/conversations?page=${targetPage}`, { cache: "no-store" }),
      ]);
      setMetrics((await metricsRes.json()) as AgentMetricsDto);
      const list = (await listRes.json()) as { items: AgentConversationListItemDto[]; page: number; totalPages: number; total: number };
      setItems(list.items ?? []);
      setPage(list.page ?? 1);
      setTotalPages(list.totalPages ?? 1);
      setTotal(list.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setDetail(null);
      return;
    }
    setExpandedId(id);
    setDetail(null);
    try {
      const res = await fetch(`/api/v1/agent/conversations/${id}`, { cache: "no-store" });
      if (res.ok) setDetail((await res.json()) as AgentConversationDetailDto);
    } catch {
      // expansión falla en silencio
    }
  };

  const exportJson = (conversation: AgentConversationDetailDto) => {
    const blob = new Blob([JSON.stringify(conversation, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `conversacion-${conversation.id.slice(0, 8)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const deleteConversation = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/agent/conversations/${id}`, { method: "DELETE" });
      if (res.ok) {
        if (expandedId === id) {
          setExpandedId(null);
          setDetail(null);
        }
        await load(page);
      }
    } catch {
      // silencio
    }
  };

  if (loading) {
    return (
      <section className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
        <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Cargando historial…</p>
      </section>
    );
  }

  return (
    <section className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
      <header className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 border border-indigo-100">
          <History className="w-4.5 h-4.5 text-indigo-600" />
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Historial y métricas</h2>
          <p className="text-xs text-slate-500">Conversaciones persistidas del chat de prueba y uso del agente.</p>
        </div>
      </header>

      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { label: "Conversaciones", value: metrics.conversations },
            { label: "Turnos", value: metrics.turns },
            { label: "Tokens in (est.)", value: metrics.totalInputTokens },
            { label: "Tokens out (est.)", value: metrics.totalOutputTokens },
            { label: "Latencia media", value: metrics.avgLatencyMs !== null ? `${metrics.avgLatencyMs}ms` : "—" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[10px] text-slate-500">{stat.label}</p>
              <p className="text-sm font-semibold text-slate-800 font-mono">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-2">Aún no hay conversaciones guardadas.</p>
      )}

      <ul className="space-y-2">
        {items.map((conversation) => (
          <li key={conversation.id} className="rounded-lg border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => void toggleExpand(conversation.id)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-slate-50"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{conversation.title}</p>
                <p className="text-[10px] text-slate-400">
                  {new Date(conversation.lastMessageAt).toLocaleString("es-BO")} · {conversation.turnCount} turnos · ~{conversation.totalInputTokens + conversation.totalOutputTokens} tokens
                </p>
              </div>
              <span className="text-[10px] text-slate-400 shrink-0">{expandedId === conversation.id ? "▲" : "▼"}</span>
            </button>
            {expandedId === conversation.id && (
              <div className="border-t border-slate-100 bg-slate-50 px-3 py-2.5 space-y-2">
                {detail === null && <p className="text-xs text-slate-400">Cargando mensajes…</p>}
                {detail?.messages.map((message) => (
                  <div key={message.id} className={`text-xs rounded-lg px-2.5 py-1.5 whitespace-pre-wrap ${message.role === "user" ? "bg-indigo-50 text-slate-700" : "bg-white border border-slate-200 text-slate-700"}`}>
                    <span className="text-[9px] uppercase tracking-wide text-slate-400 block">
                      {message.role}{message.latencyMs !== null ? ` · ${message.latencyMs}ms` : ""}{message.outputTokens ? ` · ~${message.outputTokens} tk` : ""}
                    </span>
                    {message.content}
                  </div>
                ))}
                {detail && (
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => exportJson(detail)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[10px] text-slate-600 hover:bg-slate-100"
                    >
                      <Download className="w-3 h-3" /> Exportar JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteConversation(conversation.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[10px] text-rose-600 hover:bg-rose-50"
                    >
                      Eliminar conversación
                    </button>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              const next = page - 1;
              setPage(next);
              void load(next);
            }}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
          >
            ← Anterior
          </button>
          <span>Página {page} de {totalPages} · {total} conversaciones</span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => {
              const next = page + 1;
              setPage(next);
              void load(next);
            }}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 hover:bg-slate-50 disabled:opacity-40"
          >
            Siguiente →
          </button>
        </div>
      )}
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
            Entrena a tu asistente de operaciones: proveedor LLM, comportamiento, base de conocimiento, chat de prueba e historial.
          </p>
        </div>
      </header>

      <ProviderCard onSaved={() => setProviderReady(true)} />
      <ProfileCard onSaved={() => undefined} />
      <KnowledgeCard />
      <ChatCard ready={Boolean(providerReady)} onNeedSetup={() => window.scrollTo({ top: 0, behavior: "smooth" })} />
      <HistoryCard />
    </div>
  );
}
