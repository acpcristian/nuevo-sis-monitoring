import { describe, it, expect } from "vitest";
import {
  DEFAULT_THEME,
  contrastOn,
  normalizeHexColor,
  resolveTheme,
  themeVars,
} from "@/core/domain/theme";

describe("010 — Dominio de apariencia", () => {
  it("normaliza colores hex válidos y rechaza formatos incorrectos", () => {
    expect(normalizeHexColor("4F46E5")).toBe("#4f46e5");
    expect(normalizeHexColor(" #0284c7 ")).toBe("#0284c7");
    expect(normalizeHexColor("#fff")).toBeNull();
    expect(normalizeHexColor("indigo")).toBeNull();
  });

  it("un preset conocido impone su color y descarta un hex manual", () => {
    const theme = resolveTheme({ preset: "ocean", primaryColor: "#ff0000" });
    expect(theme.preset).toBe("ocean");
    expect(theme.primaryColor).toBe("#0284c7");
  });

  it("acepta color personalizado y cae al valor por defecto si es inválido", () => {
    expect(resolveTheme({ preset: "custom", primaryColor: "#123abc" }).primaryColor).toBe("#123abc");
    expect(resolveTheme({ preset: "custom", primaryColor: "no-es-color" }).primaryColor).toBe(
      DEFAULT_THEME.primaryColor
    );
    expect(resolveTheme({ preset: "custom", primaryColor: "#123abc" }).preset).toBe("custom");
  });

  it("acota el radio y normaliza modo y densidad", () => {
    expect(resolveTheme({ radius: -4 }).radius).toBe(0);
    expect(resolveTheme({ radius: 99 }).radius).toBe(16);
    expect(resolveTheme({ radius: 7.6 }).radius).toBe(8);
    expect(resolveTheme({ mode: "dark" }).mode).toBe("dark");
    expect(resolveTheme({ mode: "otro" as never }).mode).toBe("light");
    expect(resolveTheme({ density: "compact" }).density).toBe("compact");
  });

  it("genera la escala del color principal y tokens de radio", () => {
    const theme = resolveTheme({ preset: "custom", primaryColor: "#4f46e5", radius: 10 });
    const vars = themeVars(theme);

    expect(vars["--primary-600"]).toBe("#4f46e5");
    expect(vars["--primary-50"]).not.toBe(vars["--primary-900"]);
    expect(vars["--radius-lg"]).toBe("10px");
    expect(vars["--radius-md"]).toBe("8px");
    expect(vars["--radius-xl"]).toBe("15px");
    expect(vars["--surface-1"]).toBe("#ffffff");
  });

  it("cambia las superficies al modo oscuro", () => {
    const light = themeVars(resolveTheme({ mode: "light" }));
    const dark = themeVars(resolveTheme({ mode: "dark" }));

    expect(light["--surface-0"]).not.toBe(dark["--surface-0"]);
    expect(light["--text-1"]).not.toBe(dark["--text-1"]);
    expect(dark["--surface-1"]).toBe("#111a2e");
  });

  it("elige texto legible sobre el color principal", () => {
    expect(contrastOn("#4f46e5")).toBe("#ffffff");
    expect(contrastOn("#fde047")).toBe("#0b1220");
  });
});
