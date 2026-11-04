/**
 * Event bus liviano para notificar cambios en el catálogo de servidores.
 *
 * Permite que formularios/modales en otras rutas (alta, retire, ciclo de vida)
 * disparen un refresco inmediato de la página principal sin depender de una
 navegación dura que pueda ser cacheada por Next.js.
 */
const listeners = new Set<() => void>();

export function onCatalogChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitCatalogChange(): void {
  for (const fn of listeners) {
    try {
      fn();
    } catch (error) {
      console.error("[catalog-events] listener falló:", error);
    }
  }
}