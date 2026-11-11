-- =============================================================================
-- 011 — Agente Inteligente LLM (MVP)
-- Configuración de proveedor LLM (clave cifrada AES-256-GCM) y perfil de
-- comportamiento entrenable del agente (Principio III/IV/VI).
-- =============================================================================

CREATE TABLE "agent_provider_configs" (
    "id" TEXT NOT NULL,
    "provider_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "max_output_tokens" INTEGER NOT NULL DEFAULT 2048,
    "encrypted_payload" TEXT,
    "iv" TEXT,
    "auth_tag" TEXT,
    "key_fingerprint" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "last_test_at" TIMESTAMP(3),
    "last_test_status" TEXT,
    "last_test_latency_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_provider_configs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "agent_profile" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL DEFAULT 'Agente de Operaciones',
    "tone" TEXT,
    "instructions" TEXT,
    "escalation_rules" TEXT,
    "greeting" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_profile_pkey" PRIMARY KEY ("id")
);

-- Solo un proveedor activo a la vez (índice parcial único)
CREATE UNIQUE INDEX "agent_provider_configs_single_active"
    ON "agent_provider_configs" ("is_active")
    WHERE "is_active" = true;

CREATE INDEX "agent_provider_configs_is_active_idx" ON "agent_provider_configs"("is_active");

-- Perfil singleton
INSERT INTO "agent_profile" ("id", "enabled", "name", "updated_at")
VALUES ('agent-profile-default', false, 'Agente de Operaciones', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
