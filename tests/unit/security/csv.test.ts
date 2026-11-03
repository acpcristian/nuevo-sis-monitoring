import { describe, it, expect } from "vitest";
import { escapeCsvValue, toCsv } from "@/shared/utils/csv";

describe("009 — Serialización CSV", () => {
  it("escapa comas, comillas y saltos de línea según RFC 4180", () => {
    expect(escapeCsvValue("simple")).toBe("simple");
    expect(escapeCsvValue("con,coma")).toBe('"con,coma"');
    expect(escapeCsvValue('con "comillas"')).toBe('"con ""comillas"""');
    expect(escapeCsvValue("linea1\nlinea2")).toBe('"linea1\nlinea2"');
    expect(escapeCsvValue("a;b")).toBe('"a;b"');
  });

  it("trata null y undefined como celda vacía", () => {
    expect(escapeCsvValue(null)).toBe("");
    expect(escapeCsvValue(undefined)).toBe("");
  });

  it("respeta el orden de columnas indicado y agrega cabeceras", () => {
    const csv = toCsv(
      [
        { fecha: "2026-11-03", actor: "admin", accion: "LOGIN_SUCCESS" },
        { fecha: "2026-11-02", actor: "observador", accion: "LOGIN_FAILED" },
      ],
      [
        { key: "accion", header: "Acción" },
        { key: "actor", header: "Actor" },
      ]
    );

    expect(csv.split("\r\n")).toEqual([
      "Acción,Actor",
      "LOGIN_SUCCESS,admin",
      "LOGIN_FAILED,observador",
    ]);
  });

  it("deriva las cabeceras de la primera fila cuando no se indican columnas", () => {
    const csv = toCsv([{ a: 1, b: "x,y" }]);
    expect(csv).toBe('a,b\r\n1,"x,y"');
  });
});
