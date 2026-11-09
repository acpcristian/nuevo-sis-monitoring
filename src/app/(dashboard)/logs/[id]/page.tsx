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
} from "lucide-react";
import { LogEventDetail } from "@/components/logs/LogEventDetail";

interface LogEventDetailData {
  id: string;
  serverId: string | null;
  serverName: string | null;
  serverIp: string | null;
  serviceId: string | null;
  serviceName: string | null;
  serviceStatus: string | null;
  servicePort: number | null;
  serviceEndpoint: string | null;
  category: string;
  categoryName: string;
  categoryDescription?: string | null;
  categoryCommonCauses?: string | null;
  categorySolutions?: string | null;
  eventTimestamp: string;
  ingestionTimestamp: string;
  processedTimestamp: string | null;
  eventType: string | null;
  severity: string;
  sanitizedMessage: string;
  rawLog: string | null;
  isUntrusted: boolean;
  metadata: Record<string, unknown> | null;
}

export default function LogEventPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const logId = resolvedParams.id;
  const router = useRouter();

  const [event, setEvent] = useState<LogEventDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvent = async () => {
    try {
      const res = await fetch(`/api/v1/logs/${logId}`, {
      });
      if (!res.ok) {
        throw new Error("No se pudo cargar el evento de log");
      }
      const data = await res.json();
      setEvent(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvent();
  }, [logId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-slate-800">Error al cargar evento</h2>
        <p className="text-sm text-slate-500 mt-1 mb-4">{error || "El evento de log solicitado no existe."}</p>
        <a href="/logs" className="text-sm text-indigo-600 hover:underline">
          Volver a los logs
        </a>
      </div>
    );
  }

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
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Evento de Log
            </h1>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                event.severity === "INFO"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : event.severity === "WARN"
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : event.severity === "ERROR"
                  ? "bg-rose-50 text-rose-700 border-rose-200"
                  : "bg-rose-100 text-rose-800 border-rose-200"
              }`}
            >
              {event.severity}
            </span>
          </div>
          <p className="text-xs font-mono text-slate-500 mt-0.5">
            {event.id}
          </p>
        </div>
      </div>

      <LogEventDetail event={event} canViewRaw={true} />
    </div>
  );
}
