"use client";

import React, { useEffect, useState, use, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Server,
  Key,
  Shield,
  Activity,
  Wrench,
  Trash2,
  Play,
  Clock,
  Tag,
  AlertCircle,
  Loader2,
  Plus,
  RefreshCw,
  Cpu,
} from "lucide-react";
import { ServerStatusBadge } from "@/components/servers/ServerStatusBadge";
import { MaintenanceModal } from "@/components/servers/MaintenanceModal";
import { DecommissionDialog } from "@/components/servers/DecommissionDialog";
import { ServiceCard, ServiceItem, ServiceEmptyState } from "@/components/servers/ServiceCard";

interface ServerDetail {
  id: string;
  name: string;
  ipAddress: string;
  hostname?: string | null;
  osType: "LINUX" | "WINDOWS" | "OTHER";
  osVersion?: string | null;
  environment: "PROD" | "STAGING" | "DEV" | "QA";
  connectionPort: number;
  technicalOwner?: string | null;
  description?: string | null;
  lifecycleState: "ACTIVE" | "MAINTENANCE" | "DISABLED" | "RETIRED";
  healthStatus: "ONLINE" | "DEGRADED" | "UNREACHABLE" | "AUTH_FAILED" | "PENDING";
  hasCredential: boolean;
  credentialSummary?: {
    type: string;
    username: string;
    keyFingerprint?: string | null;
    lastRotatedAt: string;
  } | null;
  tags?: Array<{ key: string; value: string }>;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt?: string | null;
  lastSeenAt?: string | null;
  recentChecks?: Array<{
    id: string;
    eventTimestamp: string;
    durationMs: number;
    resultStatus: string;
    diagnosticSummary?: string | null;
  }>;
}

