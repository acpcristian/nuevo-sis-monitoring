# Feature Specification: Administración de Colores y Temas

**Feature Branch**: `main`
**Created**: 2026-11-03
**Status**: Implementada
**Depende de**: 002..009 (UI global), 007-gestion-usuarios (RBAC)

## Contexto

La plataforma tiene una identidad visual fija (índigo + slate) definida en clases de Tailwind
repartidas por todas las pantallas. Cambiar el color institucional, pasar a modo oscuro o
ajustar la densidad obligaba a editar código y desplegar. Se necesita un **módulo de
apariencia** que permita al SUPERADMIN cambiar colores y tema desde la propia aplicación,
aplicado a todo el sistema y sin parpadeo al cargar.

## User Stories

### US1 — Elegir el color principal (P1)

Como SUPERADMIN quiero elegir un color principal (presets institucionales o hexadecimal propio)
y verlo aplicado en botones, enlaces, focos, badges y gráficos de toda la plataforma.

**Criterios de aceptación**
1. Presets: Índigo, Océano, Esmeralda, Violeta, Rubí, Ámbar y Grafito.
2. Color personalizado en formato `#rrggbb` con validación y paleta derivada (50…900).
3. El texto sobre el color principal se elige automáticamente (blanco o casi negro) según
   contraste, garantizando legibilidad.
4. El cambio se aplica a todo el sistema de forma global.

### US2 — Modo claro / oscuro (P1)

Como SUPERADMIN quiero alternar entre modo claro y oscuro para adaptar la plataforma a
salas de monitoreo con poca luz.

**Criterios de aceptación**
1. Modo `light` y `dark` persistidos en la base.
2. En oscuro se ajustan superficies, bordes, textos, tarjetas, tablas, modales, navegación y
   los colores semánticos (éxito, alerta, error) para mantener contraste.
3. El tema se inyecta desde el servidor en `<html>`: sin parpadeo ni cambio tras hidratar.
4. La pantalla de acceso también respeta el tema.

### US3 — Radio de bordes y densidad (P2)

Como SUPERADMIN quiero ajustar el radio de las esquinas (0–16 px) y la densidad
(cómoda 16 px / compacta 15 px) para adecuar la interfaz al tamaño de pantalla del operador.

**Criterios de aceptación**
1. El radio se aplica a tarjetas, botones, inputs y modales.
2. La densidad escala tipografía y espaciados de forma proporcional.
3. La vista previa muestra los cambios antes de guardar.

### US4 — Gobierno del cambio (P1)

**Criterios de aceptación**
1. Solo SUPERADMIN puede modificar la apariencia; OBSERVADOR recibe 403 auditado.
2. Cada cambio se registra como `THEME_UPDATED` con estado anterior y posterior.
3. Un usuario autenticado cualquiera puede leer el tema vigente.
4. Ante fallo de base de datos se usa el tema por defecto (la app nunca se cae por apariencia).

## Requerimientos Funcionales

- **FR-001**: Persistir `preset`, `primary_color`, `mode`, `radius`, `density` y `updated_by`
  en una fila única `system_settings(id = "global")`.
- **FR-002**: Exponer `GET /api/v1/settings/theme` (autenticado) y `PUT` (SUPERADMIN).
- **FR-003**: Derivar la escala del color principal (50, 100, 200, 300, 400, 500, 600, 700,
  800, 900) y `--primary-contrast`.
- **FR-004**: Inyectar los tokens como variables CSS en `<html data-theme data-density>` desde
  el layout raíz, con render dinámico.
- **FR-005**: Remapear la paleta existente (indigo/slate/zinc) a los tokens sin reescribir
  cada pantalla.
- **FR-006**: Validar el cuerpo con Zod y normalizar presets (el preset conocido manda sobre
  el hex manual).
- **FR-007**: Auditar `THEME_UPDATED` con `before`/`after` e IP.
- **FR-008**: Ofrecer vista previa en vivo y restablecer a valores por defecto antes de guardar.

## Requerimientos No Funcionales

- **NFR-001**: Sin dependencias nuevas.
- **NFR-002**: Sin parpadeo (FOUC): el tema llega en el HTML del servidor.
- **NFR-003**: Lectura del tema tolerante a fallos (try/catch → defaults).
- **NFR-004**: Una consulta por render a una fila con clave primaria.
- **NFR-005**: El módulo no altera datos ni permisos; solo presentación.

## Success Criteria

- **SC-001**: Guardar un preset cambia el color de botones/enlaces en todas las pantallas.
- **SC-002**: El modo oscuro se refleja en el HTML servido (`data-theme="dark"`).
- **SC-003**: Un OBSERVADOR no puede guardar (403) y el intento queda auditado.
- **SC-004**: La auditoría muestra `THEME_UPDATED` con el antes/después.
- **SC-005**: Tras reiniciar el contenedor, el tema elegido se mantiene.

## Fuera de alcance

- Preferencia de tema por usuario (el tema es global).
- Temas por organización/multi-tenant.
- Editor de tipografías o logotipos.
- Programación horaria del modo oscuro.
