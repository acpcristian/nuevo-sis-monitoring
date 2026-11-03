/**
 * Dominio de apariencia: tipos, presets y generación de tokens CSS.
 * Sin dependencias de Prisma ni de Node para poder importarse desde cliente.
 */

export const THEME_PRESETS = [
  { id: "indigo", label: "Índigo", color: "#4f46e5" },
  { id: "ocean", label: "Océano", color: "#0284c7" },
  { id: "emerald", label: "Esmeralda", color: "#059669" },
  { id: "violet", label: "Violeta", color: "#7c3aed" },
  { id: "rose", label: "Rubí", color: "#e11d48" },
  { id: "amber", label: "Ámbar", color: "#d97706" },
  { id: "graphite", label: "Grafito", color: "#475569" },
] as const;

export type PresetId = (typeof THEME_PRESETS)[number]["id"];
export type ThemePresetId = PresetId | "custom";
export type ThemeMode = "light" | "dark";
export type ThemeDensity = "comfortable" | "compact";

export interface Theme {
  preset: ThemePresetId;
  primaryColor: string;
  mode: ThemeMode;
  radius: number;
  density: ThemeDensity;
}

export const DEFAULT_THEME: Theme = {
  preset: "indigo",
  primaryColor: "#4f46e5",
  mode: "light",
  radius: 8,
  density: "comfortable",
};

export function isValidHexColor(value: string): boolean {
  return /^#?[0-9a-fA-F]{6}$/.test(value.trim());
}

/** Normaliza a `#rrggbb` en minúsculas; null si no es un color válido. */
export function normalizeHexColor(value: string): string | null {
  const raw = value.trim();
  if (!/^#?[0-9a-fA-F]{6}$/.test(raw)) return null;
  return (raw.startsWith("#") ? raw : `#${raw}`).toLowerCase();
}

export function presetById(id: string): (typeof THEME_PRESETS)[number] | null {
  return THEME_PRESETS.find((preset) => preset.id === id) ?? null;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace("#", "");
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function toHex(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Mezcla `b` sobre `a` con el peso indicado (0 = a, 1 = b). */
function mix(a: string, b: string, weight: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const w = Math.max(0, Math.min(1, weight));
  return rgbToHex(
    ca.r + (cb.r - ca.r) * w,
    ca.g + (cb.g - ca.g) * w,
    ca.b + (cb.b - ca.b) * w
  );
}

export function lighten(hex: string, amount: number): string {
  return mix(hex, "#ffffff", amount);
}

export function darken(hex: string, amount: number): string {
  return mix(hex, "#000000", amount);
}

function channelLuminance(channel: number): number {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Texto legible (blanco o casi negro) sobre el color principal. */
export function contrastOn(hex: string): string {
  return contrastRatio(hex, "#ffffff") >= contrastRatio(hex, "#0b1220")
    ? "#ffffff"
    : "#0b1220";
}

export function resolveTheme(input: Partial<Theme> | null | undefined): Theme {
  const preset = (input?.preset ?? DEFAULT_THEME.preset) as ThemePresetId;
  const knownPreset = presetById(preset);

  const primarySource = knownPreset
    ? knownPreset.color
    : normalizeHexColor(input?.primaryColor ?? "") ?? DEFAULT_THEME.primaryColor;

  const mode: ThemeMode = input?.mode === "dark" ? "dark" : "light";
  const density: ThemeDensity = input?.density === "compact" ? "compact" : "comfortable";

  const radiusValue = Number.isFinite(input?.radius) ? Number(input?.radius) : DEFAULT_THEME.radius;

  return {
    preset: knownPreset ? (preset as PresetId) : "custom",
    primaryColor: primarySource,
    mode,
    radius: Math.min(16, Math.max(0, Math.round(radiusValue))),
    density,
  };
}

const LIGHT_TOKENS: Record<string, string> = {
  "--surface-0": "#f8fafc",
  "--surface-1": "#ffffff",
  "--surface-2": "#f1f5f9",
  "--surface-3": "#e8eef6",
  "--surface-4": "#dbe3ee",
  "--border-1": "#f1f5f9",
  "--border-2": "#e2e8f0",
  "--border-3": "#cbd5e1",
  "--text-1": "#0f172a",
  "--text-2": "#475569",
  "--text-3": "#64748b",
  "--text-4": "#94a3b8",
  "--neutral-400": "#94a3b8",
  "--inverse-surface": "#0f172a",
};

const DARK_TOKENS: Record<string, string> = {
  "--surface-0": "#0b1220",
  "--surface-1": "#111a2e",
  "--surface-2": "#16213a",
  "--surface-3": "#1b2942",
  "--surface-4": "#24334f",
  "--border-1": "#1c2740",
  "--border-2": "#26334d",
  "--border-3": "#3a4a68",
  "--text-1": "#e6edf7",
  "--text-2": "#b6c2d6",
  "--text-3": "#8fa0b8",
  "--text-4": "#64748b",
  "--neutral-400": "#64748b",
  "--inverse-surface": "#050a14",
};

/** Variables CSS que materializan un tema (se inyectan en <html>). */
export function themeVars(theme: Theme): Record<string, string> {
  const primary = theme.primaryColor;
  const tokens = theme.mode === "dark" ? DARK_TOKENS : LIGHT_TOKENS;

  return {
    "--primary-50": lighten(primary, 0.93),
    "--primary-100": lighten(primary, 0.86),
    "--primary-200": lighten(primary, 0.7),
    "--primary-300": lighten(primary, 0.5),
    "--primary-400": lighten(primary, 0.28),
    "--primary-500": lighten(primary, 0.12),
    "--primary-600": primary,
    "--primary-700": darken(primary, 0.16),
    "--primary-800": darken(primary, 0.3),
    "--primary-900": darken(primary, 0.42),
    "--primary-contrast": contrastOn(primary),
    "--radius-md": `${Math.round(theme.radius * 0.75)}px`,
    "--radius-lg": `${theme.radius}px`,
    "--radius-xl": `${Math.round(theme.radius * 1.5)}px`,
    "--radius-2xl": `${theme.radius * 2}px`,
    ...tokens,
  };
}

/** Tamaño base de fuente según densidad (se usa en <html data-density>). */
export function densityFontSize(density: ThemeDensity): string {
  return density === "compact" ? "15px" : "16px";
}
