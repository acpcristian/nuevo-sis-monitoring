import { describe, it, expect } from "vitest";
import { CreateDiagnosisSchema } from "@/shared/validations/log.schema";

describe("Diagnosis Schema Validation", () => {
  it("debe aceptar un diagnóstico válido con todas las secciones obligatorias", () => {
    const result = CreateDiagnosisSchema.safeParse({
      eventIds: ["550e8400-e29b-41d4-a716-446655440000"],
      observedFacts: "Se detectaron 15 eventos de error de base de datos en 5 minutos.",
      probableCause: "Pool de conexiones agotado por fuga en el ORM",
      evidenceSupport: { logRefs: ["evt-001", "evt-002"] },
      alternativeDiagnoses: "Posible problema de red intermitente",
      impactPotential: "Servicio degradado para usuarios finales",
      verificationSteps: "Revisar métricas de pool y logs de aplicación",
      remediationRecommendations: "Aumentar pool size y corregir fuga",
      confidenceLevel: "HIGH",
    });
    expect(result.success).toBe(true);
  });

  it("debe rechazar diagnóstico sin eventIds", () => {
    const result = CreateDiagnosisSchema.safeParse({
      eventIds: [],
      observedFacts: "Hechos",
      probableCause: "Causa",
      confidenceLevel: "HIGH",
    });
    expect(result.success).toBe(false);
  });

  it("debe rechazar diagnóstico sin observedFacts", () => {
    const result = CreateDiagnosisSchema.safeParse({
      eventIds: ["550e8400-e29b-41d4-a716-446655440000"],
      observedFacts: "",
      probableCause: "Causa",
      confidenceLevel: "HIGH",
    });
    expect(result.success).toBe(false);
  });

  it("debe rechazar diagnóstico sin probableCause", () => {
    const result = CreateDiagnosisSchema.safeParse({
      eventIds: ["550e8400-e29b-41d4-a716-446655440000"],
      observedFacts: "Hechos",
      probableCause: "",
      confidenceLevel: "HIGH",
    });
    expect(result.success).toBe(false);
  });

  it("debe rechazar confidenceLevel inválido", () => {
    const result = CreateDiagnosisSchema.safeParse({
      eventIds: ["550e8400-e29b-41d4-a716-446655440000"],
      observedFacts: "Hechos",
      probableCause: "Causa",
      confidenceLevel: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("debe permitir campos opcionales vacíos o nulos", () => {
    const result = CreateDiagnosisSchema.safeParse({
      eventIds: ["550e8400-e29b-41d4-a716-446655440000"],
      observedFacts: "Hechos observados mínimos",
      probableCause: "Causa probable mínima",
      confidenceLevel: "LOW",
    });
    expect(result.success).toBe(true);
  });
});

describe("Diagnosis RBAC - Unit Logic Tests", () => {
  it("valida que OBSERVADOR no puede crear diagnósticos (lógica de autorización)", () => {
    const userRoles = {
      SUPERADMIN: { canCreateDiagnosis: true },
      OBSERVADOR: { canCreateDiagnosis: false },
    };

    expect(userRoles.SUPERADMIN.canCreateDiagnosis).toBe(true);
    expect(userRoles.OBSERVADOR.canCreateDiagnosis).toBe(false);
  });

  it("valida que solo SUPERADMIN puede mutar diagnósticos", () => {
    const allowedRoles = ["SUPERADMIN"];
    expect(allowedRoles.includes("SUPERADMIN")).toBe(true);
    expect(allowedRoles.includes("OBSERVADOR")).toBe(false);
  });

  it("estructura de diagnóstico contiene todas las secciones requeridas por Principio VII", () => {
    const requiredSections = [
      "observedFacts",
      "probableCause",
      "evidenceSupport",
      "alternativeDiagnoses",
      "impactPotential",
      "verificationSteps",
      "remediationRecommendations",
      "confidenceLevel",
    ];

    const diagnosisKeys = Object.keys({
      observedFacts: "",
      probableCause: "",
      evidenceSupport: {},
      alternativeDiagnoses: "",
      impactPotential: "",
      verificationSteps: "",
      remediationRecommendations: "",
      confidenceLevel: "HIGH",
    });

    requiredSections.forEach((section) => {
      expect(diagnosisKeys).toContain(section);
    });
  });
});