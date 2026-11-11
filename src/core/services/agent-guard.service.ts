/**
 * Guardián del agente: rate limiting por ventana deslizante + circuit breaker
 * por proveedor. Estado EN MEMORIA (instancia única): suficiente para el
 * despliegue actual y sin coste de round-trips a la BD en cada turno de chat.
 *
 * Reglas (Principio XI):
 *  - El breaker abre tras N fallos consecutivos de red/timeout/5xx del proveedor
 *    (por defecto 5), pasa a HALF_OPEN a los 30 s y cierra tras 1 éxito.
 *  - Los 4xx de configuración (401/404) NO abren el breaker: esperar no los arregla.
 *  - El rate limit rechaza ANTES de llamar al proveedor, con segundos de reintento.
 */

const WINDOW_MS = 60_000;
const DAY_MS = 24 * 60 * 60_000;

export interface ProviderLimits {
  rateLimitPerMinute: number | null;
  rateLimitPerDay: number | null;
}

export interface RateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  limit: number | null;
  window: "minute" | "day";
}

export class RateLimitedError extends Error {
  public readonly retryAfterSeconds: number;
  public readonly limit: number | null;
  public readonly window: "minute" | "day";
  constructor(retryAfterSeconds: number, limit: number | null, window: "minute" | "day") {
    super(`Límite de uso excedido (${window}). Reintenta en ${retryAfterSeconds}s.`);
    this.name = "RateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
    this.limit = limit;
    this.window = window;
  }
}

export class CircuitOpenError extends Error {
  public readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super(`El proveedor está fallando repetidamente; circuito abierto. Reintenta en ${retryAfterSeconds}s.`);
    this.name = "CircuitOpenError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

interface ProviderGuardState {
  /** Timestamps (ms) de las llamadas permitidas en la ventana del minuto. */
  minuteHits: number[];
  /** Mapa día-UTC → llamadas permitidas. */
  dayHits: Map<string, number>;
  breaker: {
    state: "CLOSED" | "OPEN" | "HALF_OPEN";
    consecutiveFailures: number;
    openedAt: number | null;
  };
}

const BREAKER_FAILURE_THRESHOLD = 5;
const BREAKER_COOLDOWN_MS = 30_000;

export class AgentGuardService {
  private static states = new Map<string, ProviderGuardState>();

  private static stateFor(providerId: string): ProviderGuardState {
    let state = this.states.get(providerId);
    if (!state) {
      state = {
        minuteHits: [],
        dayHits: new Map(),
        breaker: { state: "CLOSED", consecutiveFailures: 0, openedAt: null },
      };
      this.states.set(providerId, state);
    }
    return state;
  }

  /** Resetea el estado del guardián (p. ej. al reconfigurar el proveedor). */
  public static reset(providerId: string): void {
    this.states.delete(providerId);
  }

  // ── Rate limiting ───────────────────────────────────────────────────────────

  /**
   * Verifica los límites del proveedor ANTES de llamarlo. Si pasa, registra la
   * llamada (petición permitida). Lanza RateLimitedError si excede el límite.
   */
  public static checkAndRecordRateLimit(providerId: string, limits: ProviderLimits): void {
    const state = this.stateFor(providerId);
    const now = Date.now();

    if (limits.rateLimitPerMinute !== null) {
      state.minuteHits = state.minuteHits.filter((t) => now - t < WINDOW_MS);
      if (state.minuteHits.length >= limits.rateLimitPerMinute) {
        const oldest = state.minuteHits[0] ?? now;
        const retry = Math.max(1, Math.ceil((WINDOW_MS - (now - oldest)) / 1000));
        throw new RateLimitedError(retry, limits.rateLimitPerMinute, "minute");
      }
    }

    if (limits.rateLimitPerDay !== null) {
      const dayKey = new Date(now).toISOString().slice(0, 10);
      const used = state.dayHits.get(dayKey) ?? 0;
      if (used >= limits.rateLimitPerDay) {
        // Reintento sugerido: hasta el próximo reset de medianoche UTC.
        const nextDayStart = Math.ceil(now / DAY_MS) * DAY_MS;
        const retry = Math.max(1, Math.ceil((nextDayStart - now) / 1000));
        throw new RateLimitedError(Math.min(retry, 3600), limits.rateLimitPerDay, "day");
      }
      state.dayHits.set(dayKey, used + 1);
      // Higiene: no acumular días viejos indefinidamente.
      if (state.dayHits.size > 3) {
        for (const key of state.dayHits.keys()) {
          if (key !== dayKey) state.dayHits.delete(key);
        }
      }
    }

    if (limits.rateLimitPerMinute !== null) {
      state.minuteHits.push(now);
    }
  }

  // ── Circuit breaker ─────────────────────────────────────────────────────────

  /**
   * Lanzar antes de cada llamada al proveedor. OPEN rechaza sin tocar la red;
   * HALF_OPEN permite exactamente un intento de prueba.
   */
  public static assertBreakerAllows(providerId: string): void {
    const breaker = this.stateFor(providerId).breaker;
    if (breaker.state === "CLOSED") return;

    if (breaker.state === "OPEN") {
      const elapsed = Date.now() - (breaker.openedAt ?? 0);
      if (elapsed < BREAKER_COOLDOWN_MS) {
        const retry = Math.max(1, Math.ceil((BREAKER_COOLDOWN_MS - elapsed) / 1000));
        throw new CircuitOpenError(retry);
      }
      // Enfriamiento cumplido: un intento de prueba.
      breaker.state = "HALF_OPEN";
      return;
    }

    // HALF_OPEN: se permite el intento en curso; recordFailure/recordSuccess deciden.
  }

  /** Registra un fallo del proveedor (red, timeout o 5xx). */
  public static recordFailure(providerId: string): void {
    const breaker = this.stateFor(providerId).breaker;
    breaker.consecutiveFailures += 1;
    if (breaker.state === "HALF_OPEN" || breaker.consecutiveFailures >= BREAKER_FAILURE_THRESHOLD) {
      breaker.state = "OPEN";
      breaker.openedAt = Date.now();
    }
  }

  /** Registra un turno exitoso: cierra el breaker y limpia el contador de fallos. */
  public static recordSuccess(providerId: string): void {
    const breaker = this.stateFor(providerId).breaker;
    breaker.state = "CLOSED";
    breaker.consecutiveFailures = 0;
    breaker.openedAt = null;
  }

  /** ¿Fallo que debe contar para el breaker? Solo red/timeout/5xx; no 4xx de config. */
  public static countsForBreaker(status: number | null): boolean {
    return status === null || status >= 500;
  }
}
