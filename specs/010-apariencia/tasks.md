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
- [ ] T017 E2E en vivo: GET/PUT, HTML con tokens, auditoría, OBSERVADOR 403 + alerta,
      persistencia tras reinicio y verificación visual claro/oscuro

## Dependencias

- Ninguna nueva (Principio XV).
