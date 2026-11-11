-- 012 — Agente fase 2a: rate limiting por proveedor + toggle de tools de dominio.
ALTER TABLE "agent_provider_configs"
  ADD COLUMN "rate_limit_per_minute" INTEGER,
  ADD COLUMN "rate_limit_per_day" INTEGER;

ALTER TABLE "agent_profile"
  ADD COLUMN "tools_enabled" BOOLEAN NOT NULL DEFAULT true;
