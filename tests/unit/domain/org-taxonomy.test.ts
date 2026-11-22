import { describe, it, expect } from "vitest";
import {
  ORG_CATEGORY_SEEDS,
  ORG_UNIT_SEEDS,
  SECRETARIA_CATALOG,
  buildOrgUnitIndex,
  normalizeOrgTags,
  normalizedSecretariaKey,
  resolveOrgUnit,
  slugifyOrgCategory,
} from "@/core/domain/org-taxonomy";

const units = [
  { id: "u1", name: "SECRETARÍA MUNICIPAL DE ADMINISTRACIÓN Y FINANZAS" },
  { id: "u2", name: "SECRETARÍA MUNICIPAL DE SALUD" },
];

describe("Taxonomía organizacional", () => {
  it("expone el catálogo institucional en orden y con categoría", () => {
    expect(SECRETARIA_CATALOG).toHaveLength(ORG_UNIT_SEEDS.length);
    expect(SECRETARIA_CATALOG[0]).toBe("DESPACHO MUNICIPAL");
    expect(SECRETARIA_CATALOG[1]).toBe("SECRETARÍA MUNICIPAL DE GESTIÓN INSTITUCIONAL");
    expect(ORG_CATEGORY_SEEDS.map((category) => category.slug)).toContain("despacho");
    expect(ORG_CATEGORY_SEEDS.map((category) => category.slug)).toContain("secretarias-municipales");
    for (const unit of ORG_UNIT_SEEDS) {
      expect(unit.tags.length).toBeGreaterThan(0);
      expect(ORG_CATEGORY_SEEDS.some((category) => category.slug === unit.categorySlug)).toBe(true);
    }
  });

  it("normaliza nombres sin acentos ni símbolos", () => {
    expect(normalizedSecretariaKey("Secretaría Municipal de Salud")).toBe("SECRETARIA MUNICIPAL DE SALUD");
    expect(normalizedSecretariaKey("  agua, saneamiento  ")).toBe("AGUA SANEAMIENTO");
  });

  it("resuelve alias históricos a la unidad canónica", () => {
    expect(resolveOrgUnit(units, "hacienda")?.id).toBe("u1");
    expect(resolveOrgUnit(units, "Secretaria de Hacienda")?.id).toBe("u1");
    expect(resolveOrgUnit(units, "SECRETARÍA MUNICIPAL DE SALUD")?.id).toBe("u2");
    expect(resolveOrgUnit(units, "unidad inexistente")).toBeNull();
  });

  it("construye un índice tolerante a mayúsculas y acentos", () => {
    const index = buildOrgUnitIndex(units);
    expect(index.get(normalizedSecretariaKey("secretaria municipal de salud"))?.id).toBe("u2");
  });

  it("normaliza etiquetas: recorta, deduplica y descarta vacías o largas", () => {
    const tags = normalizeOrgTags([
      "  Finanzas ",
      "finanzas",
      "FINANZAS",
      "",
      "Salud",
      "x".repeat(80),
      "Atención   ciudadana",
    ]);
    expect(tags).toEqual(["Finanzas", "Salud", "Atención ciudadana"]);
  });

  it("genera slugs estables para categorías", () => {
    expect(slugifyOrgCategory("Subalcaldías Distritales")).toBe("subalcaldias-distritales");
    expect(slugifyOrgCategory("Direcciones y Unidades")).toBe("direcciones-y-unidades");
  });
});
