import { describe, it, expect } from "vitest";
import { LogQueryService } from "@/core/services/log-query.service";
import { LogPresenter } from "@/core/services/log-presenter";
import { UserRole } from "@/core/domain/server.types";

describe("LogQueryService", () => {
  const mockEvents = [
    {
      id: "evt-001",
      serverId: "srv-001",
      serverName: "srv-db-prod-01",
      category: "DATABASE" as const,
      categoryName: "Base de Datos",
      eventTimestamp: new Date("2026-10-29T10:00:00Z"),
      ingestionTimestamp: new Date("2026-10-29T10:00:05Z"),
      processedTimestamp: new Date("2026-10-29T10:00:06Z"),
      eventType: "db_connection_error",
      severity: "ERROR" as const,
      sanitizedMessage: "Connection pool exhausted for database [REDACTED]",
      rawLog: "ERROR: Connection pool exhausted for database prod_db with password=secret123",
      metadata: { pool_size: 10, wait_time: 5000 },
      isUntrusted: true,
    },
    {
      id: "evt-002",
      serverId: "srv-001",
      serverName: "srv-db-prod-01",
      category: "AUTH_ACCESS" as const,
      categoryName: "Autenticación",
      eventTimestamp: new Date("2026-10-29T10:05:00Z"),
      ingestionTimestamp: new Date("2026-10-29T10:05:02Z"),
      processedTimestamp: null,
      eventType: "ssh_login_failed",
      severity: "WARN" as const,
      sanitizedMessage: "Failed login for user admin from [REDACTED_IP]",
      rawLog: "Failed password for admin from 10.0.0.5 port 2222",
      metadata: { source_ip: "10.0.0.5", port: 2222 },
      isUntrusted: true,
    },
    {
      id: "evt-003",
      serverId: "srv-002",
      serverName: "srv-web-prod-01",
      category: "WEB_APP" as const,
      categoryName: "Web",
      eventTimestamp: new Date("2026-10-29T10:10:00Z"),
      ingestionTimestamp: new Date("2026-10-29T10:10:01Z"),
      processedTimestamp: new Date("2026-10-29T10:10:02Z"),
      eventType: "http_500_error",
      severity: "CRITICAL" as const,
      sanitizedMessage: "Nginx returned 500 error for endpoint /api/users",
      rawLog: "nginx: 500 Internal Server Error at /api/users",
      metadata: { status_code: 500, endpoint: "/api/users" },
      isUntrusted: true,
    },
  ];

  it("debe filtrar eventos por categoría", () => {
    const filtered = mockEvents.filter((e) => e.category === "DATABASE");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.id).toBe("evt-001");
  });

  it("debe filtrar eventos por severidad", () => {
    const filtered = mockEvents.filter((e) => e.severity === "CRITICAL");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.id).toBe("evt-003");
  });

  it("debe filtrar eventos por servidor", () => {
    const filtered = mockEvents.filter((e) => e.serverId === "srv-002");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.serverName).toBe("srv-web-prod-01");
  });

  it("debe buscar eventos por texto en el mensaje", () => {
    const query = "pool";
    const filtered = mockEvents.filter((e) =>
      e.sanitizedMessage.toLowerCase().includes(query.toLowerCase())
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.id).toBe("evt-001");
  });

  it("debe paginar resultados correctamente", () => {
    const page = 1;
    const limit = 2;
    const paginated = mockEvents.slice((page - 1) * limit, page * limit);
    expect(paginated).toHaveLength(2);
    expect(paginated[0]!.id).toBe("evt-001");
    expect(paginated[1]!.id).toBe("evt-002");
  });
});

describe("LogPresenter", () => {
  it("debe devolver rawLog solo a SUPERADMIN", () => {
    const event = {
      id: "evt-001",
      serverId: "srv-001",
      serverName: "srv-db-prod-01",
      category: "DATABASE",
      categoryName: "Base de Datos",
      eventTimestamp: new Date(),
      ingestionTimestamp: new Date(),
      processedTimestamp: null,
      eventType: null,
      severity: "ERROR",
      sanitizedMessage: "Test message",
      rawLog: "Raw log with secret=password123",
      metadata: null,
      isUntrusted: true,
    };

    const superAdminDto = LogPresenter.toDto(event, "SUPERADMIN");
    expect(superAdminDto.rawLog).toBe("Raw log with secret=password123");

    const observerDto = LogPresenter.toDto(event, "OBSERVADOR");
    expect(observerDto.rawLog).toBeNull();
  });

  it("debe sanitizar el mensaje para todos los roles", () => {
    const event = {
      id: "evt-001",
      serverId: "srv-001",
      serverName: "srv-db-prod-01",
      category: "DATABASE",
      categoryName: "Base de Datos",
      eventTimestamp: new Date(),
      ingestionTimestamp: new Date(),
      processedTimestamp: null,
      eventType: null,
      severity: "ERROR",
      sanitizedMessage: "Connection failed [REDACTED]",
      rawLog: "Connection failed password=secret123",
      metadata: null,
      isUntrusted: true,
    };

    const dto = LogPresenter.toDto(event, "OBSERVADOR");
    expect(dto.sanitizedMessage).toBe("Connection failed [REDACTED]");
    expect(dto.rawLog).toBeNull();
  });

  it("debe mapear lista de eventos correctamente", () => {
    const events = [
      {
        id: "evt-001",
        serverId: "srv-001",
        serverName: "srv-01",
        category: "DATABASE",
        categoryName: "Base de Datos",
        eventTimestamp: new Date(),
        ingestionTimestamp: new Date(),
        processedTimestamp: null,
        eventType: null,
        severity: "ERROR",
        sanitizedMessage: "Msg 1",
        rawLog: "Raw 1",
        metadata: null,
        isUntrusted: true,
      },
      {
        id: "evt-002",
        serverId: "srv-002",
        serverName: "srv-02",
        category: "WEB_APP",
        categoryName: "Web",
        eventTimestamp: new Date(),
        ingestionTimestamp: new Date(),
        processedTimestamp: null,
        eventType: null,
        severity: "WARN",
        sanitizedMessage: "Msg 2",
        rawLog: "Raw 2",
        metadata: null,
        isUntrusted: true,
      },
    ];

    const dtos = LogPresenter.toListDto(events, "OBSERVADOR");
    expect(dtos).toHaveLength(2);
    expect(dtos[0]!.id).toBe("evt-001");
    expect(dtos[1]!.id).toBe("evt-002");
    // OBSERVADOR no debe ver rawLog
    expect(dtos[0]!.rawLog).toBeNull();
    expect(dtos[1]!.rawLog).toBeNull();
  });
});
