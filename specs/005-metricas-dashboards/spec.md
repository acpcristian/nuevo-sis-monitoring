# Feature Specification: Métricas y Dashboards

**Feature Branch**: `005-metricas-dashboards`  
**Created**: 2026-10-30  
**Status**: Draft  
**Input**: User description: "Panel de métricas en tiempo real y dashboards configurables para supervisión de salud del sistema, incidentes y KPIs operativos, con visualización en múltiples canales (línea, barras, pastel, indicadores), filtros temporales y comparaciones históricas, cumpliendo Principios VII, VIII, IX, XII y XIII de la Constitución."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Panel de Salud del Sistema en Tiempo Real (Priority: P1)

Como **SUPERADMIN** u **OBSERVADOR**, quiero ver un panel con el estado actual de todos los servidores supervisados (enlaces visuales de salud: ONLINE, DEGRADED, UNREACHABLE, AUTH_FAILED), para tener una visión general instantánea de la infraestructura.

**Why this priority**: Es la base del dashboard. Sin la salud del sistema, no es posible tomar decisiones informadas.

**Independent Test**: Puede probarse cargando el panel y verificando que los estados de los servidores coinciden con el inventario actual (Spec 001).

**Acceptance Scenarios**:

1. **Visualización de salud general**:
   - **Given** que el panel se carga
   - **When** el usuario observa el panel
   - **Then** muestra indicadores visuales por servidor con código de color y texto explicativo (no dependiente solo del color), y el total de ONLINE, DEGRADED, UNREACHABLE, AUTH_FAILED

2. **Actualización en tiempo real**:
   - **Given** que un servidor cambia de estado (ej. ONLINE a UNREACHABLE)
   - **When** cambia el estado en el backend
   - **Then** el panel refleja el cambio en menos de 5 segundos sin necesidad de recargar la página

---

### User Story 2 - Dashboards de KPIs Operativos (Priority: P1)

Como **SUPERADMIN**, quiero dashboards configurables con KPIs: tiempo medio de resolución (MTTR), cantidad de incidentes por categoría, SLA cumplimiento, y carga de trabajo por equipo, para tomar decisiones basadas en datos operativos.

**Why this priority**: Permite a la dirección y operaciones medir la efectividad de los procesos y equipos.

**Independent Test**: Puede probarse seleccionando diferentes KPIs en el selector y verificando que los valores coinciden con los reportes manuales.

**Acceptance Scenarios**:

1. **Selector de KPIs**:
   - **Given** que el usuario está en el dashboard operativo
   - **When** selecciona "MTTR por equipo" o "SLA cumplimiento" del selector
   - **Then** el gráfico actualiza mostrando el KPI seleccionado con datos en tiempo real y marca temporal de la última actualización

2. **Filtros por período y equipo**:
   - **Given** que el usuario aplica filtros por rango de fechas y equipo responsable
   - **When** el usuario configura los filtros
   - **Then** todos los gráficos y tablas se actualizan para reflejar solo los datos que coinciden con los filtros aplicados

---

### User Story 3 - Visualizaciones Personalizables (Priority: P2)

Como **SUPERADMIN**, quiero arrastrar y soltar componentes de gráfico para personalizar mi dashboard, reorganizar la disposición y guardar múltiples disposiciones, para adaptar la vista a mis necesidades y preferencias.

**Why this priority**: La flexibilidad en la disposición del dashboard aumenta la usabilidad para diferentes roles y casos de uso.

**Independent Test**: Puede probarse arrastrando un componente de gráfico a una nueva posición y guardando la disposición; al regresar, la disposición se mantiene.

**Acceptance Scenarios**:

1. **Arrastrar y soltar componentes**:
   - **Given** que el usuario está en modo de edición del dashboard
   - **When** arrastra un gráfico de barras a una posición diferente y hace clic en "Guardar disposición"
   - **Then** la disposición se guarda y al recargar el dashboard, los componentes permanecen en sus nuevas posiciones

