import { UserRole } from "../domain/server.types";

export interface LogEventPresenter {
  id: string;
  serverId: string | null;
  serverName: string | null;
  category: string;
  categoryName: string;
  eventTimestamp: Date;
  ingestionTimestamp: Date;
  processedTimestamp: Date | null;
  eventType: string | null;
  severity: string;
  sanitizedMessage: string;
  rawLog: string;
  metadata: Record<string, unknown> | null;
  isUntrusted: boolean;
}

export class LogPresenter {
  /**
   * Sanitiza y estructura un evento de log para su exposición en la API.
   * Garantiza que el rawLog nunca se devuelva a OBSERVADOR (Principio III y XIII).
   */
  public static toDto(event: LogEventPresenter, role: UserRole) {
    return {
      id: event.id,
      serverId: event.serverId,
      serverName: event.serverName,
      category: event.category,
      categoryName: event.categoryName,
      eventTimestamp: event.eventTimestamp,
      ingestionTimestamp: event.ingestionTimestamp,
      processedTimestamp: event.processedTimestamp,
      eventType: event.eventType,
      severity: event.severity,
      sanitizedMessage: event.sanitizedMessage,
      // El rawLog solo se devuelve a SUPERADMIN (Principio III)
      rawLog: role === "SUPERADMIN" ? event.rawLog : null,
      isUntrusted: event.isUntrusted,
      metadata: event.metadata,
    };
  }

  public static toListDto(
    events: LogEventPresenter[],
    role: UserRole
  ) {
    return events.map((e) => this.toDto(e, role));
  }
}
