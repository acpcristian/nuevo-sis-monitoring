-- 015 — Canal TELEGRAM de notificaciones + claves de servicio MCP.
ALTER TYPE "ChannelType" ADD VALUE IF NOT EXISTS 'TELEGRAM';

CREATE TYPE "ServiceKeyStatus" AS ENUM ('ACTIVE', 'REVOKED');

CREATE TABLE "service_api_keys" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "key_hash" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "status" "ServiceKeyStatus" NOT NULL DEFAULT 'ACTIVE',
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "last_used_at" TIMESTAMP(3),
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "service_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_api_keys_name_key" ON "service_api_keys"("name");
CREATE UNIQUE INDEX "service_api_keys_key_hash_key" ON "service_api_keys"("key_hash");