2. **Múltiples disposiciones guardadas**:
   - **Given** que el usuario ha guardado 3 disposiciones diferentes (ej. "Visión ejecutiva", "Visión de operaciones", "Visión de depuración")
   - **When** cambia entre disposiciones usando el selector
   - **Then** el dashboard muestra cada disposición con sus componentes y disposiciones específicas

---

### User Story 4 - Comparaciones Históricas (Priority: P2)

Como **SUPERADMIN**, quiero comparar métricas entre períodos históricos (última hora, última día, última semana, último mes) para identificar tendencias y estacionalidad, para planificar capacidad y mejoras procesales.

**Why this priority**: Los datos históricos son esenciales para la planificación de capacidad y la mejora continua.

**Independent Test**: Puede probarse seleccionando dos períodos y verificando que los gráficos muestran la comparación correcta con indicadores de diferencia porcentual.

**Acceptance Scenarios**:

1. **Comparación de dos períodos**:
   - **Given** que el usuario selecciona "Comparar último mes con anterior"
   - **When** el sistema carga la comparación
   - **Then** muestra gráficos lado a lado con valores actuales, valores del período anterior y diferencias porcentuales (incremento/decremento)

2. **Identificación de tendencias**:
   - **Given** la vista de comparación histórica
   - **When** el usuario observa la tendencia a lo largo de varias semanas
   - **Then** el sistema destaca tendencias ascendentes/declinantes con indicadores visuales y opciones de exportación de datos

---

### User Story 5 - Exportación e Integración de Datos (Priority: P3)

Como **SUPERADMIN**, quiero exportar datos de métricas a CSV/JSON y integrar con herramientas de BI externas (Grafana, PowerBI), para análisis avanzado y reporte corporativo.

**Why this priority**: Permite análisis fuera de la plataforma y cumplimiento de requisitos de reporte corporativo.

**Independent Test**: Puede probarse exportando datos y verificando que el archivo contiene los campos y valores esperados.

**Acceptance Scenarios**:

1. **Exportación a CSV**:
   - **Given** que el usuario selecciona datos y formato CSV
   - **When** hace clic en exportar
   - **Then** se descarga un archivo CSV con los encabezados y datos seleccionados, sin exposición de credenciales ni datos sensibles

2. **Integración con Grafana**:
   - **Given** que el usuario obtiene la URL y token de la API de métricas
   - **When** configura Grafana con los datos de la plataforma
   - **Then** Grafana puede mostrar los mismos gráficos y datos que la plataforma, con sincronización de horarios

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema **MUST** proporcionar panel de salud del sistema en tiempo real mostrando estado de todos los servidores (ONLINE, DEGRADED, UNREACHABLE, AUTH_FAILED) con representación redundante (texto + iconos + color).
- **FR-002**: El sistema **MUST** permitir crear y configurar dashboards con componentes de gráfico seleccionables de una biblioteca: línea, barras, pastel, indicadores (gauges), y tablas.
- **FR-003**: El sistema **MUST** permitir filtros temporales: personalizados (rango fecha/hora), predefinidos (última hora, última día, última semana, último mes) y comparativos (comparar períodos).
- **FR-004**: El sistema **MUST** biblioteca de componentes de visualización: líneas, barras, pastel, indicadores gauge, y tablas con clasificación por categorías y servidores.
- **FR-005**: El sistema **MUST** permitir guardar y cargar disposiciones de dashboard personalizadas, con nombre y descripción.
- **FR-005**: El sistema **MUST** permitir exportar datos de métricas a CSV y JSON formatos, sin exposición de credenciales ni datos sensibles.
- **FR-006**: El sistema **MUST** proporcionar integración con herramientas BI externas mediante API y tokens de acceso.
- **FR-007**: El sistema **MUST** distinguir roles: SUPERADMIN puede crear/editar/borrar dashboards y exportar; OBSERVADOR puede ver dashboards y exportar datos limitados.
- **FR-008**: El sistema **MUST** presentar estados de salud mediante múltiples canales perceptivos (iconos, texto explicativo, contrastes de color) y **MUST NOT** depender exclusivamente del color.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El panel de salud del sistema carga y muestra estados de al menos 1,000 servidores en menos de 3 segundos.
- **SC-002**: El usuario puede personalizar el dashboard (arrastrar componentes, guardar disposición) en menos de 1 minuto.
- **SC-003**: El usuario puede comparar métricas entre períodos y ver diferencias porcentuales en el mismo tiempo.
- **SC-004**: El 95% de los gráficos se renderizan correctamente en los navegadores compatibles (Chrome, Firefox, Edge, Safari).
- **SC-005**: La exportación a CSV/JSON incluye el 100% de los datos seleccionados sin registros duplicados ni campos sensibles.
- **SC-006**: Las integraciones con herramientas BI externas (Grafana, PowerBI) muestran datos coherentes con un retraso máximo de 5 segundos.

