"use client";

import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Server,
  Shield,
  Clock,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Download,
} from "lucide-react";
import { DiagnosisCard } from "@/components/diagnosis/DiagnosisCard";
import { DiagnosisForm } from "@/components/diagnosis/DiagnosisForm";

interface DiagnosisDetailData {
  id: string;
  generatedBy: string;
  generatedAt: string;
  eventIds: string[];
  observedFacts: string;
  probableCause: string;
  evidenceSupport: Record<string, unknown>;
  alternativeDiagnoses: string | null;
  impactPotential: string | null;
  verificationSteps: string | null;
  remediationRecommendations: string | null;
  confidenceLevel: "LOW" | "MEDIUM" | "HIGH";
  status: "DRAFT" | "FINAL" | "SUPERSEDED";
  events: Array<{
    id: string;
    serverId: string | null;
    serverName: string | null;
    category: string;
    severity: string;
    eventTimestamp: string;
    sanitizedMessage: string;
  }>;
}

export default function DiagnosisDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const diagnosisId = resolvedParams.id;
  const router = useRouter();

  const [diagnosis, setDiagnosis] = useState<DiagnosisDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchDiagnosis = async () => {
    try {
      const res = await fetch(`/api/v1/diagnoses/${diagnosisId}`, {
      });
      if (!res.ok) {
        if (res.status === 404) throw new Error("NOT_FOUND");
        throw new Error("No se pudo cargar el diagnóstico");
      }
      const data = await res.json();
      setDiagnosis(data);
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "NOT_FOUND") {
        setError("El diagnóstico solicitado no existe.");
      } else {
        setError(err instanceof Error ? err.message : "Error al cargar diagnóstico");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("¿Está seguro de eliminar este diagnóstico? Esta acción no se puede deshacer.")) {
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/diagnoses/${diagnosisId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Error al eliminar diagnóstico");
      router.push("/logs");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
  };

  const handleDiagnosisCreated = (newId: string) => {
    router.push(`/logs/diagnosis/${newId}`);
  };

  useEffect(() => {
    fetchDiagnosis();
  }, [diagnosisId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !diagnosis) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-slate-800">Error al cargar diagnóstico</h2>
        <p className="text-sm text-slate-500 mt-1 mb-4">{error || "El diagnóstico solicitado no existe."}</p>
        <a href="/logs" className="text-sm text-indigo-600 hover:underline">
          Volver a los Logs
        </a>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "FINAL":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "SUPERSEDED":
        return "bg-slate-100 text-slate-700 border-slate-200";
      default:
        return "bg-amber-50 text-amber-700 border-amber-200";
    }
  };

  const getConfidenceColor = (level: string) => {
    switch (level) {
      case "HIGH":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "MEDIUM":
        return "bg-amber-50 text-amber-700 border-amber-200";
      default:
        return "bg-rose-50 text-rose-700 border-rose-200";
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <a
            href="/logs"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver a los Logs
          </a>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Diagnóstico Estructurado
            </h1>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-medium ${getStatusColor(diagnosis.status)}`}
            >
              {diagnosis.status}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-medium ${getConfidenceColor(diagnosis.confidenceLevel)}`}
            >
              Confianza: {diagnosis.confidenceLevel}
            </span>
          </div>
          <p className="text-xs font-mono text-slate-500 mt-0.5">
            {diagnosis.id}
          </p>
          <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
            <span>Generado por: {diagnosis.generatedBy}</span>
            <span>•</span>
            <span>{new Date(diagnosis.generatedAt).toLocaleString()}</span>
            <span>•</span>
            <span>{diagnosis.eventIds.length} evento(s) relacionado(s)</span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
          >
            <Edit className="w-3.5 h-3.5" />
            Nuevo Diagnóstico
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5 inline" />
            Eliminar
          </button>
        </div>
      </div>

      {showForm && (
        <DiagnosisForm
          onClose={handleFormClose}
          onDiagnosisCreated={handleDiagnosisCreated}
        />
      )}

      <DiagnosisCard diagnosis={diagnosis} />
    </div>
  );
}