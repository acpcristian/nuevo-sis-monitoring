export interface CsvColumn {
  key: string;
  header: string;
}

/**
 * Escapa un valor según RFC 4180: comillas dobles cuando contiene separador,
 * comilla, salto de línea o punto y coma (compatibilidad con planillas locales).
 */
export function escapeCsvValue(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  return /[",\n\r;]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

/**
 * Serializa filas a CSV. Si se pasan `columns`, se respeta ese orden y se usan
 * esas cabeceras; si no, se derivan de la primera fila.
 */
export function toCsv(rows: Record<string, unknown>[], columns?: CsvColumn[]): string {
  const keys = columns?.map((column) => column.key) ?? (rows[0] ? Object.keys(rows[0]) : []);
  const headers = columns?.map((column) => column.header) ?? keys;
  const lines = [headers.map(escapeCsvValue).join(",")];

  for (const row of rows) {
    lines.push(keys.map((key) => escapeCsvValue(row[key])).join(","));
  }

  return lines.join("\r\n");
}
