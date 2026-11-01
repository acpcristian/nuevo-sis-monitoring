"use client";

import React from "react";
import {
  FileText,
  AlertTriangle,
  Lightbulb,
  Shield,
  Wrench,
  Activity,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface DiagnosisSectionProps {
  title: string;
  icon: React.ReactNode;
  content?: string | null;
  defaultOpen?: boolean;
}

function DiagnosisSection({
  title,
  icon,
  content,
  defaultOpen = false,
}: DiagnosisSectionProps) {
  const [open, setOpen] = React.useState(defaultOpen);

  if (!content) {
    return null;
  }

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {icon}
          {title}
        </span>
        {open ? (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        )}
      </button>
      {open && (
        <div className="px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap break-words">
          {content}
        </div>
      )}
    </div>
  );
}

export interface DiagnosisCardData {
  id: string;
  generatedBy: string;
  generatedAt: string;
  observedFacts: string;
  probableCause: string;
  evidenceSupport?: Record<string, unknown> | null;
  alternativeDiagnoses?: string | null;
  impactPotential?: string | null;
  verificationSteps?: string | null;
  remediationRecommendations?: string | null;
  confidenceLevel: "LOW" | "MEDIUM" | "HIGH";
  status: "DRAFT" | "FINAL" | "SUPERSEDED";
}

interface DiagnosisCardProps {
  diagnosis: DiagnosisCardData;
}

export function DiagnosisCard({ diagnosis }: DiagnosisCardProps) {
  const confidenceColor: Record<string, string> = {
    HIGH: "bg-emerald-50 text-emerald-700 border-emerald-200",
    MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
    LOW: "bg-rose-50 text-rose-700 border-rose-200",
  };

  const statusColor: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
    FINAL: "bg-indigo-50 text-indigo-700 border-indigo-200",
    SUPERSEDED: "bg-zinc-100 text-zinc-600 border-zinc-200",
  };

  const formatEvidence = (evidence: Record<string, unknown> | null): string => {
    if (!evidence || Object.keys(evidence).length === 0) {
      return "No se registraron referencias explícitas.";
    }
    try {
      return JSON.stringify(evidence, null, 2);
    } catch {
      return String(evidence);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Diagnóstico Estructurado</h2>
          <p className="text-xs font-mono text-slate-500 mt-0.5">{diagnosis.id}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
              confidenceColor[diagnosis.confidenceLevel] || ""
            }`}
          >
            Confianza: {diagnosis.confidenceLevel}
          </span>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
              statusColor[diagnosis.status] || ""
            }`}
          >
            {diagnosis.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-500">
        <div>
          <span className="font-semibold text-slate-600">Generado por:</span>{" "}
          {diagnosis.generatedBy}
        </div>
        <div>
          <span className="font-semibold text-slate-600">Fecha:</span>{" "}
          {new Date(diagnosis.generatedAt).toLocaleString("es-ES", {
            timeZoneName: "short",
          })}
        </div>
      </div>

      <div className="space-y-3">
        <DiagnosisSection
          title="Hechos observados"
          icon={<FileText className="w-4 h-4 text-indigo-600" />}
          content={diagnosis.observedFacts}
          defaultOpen
        />

        <DiagnosisSection
          title="Causa probable"
          icon={<Lightbulb className="w-4 h-4 text-amber-600" />}
          content={diagnosis.probableCause}
        />

        <DiagnosisSection
          title="Evidencias de soporte"
          icon={<Shield className="w-4 h-4 text-emerald-600" />}
          content={formatEvidence(diagnosis.evidenceSupport ?? null)}
        />

        <DiagnosisSection
          title="Diagnósticos alternativos"
          icon={<AlertTriangle className="w-4 h-4 text-orange-500" />}
          content={diagnosis.alternativeDiagnoses}
        />

        <DiagnosisSection
          title="Impacto potencial"
          icon={<Activity className="w-4 h-4 text-rose-500" />}
          content={diagnosis.impactPotential}
        />

        <DiagnosisSection
          title="Pasos de verificación"
          icon={<Wrench className="w-4 h-4 text-slate-600" />}
          content={diagnosis.verificationSteps}
        />

        <DiagnosisSection
          title="Recomendaciones de solución"
          icon={<Wrench className="w-4 h-4 text-indigo-600" />}
          content={diagnosis.remediationRecommendations}
        />
      </div>
    </div>
  );
}