---

## Assumptions

- **A-001**: El sistema ya tiene datos de métricas recopilados (a través del Spec 001 y Spec 002) con marcas temporales y valores numéricos normalizados.
- **A-002**: Los navegadores compatibles soportan las tecnologías usadas (WebSockets, Canvas/SVG, localStorage para persistencia de disposiciones).
- **A-003**: Las herramientas BI externas (Grafana, PowerBI) soportan integración con APIs REST con autenticación por token.
- **A-004**: El idioma oficial de los textos de la interfaz, mensajes y exportaciones es español, con soporte para términos técnicos de métricas y monitoreo.
- **A-005**: El módulo de métricas y dashboards depende del Spec 001 (inventario de servidores y salud), del Spec 002 (eventos de logs y clasificación), y del Spec 003 (incidentes y SLA).

---

## Dependencies

- **Depende de Spec 001**: (server-inventory) Para datos de salud de servidores, inventario y asociación de servidores.
- **Depende de Spec 002**: (log-analysis) Para eventos de log, clasificación y contexto de datos para los dashboards.
- **Depende de Spec 003**: (incident-management) Para datos de incidentes, SLA, tiempos de resolución y MTTR.
- **Integra con**: Herramientas BI externas (Grafana, PowerBI), y capacidades de exportación de datos.

## Constitution Check *(will be verified after planning)*

| Principio Constitucional | Estado | Evidencia de Cumplimiento en el Diseño |
|---|---|---|
| **I. SDD como Fuente de Verdad** | ✅ POR DEFINIR | Todo el diseño técnico deriva de los requerimientos (`FR-001` a `FR-008`) de `spec.md`. |
| **II. Seguridad desde el Diseño** | ✅ POR DEFINIR | Validación de entrada estricta mediante Zod en Route Handlers; sesiones autenticadas; canales HTTPS/TLS obligatorios. |
| **III. Gestión Segura de Credenciales** | ✅ POR DEFINIR | 0% de secretos devueltos en GET/PATCH; datos sensibles en exports redactados. |
| **IV. Mínimo Privilegio y RBAC** | ✅ POR DEFINIR | Validación en dos capas (Middleware + Service Guard); rol OBSERVADOR solo lectura de dashboards. |
| **VII. Análisis de Logs Responsable** | ✅ POR DEFINIR | Datos de métricas extraídos de logs tratados como datos no confiables sanitizados. |
| **VIII. Alertas y Ciclo de Incidente** | ✅ POR DEFINIR | Estados explícitos de salud y alertas; no interpretar ausencia de datos como normalidad. |
| **IX. Calidad y Pruebas Obligatorias** | ✅ POR DEFINIR | Estrategia de pruebas que cubre renderizado, filtros, exportación y accesibilidad. |
| **XII. Experiencia de Usuario y Accesibilidad** | ✅ POR DEFINIR | Estados con representación redundante (texto + iconos); idioma español; navegación ≤ 3 clics. |
| **XIII. Privacidad y Exposición Mínima** | ✅ POR DEFINIR | Datos sensible en exports redactados; sin exposición de credenciales en APIs. |

---