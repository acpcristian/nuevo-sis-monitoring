-- Enrutamiento por categorías del sistema + catálogo de alertamiento editable

-- 1. Suscripción de canales a categorías (NULL/vacío = recibe todo)
ALTER TABLE "notification_channels" ADD COLUMN "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- 2. La entrega guarda la categoría que la originó (para revisionar por sección)
ALTER TABLE "notification_deliveries" ADD COLUMN "category" TEXT;

-- 3. Catálogo de categorías de notificación (CRUD en /api/v1/notification-categories)
CREATE TABLE "notification_categories" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "trigger_info" TEXT,
    "default_severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "recommended_actions" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "notification_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_categories_code_key" ON "notification_categories"("code");
