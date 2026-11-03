# Tasks: 010-apariencia

## 1. Dominio y persistencia

- [x] T001 Modelo `SystemSetting` (fila única `global`) en `schema.prisma`
- [x] T002 `src/core/domain/theme.ts`: presets, tipos, normalización y utilidades de color
- [x] T003 `themeVars`: escala del primario, contraste, radios y tokens por modo
- [x] T004 `ThemeService.getThemeRecord` tolerante a fallos y `updateTheme` con auditoría

## 2. API y aplicación

- [x] T005 `GET /api/v1/settings/theme` (autenticado) y `PUT` (SUPERADMIN + Zod)
- [x] T006 `THEME_UPDATED` en el catálogo de auditoría
- [x] T007 Layout raíz dinámico con `data-theme`, `data-density` y variables CSS
- [x] T008 Capa de remapeo en `globals.css` (primario, superficies, textos, bordes, radios, densidad)
- [x] T009 Modo oscuro: semánticos, matices del primario y degradados del login

## 3. Interfaz

- [x] T010 Pantalla `/settings/appearance` con presets, color propio y paleta derivada
- [x] T011 Selector de modo, radio y densidad con vista previa aislada
- [x] T012 Guardar con aplicación inmediata + `router.refresh()` y restablecer
- [x] T013 Enlace «Apariencia» solo para SUPERADMIN en la navegación

## 4. Validación

- [x] T014 Tests de dominio de tema (7 casos)
- [x] T015 Tests del servicio de apariencia (4 casos) — 143/143 en total
- [x] T016 Gate técnico: `tsc --noEmit` + `vitest run` + `next build` en verde
- [x] T017 E2E en vivo: GET/PUT, HTML con tokens, auditoría, OBSERVADOR 403 + alerta,
      persistencia tras reinicio y verificación visual claro/oscuro
  - `GET` sin sesión `401`; `/settings/appearance` `307` a `/login`.
  - `PUT` Océano claro/12/compacta → HTML `data-theme="light"`, `--primary-600:#0284c7`,
    `--radius-lg:12px`; `PUT` oscuro → `--surface-1:#111a2e`.
  - `THEME_UPDATED` con `before`/`after`; OBSERVADOR `403` + `UNAUTHORIZED_ATTEMPT` +
    `SECURITY_ALERT_SENT` (HIGH).
  - Tema persistió a través de 4 redeploys; restablecido a Índigo/claro/8/cómoda.
  - Capturas Playwright: `/servers` y `/settings/appearance` claro/oscuro, `/login` oscuro;
    los 7 enlaces caben en 1440 y 1280; menús Administración y Usuario operativos.
  - Evidencia completa en [memory/apariencia.md](../../memory/apariencia.md).

## Dependencias

- Ninguna nueva (Principio XV).
