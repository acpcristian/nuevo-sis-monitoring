# Tasks: 005-metricas-dashboards

## 1. API de métricas
- [x] T001 `GET /api/v1/metrics/overview`: salud por estado, servidores por entorno, incidentes por estado/prioridad, SLA vencidos, % SLA cumplido 7 d, MTTR mediano, ingesta 24 h por hora/severidad, top patrones de alerta, canales
- [x] T002 `GET /api/v1/metrics/export?dataset=incidents|servers|events&format=csv|json` con auditoría `REPORT_EXPORTED` (Principio II)

## 2. UI de dashboards
- [x] T003 `/metrics`: tarjetas KPI (servidores, incidentes abiertos, SLA 7 d, MTTR), barras de salud/estado/prioridad, sparkline 24 h SVG nativo
- [x] T004 Recordatorio visible del Principio VIII (ausencia de telemetría ≠ salud)
- [x] T005 Botones de exportación CSV/JSON desde el dashboard
- [x] T006 Enlace «Métricas» en navegación global

## 3. Validación
- [x] T007 E2E contra despliegue: KPIs cargan con datos reales y export CSV descarga con filas
- [x] T008 Gate técnico: typecheck + test + build en verde

## Dependencias
- Sin dependencias nuevas: gráficos en SVG/CSS puro (Principio XV).
