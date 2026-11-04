import { describe, it, expect } from "vitest";
import { deriveGlobalStatus } from "@/core/domain/server.types";
import { MonitorServersSchema } from "@/shared/validations/server.schema";

describe("Dominio: semáforo global de servidores", () => {
  it("marca ONLINE cuando el host responde y todos los servicios están RUNNING", () => {
    expect(
      deriveGlobalStatus({
        healthStatus: "ONLINE",
        lifecycleState: "ACTIVE",
        services: [{ status: "RUNNING" }, { status: "RUNNING" }],
      })
    ).toBe("ONLINE");
  });

  it("marca WARNING cuando el host responde pero un servicio está caído", () => {
    expect(
      deriveGlobalStatus({
        healthStatus: "DEGRADED",
        lifecycleState: "ACTIVE",
        services: [{ status: "RUNNING" }, { status: "STOPPED" }],
      })
    ).toBe("WARNING");
  });

  it("marca WARNING ante servicios UNKNOWN (sin puerto/endpoint verificable)", () => {
    expect(
      deriveGlobalStatus({
        healthStatus: "ONLINE",
        lifecycleState: "ACTIVE",
        services: [{ status: "UNKNOWN" }],
      })
    ).toBe("WARNING");
  });

  it("marca OFFLINE cuando el host es inalcanzable o falló la autenticación", () => {
    expect(
      deriveGlobalStatus({ healthStatus: "UNREACHABLE", lifecycleState: "ACTIVE", services: [] })
    ).toBe("OFFLINE");
    expect(
      deriveGlobalStatus({ healthStatus: "AUTH_FAILED", lifecycleState: "ACTIVE", services: [] })
    ).toBe("OFFLINE");
  });

  it("no monitorea servidores fuera de ACTIVE", () => {
    expect(
      deriveGlobalStatus({
        healthStatus: "ONLINE",
        lifecycleState: "MAINTENANCE",
        services: [{ status: "RUNNING" }],
      })
    ).toBe("PENDING");
    expect(
      deriveGlobalStatus({ healthStatus: "UNREACHABLE", lifecycleState: "RETIRED", services: [] })
    ).toBe("PENDING");
  });
});

describe("Validación: payload de monitoreo", () => {
  it("acepta ids y force, y aplica force=false por defecto", () => {
    const parsed = MonitorServersSchema.parse({ ids: ["srv-1"], force: true });
    expect(parsed.force).toBe(true);
    expect(MonitorServersSchema.parse({ ids: ["srv-1"] }).force).toBe(false);
  });

  it("rechaza más de 100 ids en una sola petición", () => {
    expect(
      MonitorServersSchema.safeParse({ ids: Array.from({ length: 101 }, (_, i) => `srv-${i}`) })
        .success
    ).toBe(false);
  });
});
