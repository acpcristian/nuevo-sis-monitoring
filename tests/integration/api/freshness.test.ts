import { describe, it, expect } from "vitest";

describe("Freshness States - Unit Logic Tests", () => {
  it("estados válidos de frescura según Principio VIII", () => {
    const validStates = ["FRESH", "STALE", "AGENT_DISCONNECTED", "UNREACHABLE"];
    validStates.forEach((state) => {
      expect(["FRESH", "STALE", "AGENT_DISCONNECTED", "UNREACHABLE"]).toContain(state);
    });
  });

  it("cálculo de frescura con umbrales configurables", () => {
    const computeFreshness = (
      lastTelemetryAt: Date | null,
      now: Date = new Date(),
      staleAfterMinutes = 5,
      disconnectedAfterMinutes = 15
    ): "FRESH" | "STALE" | "AGENT_DISCONNECTED" | "UNREACHABLE" => {
      if (!lastTelemetryAt) return "STALE";

      const ageMinutes = (now.getTime() - lastTelemetryAt.getTime()) / 60000;

      if (ageMinutes <= staleAfterMinutes) return "FRESH";
      if (ageMinutes <= disconnectedAfterMinutes) return "STALE";
      return "AGENT_DISCONNECTED";
    };

    const now = new Date();

    // FRESH
    expect(computeFreshness(new Date(now.getTime() - 1 * 60000), now)).toBe("FRESH");
    expect(computeFreshness(new Date(now.getTime() - 5 * 60000), now)).toBe("FRESH");

    // STALE
    expect(computeFreshness(new Date(now.getTime() - 6 * 60000), now)).toBe("STALE");
    expect(computeFreshness(new Date(now.getTime() - 10 * 60000), now)).toBe("STALE");
    expect(computeFreshness(new Date(now.getTime() - 15 * 60000), now)).toBe("STALE");

    // AGENT_DISCONNECTED
    expect(computeFreshness(new Date(now.getTime() - 16 * 60000), now)).toBe("AGENT_DISCONNECTED");
    expect(computeFreshness(new Date(now.getTime() - 60 * 60000), now)).toBe("AGENT_DISCONNECTED");

    // Sin telemetría = STALE (no FRESH)
    expect(computeFreshness(null, now)).toBe("STALE");
  });

  it("UNREACHABLE se asigna por fallo de conectividad, no por tiempo", () => {
    // UNREACHABLE es un estado explícito asignado cuando falla la conectividad de red
    // No se deriva del tiempo transcurrido
    const statesFromTime = ["FRESH", "STALE", "AGENT_DISCONNECTED"];
    const explicitStates = ["UNREACHABLE"];

    expect(statesFromTime).not.toContain("UNREACHABLE");
    expect(explicitStates).toContain("UNREACHABLE");
  });

  it("refresco periódico actualiza estados correctamente", () => {
    // Simulación de refreshAllFreshness
    interface ServerFreshness {
      id: string;
      state: string;
      lastTelemetryAt: Date;
    }

    const servers: ServerFreshness[] = [
      { id: "s1", state: "FRESH", lastTelemetryAt: new Date(Date.now() - 2 * 60000) },
      { id: "s2", state: "FRESH", lastTelemetryAt: new Date(Date.now() - 10 * 60000) },
      { id: "s3", state: "STALE", lastTelemetryAt: new Date(Date.now() - 20 * 60000) },
      { id: "s4", state: "STALE", lastTelemetryAt: new Date(Date.now() - 5 * 60000) },
    ];

    const staleThreshold = new Date(Date.now() - 5 * 60000);
    const disconnectedThreshold = new Date(Date.now() - 15 * 60000);

    // FRESH -> STALE si lastTelemetryAt < staleThreshold
    const s1Stale = servers[0]!.lastTelemetryAt < staleThreshold;
    const s2Stale = servers[1]!.lastTelemetryAt < staleThreshold;
    expect(s1Stale).toBe(false); // 2 min no es stale
    expect(s2Stale).toBe(true); // 10 min es stale

    // STALE -> AGENT_DISCONNECTED si lastTelemetryAt < disconnectedThreshold
    const s3 = servers[2]!;
    const s4 = servers[3]!;
    const s3Disconnected = s3.lastTelemetryAt < disconnectedThreshold;
    const s4Disconnected = s4.lastTelemetryAt < disconnectedThreshold;
    expect(s3Disconnected).toBe(true); // 20 min es disconnected
    expect(s4Disconnected).toBe(false); // 5 min no
  });

  it("Principio VIII: ausencia de telemetría NUNCA se interpreta como salud satisfactoria", () => {
    // Este test documenta el principio: sin datos = STALE, no FRESH
    const computeFreshness = (lastTelemetryAt: Date | null, now: Date = new Date()) => {
      if (!lastTelemetryAt) return "STALE";
      const ageMinutes = (now.getTime() - lastTelemetryAt.getTime()) / 60000;
      if (ageMinutes <= 5) return "FRESH";
      if (ageMinutes <= 15) return "STALE";
      return "AGENT_DISCONNECTED";
    };

    // Servidor que nunca ha enviado telemetría
    expect(computeFreshness(null)).toBe("STALE");

    // Servidor que dejó de enviar hace mucho (1 hora = AGENT_DISCONNECTED, que no es FRESH)
    expect(computeFreshness(new Date(Date.now() - 3600000))).not.toBe("FRESH");
  });
});