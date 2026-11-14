import { describe, it, expect, vi, afterEach } from "vitest";
import { McpService } from "@/core/services/mcp.service";
import { AuditService } from "@/core/services/audit.service";

/**
 * Tests del protocolo JSON-RPC 2.0 del servidor MCP (estadoless).
 * El executor de tools se inyecta vía spy del método executeTool para no
 * tocar la base de datos: aquí se prueba EL PROTOCOLO, no los executors.
 * La auditoría también se mockea (no hay BD en tests unitarios).
 */
const fakeExecutor = async (name: string, args: Record<string, unknown>) => ({ tool: name, args });
const ctx = { keyName: "test-key" };

const auditSpy = vi.spyOn(AuditService, "recordEvent").mockResolvedValue(undefined);
afterEach(() => auditSpy.mockClear());

describe("Servidor MCP (JSON-RPC 2.0 estadoless)", () => {
  it("initialize responde con protocolVersion, capabilities.tools y serverInfo", async () => {
    const res = await McpService.handleRequest(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } },
      ctx
    );
    expect(res.httpStatus).toBe(200);
    const result = (res.body as { result: Record<string, unknown> }).result;
    expect(result.protocolVersion).toBe("2025-06-18");
    expect(result.serverInfo).toMatchObject({ name: "nuevo-sis-monitoring" });
    expect(result.capabilities).toEqual({ tools: { listChanged: false } });
  });

  it("initialize hace fallback a la versión por defecto si el cliente pide una desconocida", async () => {
    const res = await McpService.handleRequest(
      { jsonrpc: "2.0", id: "a", method: "initialize", params: { protocolVersion: "1999-01-01" } },
      ctx
    );
    const result = (res.body as { result: { protocolVersion: string } }).result;
    expect(result.protocolVersion).toBe("2025-06-18");
  });

  it("notifications/initialized (sin id) responde 202 sin cuerpo", async () => {
    const res = await McpService.handleRequest(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      ctx
    );
    expect(res.httpStatus).toBe(202);
    expect(res.body).toBeNull();
  });

  it("ping responde resultado vacío", async () => {
    const res = await McpService.handleRequest({ jsonrpc: "2.0", id: 7, method: "ping" }, ctx);
    expect(res.httpStatus).toBe(200);
    expect(res.body).toMatchObject({ jsonrpc: "2.0", id: 7, result: {} });
  });

  it("tools/list expone tools de lectura + crear_incidente + estado_general con inputSchema", async () => {
    const res = await McpService.handleRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" }, ctx);
    const { tools } = (res.body as { result: { tools: { name: string; inputSchema: unknown }[] } }).result;
    const names = tools.map((t) => t.name);
    for (const expected of [
      "consultar_inventario",
      "detalle_servidor",
      "consultar_logs",
      "consultar_alertas",
      "consultar_incidentes",
      "crear_incidente",
      "estado_general",
    ]) {
      expect(names).toContain(expected);
    }
    const crear = tools.find((t) => t.name === "crear_incidente");
    expect(crear?.inputSchema).toMatchObject({ type: "object", required: ["titulo", "descripcion"] });
  });

  it("tools/call exitoso devuelve content[0].text JSON con isError=false", async () => {
    const spy = vi.spyOn(McpService, "executeTool").mockImplementation(fakeExecutor);
    try {
      const res = await McpService.handleRequest(
        { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "consultar_alertas", arguments: {} } },
        ctx
      );
      const result = (res.body as { result: { isError: boolean; content: { type: string; text: string }[] } }).result;
      expect(result.isError).toBe(false);
      expect(result.content[0]?.type).toBe("text");
      expect(JSON.parse(result.content[0]?.text ?? "")).toEqual({ tool: "consultar_alertas", args: {} });
    } finally {
      spy.mockRestore();
    }
  });

  it("tools/call con tool desconocida devuelve isError=true y mensaje descriptivo", async () => {
    const res = await McpService.handleRequest(
      { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "controlar_servicio", arguments: {} } },
      ctx
    );
    const result = (res.body as { result: { isError: boolean; content: { text: string }[] } }).result;
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("desconocida");
  });

  it("crear_incidente con argumentos inválidos falla validación SIN tocar la BD", async () => {
    const res = await McpService.handleRequest(
      {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "crear_incidente", arguments: { titulo: "corto", descripcion: "desc" } },
      },
      ctx
    );
    const result = (res.body as { result: { isError: boolean; content: { text: string }[] } }).result;
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain("al menos 5 caracteres");
  });

  it("método desconocido con id devuelve error -32601", async () => {
    const res = await McpService.handleRequest({ jsonrpc: "2.0", id: 9, method: "resources/list" }, ctx);
    expect(res.httpStatus).toBe(200);
    expect(res.body).toMatchObject({ id: 9, error: { code: -32601 } });
  });

  it("jsonrpc inválido devuelve error -32600", async () => {
    const res = await McpService.handleRequest({ jsonrpc: "1.0", id: 10, method: "ping" }, ctx);
    expect(res.body).toMatchObject({ error: { code: -32600 } });
  });
});
