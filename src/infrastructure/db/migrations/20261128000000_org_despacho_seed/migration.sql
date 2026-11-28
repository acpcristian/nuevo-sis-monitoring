-- Autocura aditiva del catálogo organizacional: agrega la categoría
-- Despacho Municipal y su unidad si aún no existen en la base.
-- Idempotente: se puede aplicar varias veces sin duplicar filas.
-- (En producción el Dockerfile usa `prisma db push`; esta migración mantiene
-- la paridad de desarrollo y documenta el cambio.)

INSERT INTO "org_categories" ("id", "slug", "name", "description", "color", "sort_order", "created_at", "updated_at")
VALUES (
  'orgcat-despacho',
  'despacho',
  'Despacho Municipal',
  'Despacho del Alcalde y equipo de gabinete directo.',
  '#dc2626',
  5,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "org_units" ("id", "name", "category_id", "tags", "sort_order", "active", "created_at", "updated_at")
SELECT
  'orgunit-despacho-municipal',
  'DESPACHO MUNICIPAL',
  c."id",
  ARRAY['Alcaldía', 'Gabinete', 'Despacho']::TEXT[],
  5,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "org_categories" c
WHERE c."slug" = 'despacho'
ON CONFLICT ("name") DO NOTHING;
