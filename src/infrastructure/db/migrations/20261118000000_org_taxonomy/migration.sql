-- 016 — Taxonomía organizacional: categorías de entidad + etiquetas por unidad.
-- El vínculo servidor↔unidad sigue viviendo en la etiqueta `secretaria`.

CREATE TABLE "org_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "org_categories_slug_key" ON "org_categories"("slug");
CREATE UNIQUE INDEX "org_categories_name_key" ON "org_categories"("name");

CREATE TABLE "org_units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" TEXT,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "org_units_name_key" ON "org_units"("name");
CREATE INDEX "org_units_category_id_sort_order_idx" ON "org_units"("category_id", "sort_order");

ALTER TABLE "org_units" ADD CONSTRAINT "org_units_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "org_categories"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Semillas: categorías de entidad.
INSERT INTO "org_categories" ("id", "slug", "name", "description", "color", "sort_order", "created_at", "updated_at") VALUES
  ('orgcat-secretarias-municipales', 'secretarias-municipales', 'Secretarías Municipales', 'Secretarías del Gobierno Autónomo Municipal de El Alto.', '#6366f1', 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('orgcat-subalcaldias', 'subalcaldias', 'Subalcaldías', 'Subalcaldías distritales y sus equipos técnicos.', '#0ea5e9', 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('orgcat-empresas-publicas', 'empresas-publicas', 'Empresas Públicas', 'Empresas y entidades descentralizadas del municipio.', '#14b8a6', 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('orgcat-direcciones-unidades', 'direcciones-unidades', 'Direcciones y Unidades', 'Direcciones, unidades de apoyo y equipos operativos.', '#f59e0b', 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

-- Semillas: unidades institucionales con sus etiquetas sugeridas.
INSERT INTO "org_units" ("id", "name", "category_id", "tags", "sort_order", "active", "created_at", "updated_at") VALUES
  ('orgunit-gestion-institucional', 'SECRETARÍA MUNICIPAL DE GESTIÓN INSTITUCIONAL', 'orgcat-secretarias-municipales', ARRAY['Institucional','Talento humano','Planificación']::TEXT[], 10, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('orgunit-administracion-finanzas', 'SECRETARÍA MUNICIPAL DE ADMINISTRACIÓN Y FINANZAS', 'orgcat-secretarias-municipales', ARRAY['Finanzas','Compras','Presupuesto']::TEXT[], 20, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('orgunit-movilidad-urbana', 'SECRETARÍA MUNICIPAL DE MOVILIDAD URBANA', 'orgcat-secretarias-municipales', ARRAY['Transporte','Tránsito','Vías']::TEXT[], 30, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('orgunit-educacion-cultura', 'SECRETARÍA MUNICIPAL DE EDUCACIÓN Y CULTURA', 'orgcat-secretarias-municipales', ARRAY['Educación','Cultura','Juventud']::TEXT[], 40, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('orgunit-desarrollo-humano', 'SECRETARÍA MUNICIPAL DE DESARROLLO HUMANO Y SOCIAL INTEGRAL', 'orgcat-secretarias-municipales', ARRAY['Social','Atención ciudadana','Género']::TEXT[], 50, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('orgunit-seguridad-ciudadana', 'SECRETARÍA MUNICIPAL DE SEGURIDAD CIUDADANA', 'orgcat-secretarias-municipales', ARRAY['Seguridad','Emergencias','Prevención']::TEXT[], 60, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('orgunit-salud', 'SECRETARÍA MUNICIPAL DE SALUD', 'orgcat-secretarias-municipales', ARRAY['Salud','Atención ciudadana','Epidemiología']::TEXT[], 70, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('orgunit-infraestructura-publica', 'SECRETARÍA MUNICIPAL DE INFRAESTRUCTURA PÚBLICA', 'orgcat-secretarias-municipales', ARRAY['Infraestructura','Obras','Supervisión']::TEXT[], 80, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('orgunit-agua-saneamiento', 'SECRETARÍA MUNICIPAL DE AGUA, SANEAMIENTO, GESTIÓN AMBIENTAL Y RIESGOS', 'orgcat-secretarias-municipales', ARRAY['Servicios básicos','Ambiente','Riesgos']::TEXT[], 90, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('orgunit-desarrollo-economico', 'SECRETARÍA MUNICIPAL DE DESARROLLO ECONÓMICO', 'orgcat-secretarias-municipales', ARRAY['Economía','Emprendimiento','Mercados']::TEXT[], 100, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
