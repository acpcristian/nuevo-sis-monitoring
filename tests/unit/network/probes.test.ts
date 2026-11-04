import net from "node:net";
import http from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { TcpProbe } from "@/infrastructure/network/tcp-probe";
import { HttpProbe } from "@/infrastructure/network/http-probe";

const tcpServers: net.Server[] = [];
const httpServers: http.Server[] = [];

async function listenTcp(): Promise<number> {
  const server = net.createServer((socket) => socket.end());
  tcpServers.push(server);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No se obtuvo un puerto TCP");
  return address.port;
}

async function listenHttp(): Promise<number> {
  const server = http.createServer((request, response) => {
    if (request.url === "/fail") {
      response.statusCode = 503;
      response.end("unavailable");
      return;
    }
    if (request.url === "/slow") {
      // No responde: deja que el timeout del probe corte la petición.
      return;
    }
    response.statusCode = 200;
    response.end("ok");
  });

  httpServers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    // Sin host: escucha en IPv4 e IPv6 para que el alias "localhost" sea válido.
    server.listen(0, () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No se obtuvo un puerto HTTP");
  return address.port;
}

afterEach(async () => {
  await Promise.all(
    tcpServers.splice(0).map(
      (server) => new Promise<void>((resolve) => server.close(() => resolve()))
    )
  );
  await Promise.all(
    httpServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        })
    )
  );
});

describe("TcpProbe: sondeo real de puertos", () => {
  it("detecta un puerto abierto", async () => {
    const port = await listenTcp();
    const result = await TcpProbe.probe({ host: "127.0.0.1", port, timeoutMs: 1000 });

    expect(result.status).toBe("SUCCESS");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("clasifica un puerto cerrado como REFUSED", async () => {
    const port = await listenTcp();
    await new Promise<void>((resolve) => tcpServers.pop()?.close(() => resolve()));

    const result = await TcpProbe.probe({ host: "127.0.0.1", port, timeoutMs: 1000 });
    expect(result.status).toBe("REFUSED");
  });
});

describe("HttpProbe: health endpoint con anti-SSRF", () => {
  it("marca RUNNING ante HTTP 2xx del mismo host", async () => {
    const port = await listenHttp();
    const result = await HttpProbe.probe({
      url: `http://127.0.0.1:${port}/health`,
      allowedHosts: ["127.0.0.1"],
      timeoutMs: 1000,
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.httpStatus).toBe(200);
  });

  it("marca ERROR ante HTTP 5xx", async () => {
    const port = await listenHttp();
    const result = await HttpProbe.probe({
      url: `http://127.0.0.1:${port}/fail`,
      allowedHosts: ["127.0.0.1"],
      timeoutMs: 1000,
    });

    expect(result.status).toBe("ERROR");
    expect(result.httpStatus).toBe(503);
  });

  it("bloquea un endpoint cuyo host no pertenece al servidor", async () => {
    const port = await listenHttp();
    const result = await HttpProbe.probe({
      url: `http://example.com:${port}/health`,
      allowedHosts: ["127.0.0.1"],
      timeoutMs: 1000,
    });

    expect(result.status).toBe("BLOCKED");
  });

  it("acepta el alias localhost cuando el servidor es loopback", async () => {
    const port = await listenHttp();
    const result = await HttpProbe.probe({
      url: `http://localhost:${port}/health`,
      allowedHosts: ["127.0.0.1"],
      timeoutMs: 1000,
    });

    expect(result.status).toBe("SUCCESS");
  });

  it("corta por timeout sin colgarse", async () => {
    const port = await listenHttp();
    const startedAt = Date.now();
    const result = await HttpProbe.probe({
      url: `http://127.0.0.1:${port}/slow`,
      allowedHosts: ["127.0.0.1"],
      timeoutMs: 300,
    });

    expect(result.status).toBe("TIMEOUT");
    expect(Date.now() - startedAt).toBeLessThan(2000);
  });
});
