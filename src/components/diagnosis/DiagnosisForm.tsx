"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  AlertTriangle,
  FileText,
  Search,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface LogEvent {
  id: string;
  category: string;
  severity: string;
  eventTimestamp: string;
  sanitizedMessage: string;
  serverName: string | null;
}

interface DiagnosisFormProps {
  onClose: () => void;
  preselectedEventIds?: string[];
  onDiagnosisCreated?: (id: string) => void;
}

export function DiagnosisForm({
  onClose,
  preselectedEventIds = [],
  onDiagnosisCreated,
}: DiagnosisFormProps) {
  const router = useRouter();
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>(preselectedEventIds);
  const [availableEvents, setAvailableEvents] = useState<LogEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [observedFacts, setObservedFacts] = useState("");
  const [probableCause, setProbableCause] = useState("");
  const [evidenceSupport, setEvidenceSupport] = useState("");
  const [alternativeDiagnoses, setAlternativeDiagnoses] = useState("");
  const [impactPotential, setImpactPotential] = useState("");
  const [verificationSteps, setVerificationSteps] = useState("");
  const [remediationRecommendations, setRemediationRecommendations] = useState("");
  const [confidenceLevel, setConfidenceLevel] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");

  useEffect(() => {
    fetchAvailableEvents();
  }, []);

  const fetchAvailableEvents = async () => {
    try {
      const res = await fetch("/api/v1/logs?limit=200", {
        headers: { Authorization: "Bearer TOKEN_SUPERADMIN" },
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableEvents(data.items || []);
      }
    } catch (err) {
      console.error("Error fetching events:", err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleEventToggle = (eventId: string) => {
    setSelectedEventIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (selectedEventIds.length === 0) {
      setError("Debe seleccionar al menos un evento de log.");
      return;
    }
    if (!observedFacts.trim()) {
      setError("Los hechos observados son obligatorios.");
      return;
    }
    if (!probableCause.trim()) {
      setError("La causa probable es obligatoria.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/diagnoses", {
        method: "POST",
        headers: {
          Authorization: "Bearer TOKEN_SUPERADMIN",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventIds: selectedEventIds,
          observedFacts: observedFacts.trim(),
          probableCause: probableCause.trim(),
          evidenceSupport: evidenceSupport.trim() ? JSON.parse(evidenceSupport) : undefined,
          alternativeDiagnoses: alternativeDiagnoses.trim() || undefined,
          impactPotential: impactPotential.trim() || undefined,
          verificationSteps: verificationSteps.trim() || undefined,
          remediationRecommendations: remediationRecommendations.trim() || undefined,
          confidenceLevel,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Error al crear diagnóstico");
      }

      const diagnosis = await res.json();
      if (onDiagnosisCreated) {
        onDiagnosisCreated(diagnosis.id);
      } else {
        router.push(`/logs/diagnosis/${diagnosis.id}`);
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error al crear diagnóstico");
    } finally {
      setSubmitting(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return "bg-rose-100 text-rose-700 border-rose-200";
      case "ERROR":
        return "bg-rose-50 text-rose-700 border-rose-200";
      case "WARN":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
    }
  };

  const getCategoryName = (category: string) => {
    const names: Record<string, string> = {
      SYS_KERNEL: "Sistema/Kernel",
      AUTH_ACCESS: "Autenticación/Accesos",
      SSH_NETWORK: "SSH/Red",
      SYSTEM_SERVICE: "Servicios Sistema",
      WEB_APP: "Apps Web",
      DATABASE: "Bases de Datos",
      STORAGE_HW: "Almacenamiento/HW",
      BACKUP_TASK: "Backups/Tareas",
      SECURITY_AUDIT: "Seguridad/Auditoría",
      AGENT_ERROR: "Errores Agentes",
    };
    return names[category] || category;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-900">Generar Diagnóstico Estructurado</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Step 1: Select Events */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-700">
              <Search className="w-4 h-4 inline mr-1" />
              Eventos de Log Relacionados (seleccione al menos uno)
            </label>

            {loadingEvents ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                {availableEvents.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm">
                    No hay eventos de log disponibles
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {availableEvents.map((event) => (
                      <li
                        key={event.id}
                        className={`px-4 py-3 hover:bg-slate-50 transition cursor-pointer ${
                          selectedEventIds.includes(event.id) ? "bg-indigo-50 border-l-4 border-indigo-500" : ""
                        }`}
                        onClick={() => handleEventToggle(event.id)}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedEventIds.includes(event.id)}
                            onChange={() => handleEventToggle(event.id)}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                          />
                          <span className="flex-1 text-sm font-mono text-slate-600">{event.id.slice(0, 8)}...</span>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-medium rounded ${getSeverityColor(event.severity)}`}
                          >
                            {event.severity}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-700 rounded">
                            {getCategoryName(event.category)}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <span>{event.serverName || "Servidor desconocido"}</span>
                          <span>•</span>
                          <span>{new Date(event.eventTimestamp).toLocaleString()}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600 line-clamp-2">{event.sanitizedMessage}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {selectedEventIds.length > 0 && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-indigo-700">
                  <CheckCircle className="w-4 h-4" />
                  <span>{selectedEventIds.length} evento(s) seleccionado(s)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEventIds([])}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Limpiar selección
                </button>
              </div>
            )}
          </div>

          {/* Step 2: Diagnosis Structure */}
          <div className="border-t border-slate-200 pt-6 space-y-5">
            <h3 className="text-md font-semibold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Estructura del Diagnóstico (Principio VII)
            </h3>
            <p className="text-xs text-slate-500">
              Complete las secciones obligatorias. Hechos e inferencias se diferencian claramente.
            </p>

            {/* Required: Observed Facts */}
            <div>
              <label htmlFor="observedFacts" className="block text-sm font-medium text-slate-700 mb-1">
                Hechos Observados <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="observedFacts"
                required
                value={observedFacts}
                onChange={(e) => setObservedFacts(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                placeholder="Describa los hechos constatables extraídos directamente de los logs (ej: 'Se detectaron 15 eventos de error de BD en 5 min...')"
              />
              <p className="text-xs text-slate-500 mt-1">Hechos extraíbles directamente de los eventos seleccionados (no inferencias).</p>
            </div>

            {/* Required: Probable Cause */}
            <div>
              <label htmlFor="probableCause" className="block text-sm font-medium text-slate-700 mb-1">
                Causa Probable <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="probableCause"
                required
                value={probableCause}
                onChange={(e) => setProbableCause(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                placeholder="Hipótesis fundamentada de la causa raíz (ej: 'Pool de conexiones agotado por fuga en el ORM...')"
              />
              <p className="text-xs text-slate-500 mt-1">Inferencia basada en los hechos; no es un hecho consumado.</p>
            </div>

            {/* Optional: Evidence Support */}
            <div>
              <label htmlFor="evidenceSupport" className="block text-sm font-medium text-slate-700 mb-1">
                Evidencias de Soporte (JSON opcional)
              </label>
              <textarea
                id="evidenceSupport"
                value={evidenceSupport}
                onChange={(e) => setEvidenceSupport(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm font-mono"
                placeholder='{"logRefs": ["evt-001", "evt-002"], "metrics": {"poolUsage": "95%"}}'
              />
              <p className="text-xs text-slate-500 mt-1">Referencias a líneas de log, marcas temporales, IDs de servidor. JSON válido.</p>
            </div>

            {/* Optional fields */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="alternativeDiagnoses" className="block text-sm font-medium text-slate-700 mb-1">
                  Diagnósticos Alternativos
                </label>
                <textarea
                  id="alternativeDiagnoses"
                  value={alternativeDiagnoses}
                  onChange={(e) => setAlternativeDiagnoses(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  placeholder="Otras hipótesis consideradas..."
                />
              </div>
              <div>
                <label htmlFor="impactPotential" className="block text-sm font-medium text-slate-700 mb-1">
                  Impacto Potencial
                </label>
                <textarea
                  id="impactPotential"
                  value={impactPotential}
                  onChange={(e) => setImpactPotential(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  placeholder="Alcance y gravedad del incidente..."
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="verificationSteps" className="block text-sm font-medium text-slate-700 mb-1">
                  Pasos de Verificación
                </label>
                <textarea
                  id="verificationSteps"
                  value={verificationSteps}
                  onChange={(e) => setVerificationSteps(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  placeholder="Cómo confirmar la causa y la recuperación..."
                />
              </div>
              <div>
                <label htmlFor="remediationRecommendations" className="block text-sm font-medium text-slate-700 mb-1">
                  Recomendaciones de Solución
                </label>
                <textarea
                  id="remediationRecommendations"
                  value={remediationRecommendations}
                  onChange={(e) => setRemediationRecommendations(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                  placeholder="Acciones correctivas y preventivas..."
                />
              </div>
            </div>

            {/* Confidence Level */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Nivel de Confianza <span className="text-rose-500">*</span>
              </label>
              <div className="flex gap-4">
                {(["LOW", "MEDIUM", "HIGH"] as const).map((level) => (
                  <label
                    key={level}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 cursor-pointer transition ${
                      confidenceLevel === level
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="confidenceLevel"
                      value={level}
                      checked={confidenceLevel === level}
                      onChange={() => setConfidenceLevel(level)}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium">{level}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-rose-700 text-sm">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Generar Diagnóstico
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}