export default function ServerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const serverId = resolvedParams.id;
  const router = useRouter();

  const [server, setServer] = useState<ServerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [probeMessage, setProbeMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Services state
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [showAddService, setShowAddService] = useState(false);
  const [servicesPollingInterval, setServicesPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [addServiceForm, setAddServiceForm] = useState({ name: "", description: "", port: "", endpoint: "", processName: "" });
  const [addingService, setAddingService] = useState(false);

  // Modals state
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);
  const [isDecommissionOpen, setIsDecommissionOpen] = useState(false);

  const fetchServer = async () => {
    try {
      const res = await fetch(`/api/v1/servers/${serverId}`, {
      });
      if (!res.ok) {
        throw new Error("No se pudo cargar la información del servidor.");
      }
      const data = await res.json();
      setServer(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServer();
  }, [serverId]);

  // Fetch services for this server
  const fetchServices = useCallback(async () => {
    try {
      setServicesLoading(true);
      const res = await fetch(`/api/v1/servers/${serverId}/services`);
      if (!res.ok) {
        throw new Error("No se pudo cargar los servicios del servidor.");
      }
      const data = await res.json();
      setServices(data.items || []);
      setServicesError(null);
    } catch (err: unknown) {
      setServicesError(err instanceof Error ? err.message : String(err));
    } finally {
      setServicesLoading(false);
    }
  }, [serverId]);

  // Start polling for services when server is loaded
  useEffect(() => {
    if (!loading && server) {
      fetchServices();
      // Poll every 30 seconds for real-time updates
      const interval = setInterval(fetchServices, 30000);
      setServicesPollingInterval(interval);
      return () => {
        if (interval) clearInterval(interval);
        setServicesPollingInterval(null);
      };
    }
  }, [serverId, loading, server, fetchServices]);

  const handleTestConnection = async () => {
    setProbing(true);
    setProbeMessage(null);
    try {
      const res = await fetch(`/api/v1/servers/${serverId}/test-connection`, {
        method: "POST",
      });
      const data = await res.json();
      setProbeMessage(`Prueba completada: ${data.status} en ${data.durationMs} ms. ${data.diagnosticSummary || ""}`);
      fetchServer();
    } catch {
      setProbeMessage("Error al ejecutar la prueba de conectividad.");
    } finally {
      setProbing(false);
    }
  };

  const handleAddService = async () => {
    setAddingService(true);
    try {
      const res = await fetch(`/api/v1/servers/${serverId}/services`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addServiceForm.name,
          description: addServiceForm.description,
          port: addServiceForm.port ? parseInt(addServiceForm.port, 10) : undefined,
          endpoint: addServiceForm.endpoint,
          processName: addServiceForm.processName,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Error al crear el servicio");
      }
      setShowAddService(false);
      setAddServiceForm({ name: "", description: "", port: "", endpoint: "", processName: "" });
      fetchServices();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setAddingService(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-slate-800">Error al cargar servidor</h2>
        <p className="text-sm text-slate-500 mt-1 mb-4">{error || "El servidor solicitado no existe."}</p>
        <Link href="/servers" className="text-sm text-indigo-600 hover:underline">
          Volver al inventario
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      {/* Barra superior de navegación */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <Link
            href="/servers"
            className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver al Inventario
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{server.name}</h1>
            <ServerStatusBadge healthStatus={server.healthStatus} lifecycleState={server.lifecycleState} />
          </div>
          <p className="text-xs font-mono text-slate-500 mt-0.5">
            {server.ipAddress}:{server.connectionPort} {server.hostname ? `(${server.hostname})` : ""}
          </p>
        </div>

        {/* Acciones del SUPERADMIN */}
        <div className="flex flex-wrap gap-2 items-center">
          <button
            onClick={handleTestConnection}
            disabled={probing || server.lifecycleState === "RETIRED"}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
          >
            {probing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 text-emerald-600" />}
            {probing ? "Comprobando..." : "Probar Conectividad"}
          </button>

          <button
            onClick={() => setIsMaintenanceOpen(true)}
            disabled={server.lifecycleState === "RETIRED"}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm disabled:opacity-50"
          >
            <Wrench className="w-3.5 h-3.5 text-blue-600" />
            Ciclo de Vida
          </button>

          {server.lifecycleState !== "RETIRED" && (
            <button
              onClick={() => setIsDecommissionOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition shadow-sm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Retirar Servidor
            </button>
          )}
        </div>
      </div>

      {probeMessage && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs text-indigo-800 flex items-center gap-2">
          <Activity className="w-4 h-4 shrink-0 text-indigo-600" />
          <span>{probeMessage}</span>
        </div>
      )}

      {/* Grid de detalles técnicos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Columna 1: Datos de Servidor */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
            <Server className="w-4 h-4 text-indigo-600" />
            Especificación del Nodo
          </h3>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Sistema Operativo:</span>
              <span className="font-medium text-slate-800">{server.osType} {server.osVersion || ""}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Entorno Lógico:</span>
              <span className="font-medium text-slate-800">{server.environment}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Puerto de Sondeo:</span>
              <span className="font-mono text-slate-800">{server.connectionPort}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-50">
              <span className="text-slate-500">Responsable Técnico:</span>
              <span className="text-slate-800">{server.technicalOwner || "No asignado"}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Ciclo de Vida:</span>
              <span className="font-semibold text-slate-800">{server.lifecycleState}</span>
            </div>
          </div>

          {server.description && (
            <div className="pt-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
              <div className="font-medium text-slate-700 mb-1">Descripción:</div>
              {server.description}
            </div>
          )}
        </div>

        {/* Columna 2: Credencial de Conexión (Principio III) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
            <Key className="w-4 h-4 text-indigo-600" />
            Credencial Técnica (Protegida)
          </h3>

          {server.hasCredential && server.credentialSummary ? (
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-indigo-900">{server.credentialSummary.type}</span>
                  <span className="text-[10px] bg-indigo-200/60 text-indigo-800 px-1.5 py-0.5 rounded font-mono">
                    AES-256-GCM
                  </span>
                </div>
                <div className="text-slate-600">
                  Usuario técnico: <span className="font-mono font-medium text-slate-800">{server.credentialSummary.username}</span>
                </div>
                {server.credentialSummary.keyFingerprint && (
                  <div className="text-[11px] font-mono text-slate-500 truncate" title={server.credentialSummary.keyFingerprint}>
                    Huella: {server.credentialSummary.keyFingerprint}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Las claves y contraseñas nunca se devuelven en claro (Principio III).</span>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 py-6 text-center">
              No hay credencial técnica asociada a este servidor.
            </div>
          )}

          {/* Etiquetas */}
          <div className="pt-2 border-t border-slate-100">
            <div className="text-xs font-medium text-slate-700 mb-2 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-slate-400" />
              Etiquetas del Servidor
            </div>
            {server.tags && server.tags.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {server.tags.map((t, idx) => (
                  <span key={idx} className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono">
                    {t.key}={t.value}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-xs text-slate-400">Sin etiquetas asignadas</span>
            )}
          </div>
        </div>

        {/* Columna 3: Trazabilidad y Fechas (Principio VI) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
            <Clock className="w-4 h-4 text-indigo-600" />
            Marcas Temporales
          </h3>

          <div className="space-y-2.5 text-xs">
            <div>
              <div className="text-slate-400 text-[11px]">Última Comprobación:</div>
              <div className="font-medium text-slate-800 mt-0.5">
                {server.lastCheckedAt
                  ? new Date(server.lastCheckedAt).toLocaleString("es-ES", { timeZoneName: "short" })
                  : "Pendiente"}
              </div>
            </div>

            <div>
              <div className="text-slate-400 text-[11px]">Última Respuesta Exitosa:</div>
              <div className="font-medium text-slate-800 mt-0.5">
                {server.lastSeenAt
                  ? new Date(server.lastSeenAt).toLocaleString("es-ES", { timeZoneName: "short" })
                  : "Sin registro"}
              </div>
            </div>

            <div>
              <div className="text-slate-400 text-[11px]">Fecha de Alta en Inventario:</div>
              <div className="text-slate-600 mt-0.5">
                {new Date(server.createdAt).toLocaleString("es-ES", { timeZoneName: "short" })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Historial de Sondeos Recientes */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-600" />
            Historial de Comprobaciones Recientes (Solo Lectura)
          </h3>
          <span className="text-xs text-slate-500">Últimos 10 eventos</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Fecha y Hora</th>
                <th className="py-2.5 px-4">Resultado</th>
                <th className="py-2.5 px-4">Latencia (ms)</th>
                <th className="py-2.5 px-4">Resumen de Diagnóstico</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!server.recentChecks || server.recentChecks.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-slate-400">
                    No hay comprobaciones registradas para este servidor.
                  </td>
                </tr>
              ) : (
                server.recentChecks.map((chk) => (
                  <tr key={chk.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 font-mono">
                      {new Date(chk.eventTimestamp).toLocaleString("es-ES", { timeZoneName: "short" })}
                    </td>
                    <td className="py-2.5 px-4 font-semibold">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          chk.resultStatus === "SUCCESS"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}
                      >
                        {chk.resultStatus}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-mono">{chk.durationMs} ms</td>
                    <td className="py-2.5 px-4 text-slate-500">{chk.diagnosticSummary || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Servicios del Servidor */}
      <div className="bg-white rounded-2xl shadow-soft border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-600 rounded-xl shadow-medium">
                <Cpu className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Servicios del Servidor</h2>
                <p className="text-xs text-slate-500">Monitoreo de procesos y daemons en {server.name}</p>
              </div>
            </div>
            <button
              onClick={() => setShowAddService(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition shadow-medium hover:shadow-large"
            >
              <Plus className="w-4 h-4" />
              Agregar Servicio
            </button>
          </div>
        </div>

        <div className="p-6">
          {servicesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
            </div>
          ) : servicesError ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-sm shadow-soft">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Error al cargar servicios</p>
                <p className="text-rose-700 mt-0.5">{servicesError}</p>
                <button
                  onClick={fetchServices}
                  className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reintentar
                </button>
              </div>
            </div>
          ) : services.length === 0 ? (
            <ServiceEmptyState />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {services.map((service) => (
                <ServiceCard key={service.id} service={service} onRefresh={fetchServices} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Agregar Servicio */}
      {showAddService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => { setShowAddService(false); setAddServiceForm({ name: "", description: "", port: "", endpoint: "", processName: "" }); }}>
          <div className="bg-white rounded-2xl shadow-large w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Agregar Servicio</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                <input
                  type="text"
                  value={addServiceForm.name}
                  onChange={(e) => setAddServiceForm({ ...addServiceForm, name: e.target.value })}
                  placeholder="Ej: nginx, postgresql, docker"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                <textarea
                  value={addServiceForm.description}
                  onChange={(e) => setAddServiceForm({ ...addServiceForm, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Puerto</label>
                <input
                  type="number"
                  min="1"
                  max="65535"
                  value={addServiceForm.port}
                  onChange={(e) => setAddServiceForm({ ...addServiceForm, port: e.target.value })}
                  placeholder="80, 443, 5432..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Endpoint</label>
                <input
                  type="url"
                  value={addServiceForm.endpoint}
                  onChange={(e) => setAddServiceForm({ ...addServiceForm, endpoint: e.target.value })}
                  placeholder="http://localhost:8080/health"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del proceso</label>
                <input
                  type="text"
                  value={addServiceForm.processName}
                  onChange={(e) => setAddServiceForm({ ...addServiceForm, processName: e.target.value })}
                  placeholder="nginx, postgres, docker"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => { setShowAddService(false); setAddServiceForm({ name: "", description: "", port: "", endpoint: "", processName: "" }); }}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddService}
                disabled={addingService || !addServiceForm.name.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl"
              >
                {addingService && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar Servicio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modales */}
      <MaintenanceModal
        serverId={server.id}
        serverName={server.name}
        currentState={server.lifecycleState}
        isOpen={isMaintenanceOpen}
        onClose={() => setIsMaintenanceOpen(false)}
        onSuccess={fetchServer}
      />

      <DecommissionDialog
        serverId={server.id}
        serverName={server.name}
        isOpen={isDecommissionOpen}
        onClose={() => setIsDecommissionOpen(false)}
        onSuccess={() => router.push("/servers")}
      />
    </div>
  );
}

