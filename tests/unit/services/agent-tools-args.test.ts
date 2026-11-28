import { describe, it, expect, vi, afterEach } from "vitest";
import { AgentToolsService } from "@/core/services/agent-tools.service";

/**
 * Regresión: el servidor MCP y el chat entregan los argumentos ya parseados
 * (objeto). Antes `execute` solo los leía si venían como string JSON, así que
 * los filtros del agente (p. ej. `categoria="despacho"`) se descartaban y el
 * inventario se devolvía completo. Hermes respondía "no existe esa categoría".
 */
type InventoryExecutor = (args: Record<string, unknown>) => Promise<unknown>;
const serviceInternals = AgentToolsService as unknown as { consultarInventario: InventoryExecutor };

describe("AgentToolsService.execute — argumentos de las tools", () => {
  afterEach(() => vi.restoreAllMocks());

  it("acepta argumentos ya parseados en objeto (MCP / chat)", async () => {
    const spy = vi.spyOn(serviceInternals, "consultarInventario").mockResolvedValue({ total: 0 });
    await AgentToolsService.execute("consultar_inventario", { categoria: "despacho" });
    expect(spy).toHaveBeenCalledWith({ categoria: "despacho" });
  });

  it("sigue aceptando argumentos como string JSON", async () => {
    const spy = vi.spyOn(serviceInternals, "consultarInventario").mockResolvedValue({ total: 0 });
    await AgentToolsService.execute("consultar_inventario", '{"categoria":"despacho"}');
    expect(spy).toHaveBeenCalledWith({ categoria: "despacho" });
  });

  it("devuelve error controlado si el string no es JSON válido", async () => {
    const result = (await AgentToolsService.execute("consultar_inventario", "{no-json")) as { error: string };
    expect(result.error).toContain("JSON");
  });
});
