"use client";

import React, { useState } from "react";
import { Server, Key, Shield, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const SERVICIO_OPTIONS = [
  "Aplicaciones",
  "Base de datos",
  "Archivos",
  "Respaldo",
  "Virtualización",
] as const;

interface ServerFormProps {
  onSuccess?: (server: unknown) => void;
  onCancel?: () => void;
  /** Secretaría preasignada (cuando se abre desde la vista de una secretaría). */
  defaultSecretaria?: string;
  /** Sugerencias para el campo de secretaría (etiquetas ya registradas). */
  secretariaOptions?: string[];
  /** Modo modal: sin encabezado ni sombra (los pone el contenedor). */
  embedded?: boolean;
}

export function ServerForm({
  onSuccess,
  onCancel,
  defaultSecretaria,
  secretariaOptions = [],
  embedded = false,
}: ServerFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [hostname, setHostname] = useState("");
  const [osType, setOsType] = useState<"LINUX" | "WINDOWS" | "OTHER">("LINUX");
  const [osVersion, setOsVersion] = useState("Ubuntu 24.04");
  const [environment, setEnvironment] = useState<"PROD" | "STAGING" | "DEV" | "QA">("PROD");
  const [connectionPort, setConnectionPort] = useState(22);
  const [technicalOwner, setTechnicalOwner] = useState("");
  const [description, setDescription] = useState("");

  // Credential State
  const [includeCredential, setIncludeCredential] = useState(true);
  const [credentialType, setCredentialType] = useState<"SSH_KEY" | "PASSWORD">("SSH_KEY");
  const [username, setUsername] = useState("mon-user");
  const [secretValue, setSecretValue] = useState("");
  const [passphrase, setPassphrase] = useState("");

  // Tags State
  const [secretaria, setSecretaria] = useState(defaultSecretaria ?? "");
  const [servicio, setServicio] = useState("");
  const [tagsInput, setTagsInput] = useState("");

  const handleOsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as "LINUX" | "WINDOWS" | "OTHER";
    setOsType(val);
    if (val === "LINUX") {
      setConnectionPort(22);
      setCredentialType("SSH_KEY");
      setOsVersion("Ubuntu 24.04");
    } else if (val === "WINDOWS") {
      setConnectionPort(5986);
      setCredentialType("PASSWORD");
      setOsVersion("Windows Server 2022");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSecretValue((event.target?.result as string) || "");
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    // Parsear tags; secretaría y servicio se aplican como etiquetas de
    // agrupación (reemplazan cualquier valor previo de las mismas claves).
    const parsedTags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.includes("="))
      .map((t) => {
        const [k, ...v] = t.split("=");
        return { key: k?.trim() || "", value: v.join("=").trim() };
      })
      .filter((tag) => {
        const normalized = tag.key.toLowerCase().replace(/í/g, "i");
        return normalized !== "secretaria" && normalized !== "servicio";
      });
    const tags = [
      ...parsedTags,
      ...(secretaria.trim() ? [{ key: "secretaria", value: secretaria.trim() }] : []),
      ...(servicio.trim() ? [{ key: "servicio", value: servicio.trim() }] : []),
    ];

    const payload = {
      name,
      ipAddress,
      hostname: hostname || undefined,
      osType,
      osVersion: osVersion || undefined,
      environment,
      connectionPort: Number(connectionPort),
      technicalOwner: technicalOwner || undefined,
      description: description || undefined,
      credential: includeCredential
        ? {
            credentialType,
            username,
            secretValue,
            passphrase: passphrase || undefined,
          }
        : undefined,
      tags,
    };

    try {
      const res = await fetch("/api/v1/servers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Error al registrar servidor");
      }

      setSuccessMsg(`Servidor '${data.name}' dado de alta exitosamente con estado inicial: ${data.healthStatus}`);
      if (onSuccess) {
        onSuccess(data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`bg-white rounded-xl space-y-6 ${
        embedded ? "p-0" : "shadow-sm border border-slate-200 p-6"
      }`}
    >
      {!embedded && (
        <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Registrar Nuevo Servidor</h2>
            <p className="text-sm text-slate-500">
              Añadir nodo al inventario con verificación segura de conectividad en modo solo lectura.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-3 text-rose-700 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 text-emerald-700 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Datos Básicos de Red */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="server-name" className="block text-sm font-medium text-slate-700 mb-1">Nombre Identificativo *</label>
          <input
            id="server-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="srv-prod-web-01"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </div>

        <div>
          <label htmlFor="server-ip" className="block text-sm font-medium text-slate-700 mb-1">Dirección IP o Hostname *</label>
          <input
            id="server-ip"
            type="text"
            required
            value={ipAddress}
            onChange={(e) => setIpAddress(e.target.value)}
            placeholder="192.168.10.15"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Sistema Operativo *</label>
          <select
            value={osType}
            onChange={handleOsChange}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
          >
            <option value="LINUX">Linux (SSH)</option>
            <option value="WINDOWS">Windows Server (WinRM / TCP)</option>
            <option value="OTHER">Otro Sistema Operativo</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Distribución / Versión</label>
          <input
            type="text"
            value={osVersion}
            onChange={(e) => setOsVersion(e.target.value)}
            placeholder="Ubuntu 24.04 LTS"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Entorno Operativo *</label>
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as "PROD" | "STAGING" | "DEV" | "QA")}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
          >
            <option value="PROD">Producción (PROD)</option>
            <option value="STAGING">Staging / Pre-producción</option>
            <option value="DEV">Desarrollo (DEV)</option>
            <option value="QA">Control de Calidad (QA)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Puerto de Conexión *</label>
          <input
            type="number"
            required
            value={connectionPort}
            onChange={(e) => setConnectionPort(Number(e.target.value))}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
          />
        </div>
      </div>

      {/* Credenciales de Acceso Seguro (Principio III) */}
      <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-800">Credencial Técnica de Sondeo</h3>
          </div>
          <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
            <Shield className="w-3 h-3" /> Cifrado AES-256-GCM
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Usuario Técnico *</label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="mon-user"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tipo de Secreto</label>
            <select
              value={credentialType}
              onChange={(e) => setCredentialType(e.target.value as "SSH_KEY" | "PASSWORD")}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              <option value="SSH_KEY">Clave Privada SSH (Recomendado)</option>
              <option value="PASSWORD">Contraseña de Servicio</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-1">
            <label htmlFor="server-secret" className="block text-xs font-medium text-slate-600">
              {credentialType === "SSH_KEY" ? "Clave Privada PEM *" : "Contraseña en Claro *"}
            </label>
            {credentialType === "SSH_KEY" && (
              <label className="text-xs text-indigo-600 hover:underline cursor-pointer">
                Cargar archivo .pem / .key
                <input type="file" onChange={handleFileUpload} className="hidden" accept=".pem,.key,.txt" />
              </label>
            )}
          </div>
          <textarea
            id="server-secret"
            required
            rows={4}
            value={secretValue}
            onChange={(e) => setSecretValue(e.target.value)}
            placeholder={
              credentialType === "SSH_KEY"
                ? "-----BEGIN OPENSSH PRIVATE KEY-----\n..."
                : "Introduce la contraseña segura de servicio..."
            }
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono bg-white"
          />
        </div>

        {credentialType === "SSH_KEY" && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Passphrase de la Clave (opcional)</label>
            <input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Opcional si la clave está protegida"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            />
          </div>
        )}
      </div>

      {/* Secretaría municipal y servicio (agrupaciones) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="server-secretaria" className="block text-sm font-medium text-slate-700 mb-1">
            Secretaría municipal *
          </label>
          <input
            id="server-secretaria"
            type="text"
            required
            value={secretaria}
            onChange={(e) => setSecretaria(e.target.value)}
            list="secretaria-options"
            placeholder="Secretaría de Hacienda"
            aria-describedby="secretaria-help"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
          />
          <datalist id="secretaria-options">
            {secretariaOptions.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <p id="secretaria-help" className="mt-1 text-[11px] text-slate-400">
            Agrupa el servidor dentro de su secretaría en el panel de contenedores.
          </p>
        </div>
        <div>
          <label htmlFor="server-servicio" className="block text-sm font-medium text-slate-700 mb-1">
            Servicio principal *
          </label>
          <select
            id="server-servicio"
            required
            value={servicio}
            onChange={(e) => setServicio(e.target.value)}
            aria-describedby="servicio-help"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm bg-white"
          >
            <option value="">Selecciona un servicio</option>
            {SERVICIO_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <p id="servicio-help" className="mt-1 text-[11px] text-slate-400">
            Función principal del equipo en la infraestructura.
          </p>
        </div>
      </div>

      {/* Metadatos adicionales */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Responsable Técnico</label>
          <input
            type="text"
            value={technicalOwner}
            onChange={(e) => setTechnicalOwner(e.target.value)}
            placeholder="Equipo InfraOps / dba-team@corp.local"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Etiquetas (clave=valor, separadas por coma)</label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="datacenter=us-east, tier=backend"
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Descripción / Propósito</label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Notas operativas, criticidad o servicios alojados..."
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
        />
      </div>

      {/* Botones de Acción */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            Cancelar
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition flex items-center gap-2 disabled:opacity-50"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Verificando y Guardando..." : "Dar de Alta Servidor"}
        </button>
      </div>
    </form>
  );
}

