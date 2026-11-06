import { describe, expect, it } from "vitest";
import {
  contarSeccion,
  extraerPrimerPuertoPublicado,
  mapAgentPayloadToServiceCandidates,
  mapEstadoToServiceStatus,
  parseAgentJson,
} from "@/core/services/agent-payload-mapper";

/**
 * Contrato del agente recolector `scripts/nexo_agent.sh`:
 * stdout = JSON estricto con servidor_info + servicios_docker + servicios_systemd
 */
const payloadValido = `{
  "servidor_info": {
    "uptime": "42 days, 3 load",
    "cpu_usage_percent": 17,
    "ram_total_mb": 8192,
    "ram_used_mb": 4096
  },
  "servicios_docker": [
    { "nombre": "mi-app-web", "estado": "running", "puertos": "0.0.0.0:8080->80/tcp, [::]:8080->80/tcp", "imagen": "nginx:latest" },
    { "nombre": "cola", "estado": "exited", "puertos": "", "imagen": "rabbitmq:3" }
  ],
  "servicios_systemd": [
    { "nombre": "nginx.service", "estado": "active", "descripcion": "A high performance web server" },
    { "nombre": "postgresql.service", "estado": "inactive", "descripcion": "PostgreSQL RDBMS" },
    { "nombre": "backup.service", "estado": "failed", "descripcion": "Respaldo nocturno" }
  ]
}`;

describe("parseAgentJson", () => {
  it("acepta el JSON estricto del agente", () => {
    const payload = parseAgentJson(payloadValido);
    expect(payload).not.toBeNull();
    expect(Array.isArray(payload?.servicios_docker)).toBe(true);
    expect(Array.isArray(payload?.servicios_systemd)).toBe(true);
  });

  it("tolera BOM y espacios iniciales", () => {
    const payload = parseAgentJson(`\uFEFF  ${payloadValido}`);
    expect(payload).not.toBeNull();
  });

  it("rechaza stdout contaminado con texto no JSON", () => {
    expect(parseAgentJson("bash: warning: something\n{\"a\":1}")).toBeNull();
  });

  it("rechaza JSON de tipo arreglo o primitivo", () => {
    expect(parseAgentJson('[{"a":1}]')).toBeNull();
    expect(parseAgentJson('"texto"')).toBeNull();
    expect(parseAgentJson("42")).toBeNull();
  });

  it("rechaza vacío y null", () => {
    expect(parseAgentJson("")).toBeNull();
    expect(parseAgentJson("   \n  ")).toBeNull();
    expect(parseAgentJson(null as unknown as string)).toBeNull();
  });
});

describe("mapEstadoToServiceStatus", () => {
  it("mapea estados systemd", () => {
    expect(mapEstadoToServiceStatus("active")).toBe("RUNNING");
    expect(mapEstadoToServiceStatus("inactive")).toBe("STOPPED");
    expect(mapEstadoToServiceStatus("failed")).toBe("ERROR");
  });

  it("mapea estados de contenedores Docker", () => {
    expect(mapEstadoToServiceStatus("running")).toBe("RUNNING");
    expect(mapEstadoToServiceStatus("exited")).toBe("STOPPED");
    expect(mapEstadoToServiceStatus("created")).toBe("STOPPED");
    expect(mapEstadoToServiceStatus("paused")).toBe("STOPPED");
    expect(mapEstadoToServiceStatus("dead")).toBe("ERROR");
  });

  it("cauta por defecto: desconocidos → UNKNOWN", () => {
    expect(mapEstadoToServiceStatus("restarting")).toBe("UNKNOWN");
    expect(mapEstadoToServiceStatus("")).toBe("UNKNOWN");
    expect(mapEstadoToServiceStatus(undefined)).toBe("UNKNOWN");
    expect(mapEstadoToServiceStatus(42)).toBe("UNKNOWN");
  });
});

describe("extraerPrimerPuertoPublicado", () => {
  it("extrae el primer puerto host de la cadena de docker ps", () => {
    expect(extraerPrimerPuertoPublicado("0.0.0.0:8080->80/tcp, [::]:8080->80/tcp")).toBe(8080);
    expect(extraerPrimerPuertoPublicado("127.0.0.1:5432->5432/tcp")).toBe(5432);
  });

  it("devuelve null cuando no hay publicaciones", () => {
    expect(extraerPrimerPuertoPublicado("")).toBeNull();
    expect(extraerPrimerPuertoPublicado(null)).toBeNull();
    expect(extraerPrimerPuertoPublicado("80/tcp")).toBeNull();
  });

  it("valida rango de puertos", () => {
    expect(extraerPrimerPuertoPublicado("0.0.0.0:99999->80/tcp")).toBeNull();
  });
});

describe("contarSeccion", () => {
  it("cuenta entradas legibles con nombre", () => {
    expect(contarSeccion([{ nombre: "a" }, { estado: "x" }, "texto"], "nombre")).toBe(1);
    expect(contarSeccion(undefined, "nombre")).toBe(0);
    expect(contarSeccion([], "nombre")).toBe(0);
  });
});

describe("mapAgentPayloadToServiceCandidates", () => {
  it("mapea docker y systemd al contrato de ServerService", () => {
    const candidatos = mapAgentPayloadToServiceCandidates(parseAgentJson(payloadValido)!);

    expect(candidatos).toHaveLength(5);

    const docker = candidatos.filter((c) => c.origen === "DOCKER");
    const systemd = candidatos.filter((c) => c.origen === "SYSTEMD");
    expect(docker).toHaveLength(2);
    expect(systemd).toHaveLength(3);

    const app = docker.find((c) => c.name === "mi-app-web");
    expect(app).toMatchObject({
      name: "mi-app-web",
      status: "RUNNING",
      port: 8080,
      processName: "nginx:latest",
      description: "nginx:latest",
    });

    const cola = docker.find((c) => c.name === "cola");
    expect(cola).toMatchObject({ status: "STOPPED", port: null, processName: "rabbitmq:3" });

    const nginx = systemd.find((c) => c.name === "nginx.service");
    expect(nginx).toMatchObject({
      status: "RUNNING",
      description: "A high performance web server",
      port: null,
      processName: null,
    });

    expect(systemd.find((c) => c.name === "postgresql.service")?.status).toBe("STOPPED");
    expect(systemd.find((c) => c.name === "backup.service")?.status).toBe("ERROR");
  });

  it("ignora entradas sin nombre legible (defensa ante payload corrupto)", () => {
    const candidatos = mapAgentPayloadToServiceCandidates(
      parseAgentJson(`{
        "servicios_docker": [{ "nombre": "  ", "estado": "running" }, { "estado": "running" }, null, 42],
        "servicios_systemd": [{ "nombre": "nginx.service", "estado": "active" }]
      }`)!
    );
    expect(candidatos).toHaveLength(1);
    expect(candidatos[0]).toMatchObject({ name: "nginx.service", status: "RUNNING" });
  });

  it("devuelve arreglo vacío sin romper con secciones ausentes o corruptas", () => {
    const candidatos = mapAgentPayloadToServiceCandidates(
      parseAgentJson(`{ "servidor_info": {}, "servicios_docker": "no-soy-arreglo", "servicios_systemd": null }`)!
    );
    expect(candidatos).toEqual([]);
  });
});
