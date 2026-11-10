"use client";

import { useState, useCallback } from "react";

/** Props del componente de botón de notificación Telegram. */
interface TelegramNotificationButtonProps {
  /** Texto a mostrar en el botón. */
  label?: string;
  /** Mensaje por defecto a enviar (puede ser sobrescrito por el usuario). */
  defaultMessage?: string;
  /** Nombre de usuario opcional para incluir en la notificación. */
  userName?: string;
  /** Clases Tailwind adicionales para personalizar el botón. */
  className?: string;
  /** Deshabilitar el botón. */
  disabled?: boolean;
}

/**
 * Componente de botón para enviar notificaciones a Telegram.
 * Hace POST a /api/telegram y maneja estados de carga/éxito/error.
 */
export function TelegramNotificationButton({
  label = "Enviar a Telegram",
  defaultMessage = "Notificación de prueba desde la plataforma",
  userName,
  className = "",
  disabled = false,
}: TelegramNotificationButtonProps): React.JSX.Element {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleClick = useCallback(async () => {
    if (isLoading || disabled) return;

    setIsLoading(true);
    setLastResult(null);

    try {
      const response = await fetch("/api/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: defaultMessage, userName }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const successMsg = `✅ Enviado correctamente (Message ID: ${data.messageId})`;
        setLastResult({ type: "success", message: successMsg });
        console.log("[TelegramNotificationButton] Éxito:", data);
      } else {
        const errorMsg = `❌ Error: ${data.message ?? "Error desconocido"}`;
        setLastResult({ type: "error", message: errorMsg });
        console.error("[TelegramNotificationButton] Error:", data);
      }
    } catch (error) {
      const errorMsg = `❌ Error de red: ${error instanceof Error ? error.message : "Error desconocido"}`;
      setLastResult({ type: "error", message: errorMsg });
      console.error("[TelegramNotificationButton] Excepción:", error);
    } finally {
      setIsLoading(false);
      // Limpiar mensaje después de 5 segundos
      setTimeout(() => setLastResult(null), 5000);
    }
  }, [isLoading, disabled, defaultMessage, userName]);

  const baseClasses =
    "inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg " +
    "transition-all duration-200 ease-out focus:outline-none focus:ring-2 focus:ring-offset-2 " +
    "disabled:opacity-50 disabled:cursor-not-allowed";

  const variantClasses = isLoading
    ? "bg-blue-600 text-white cursor-wait"
    : "bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 " +
      "focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600";

  const resultClasses = lastResult
    ? lastResult.type === "success"
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400"
    : "text-gray-500 dark:text-gray-400";

  return (
    <div className={`inline-flex flex-col gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading || disabled}
        className={`${baseClasses} ${variantClasses}`}
        aria-busy={isLoading}
        aria-label={isLoading ? "Enviando notificación..." : label}
      >
        {isLoading ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>Enviando...</span>
          </>
        ) : (
          <>
            <svg
              className="h-4 w-4"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
            </svg>
            <span>{label}</span>
          </>
        )}
      </button>

      {lastResult && (
        <p
          className={`text-xs font-medium ${resultClasses} animate-fade-in`}
          role="status"
          aria-live="polite"
        >
          {lastResult.message}
        </p>
      )}

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.2s ease-out; }
      `}</style>
    </div>
  );
}