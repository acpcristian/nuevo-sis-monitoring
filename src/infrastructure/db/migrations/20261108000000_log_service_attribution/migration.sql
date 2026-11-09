-- Atribución de servicio en eventos de log + base de conocimiento editable por categoría

-- 1. Vínculo del evento de log con el servicio del servidor que lo originó
ALTER TABLE "log_events" ADD COLUMN "service_id" TEXT;

ALTER TABLE "log_events" ADD CONSTRAINT "log_events_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "server_services"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "log_events_service_id_event_timestamp_idx" ON "log_events"("service_id", "event_timestamp" DESC);

-- 2. Base de conocimiento por categoría (¿por qué ocurre? / ¿cómo resolverlo?)
--    Editable vía CRUD en /api/v1/log-categories.
ALTER TABLE "log_categories" ADD COLUMN "common_causes" TEXT;
ALTER TABLE "log_categories" ADD COLUMN "solutions" TEXT;
