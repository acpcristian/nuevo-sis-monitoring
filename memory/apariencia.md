# 010 — Apariencia (colores y temas)

**Estado:** completada y verificada en vivo (2026-11-03).
**Código desplegado:** `608632c` (la documentación se commitea después, sin cambios de runtime).
**Spec:** [specs/010-apariencia/spec.md](../specs/010-apariencia/spec.md)

## Objetivo

Permitir al SUPERADMIN cambiar la apariencia global del sistema (color principal, modo
claro/oscuro, radio de bordes y densidad) desde `/settings/appearance`, con aplicación
inmediata en todas las pantallas, persistencia en base de datos y auditoría del cambio.

## Implementación

| Pieza | Archivo |
|---|---|
| Dominio puro (presets, escalas, contraste, tokens) | `src/core/domain/theme.ts` |
| Persistencia y auditoría | `src/core/services/theme.service.ts` |
| Validación Zod | `src/shared/validations/theme.schema.ts` |
| API `GET`/`PUT` | `src/app/api/v1/settings/theme/route.ts` |
| Inyección SSR de tokens | `src/app/layout.tsx` (`force-dynamic`) |
| Remapeo de la paleta existente | `src/app/globals.css` |
| UI de apariencia | `src/app/(dashboard)/settings/appearance/page.tsx` |
| Navegación (menús Admin y Usuario) | `src/components/nav/TopNav.tsx` |
| Modelo `SystemSetting` | `src/infrastructure/db/schema.prisma` |

- Fila única `system_settings(id="global")`: `preset`, `primary_color`, `mode`, `radius`,
  `density`, `updated_by`.
- Presets: Índigo, Océano, Esmeralda, Violeta, Rubí, Ámbar, Grafito; color propio `#rrggbb`.
- Escala derivada `--primary-50…900`, `--primary-contrast` (texto blanco/casi negro según
  contraste), superficies/bordes/textos por modo y radios `--radius-md/lg/xl/2xl`.
- La capa de `globals.css` remapea `indigo-*`, `slate-*`, `zinc-*`, `bg-white`, radios y
  controles nativos; el modo oscuro ajusta matices del primario y colores semánticos.
- `GET` autenticado; `PUT` solo SUPERADMIN (`assertSuperAdmin("UPDATE_THEME")`), auditado
  como `THEME_UPDATED` con `before`/`after` e IP.
- Fallo de BD en el layout → tema por defecto (no rompe el render ni el build).

## Evidencia E2E (producción LAN)

| Verificación | Resultado |
|---|---|
| `GET /api/v1/settings/theme` sin sesión | `401` |
| `/settings/appearance` sin sesión | `307` → `/login` |
| Login `admin` | `200` |
| `PUT` Océano / claro / 12 px / compacta | `200` |
| HTML de `/login` tras el cambio | `data-theme="light"`, `data-density="compact"`, `--primary-600:#0284c7`, `--radius-lg:12px` |
| `PUT` Océano / oscuro / 12 px / compacta | `200` |
| HTML en oscuro | `data-theme="dark"`, `--surface-1:#111a2e`, `--text-1:#e6edf7` |
| Auditoría | `THEME_UPDATED` con `before` y `after` (10 eventos por las pruebas) |
| OBSERVADOR intenta `PUT` | `403 FORBIDDEN_ACTION` |
| Rastro del intento | `UNAUTHORIZED_ATTEMPT` + `SECURITY_ALERT_SENT` (HIGH, `attemptedAction=UPDATE_THEME`) |
| Observador | desactivado de nuevo al terminar |
| Persistencia | tema fijado 18:31 sobrevivió a los redeploys de 18:33, 18:41, 18:49 y 18:55 |
| Restablecer por defecto | `200`; HTML con `#4f46e5`, `8px`, `comfortable` |

### Verificación visual (Playwright + Chromium)

- Capturas reales en 1440×1000 de `/servers` y `/settings/appearance` en claro y oscuro, y
  de `/login` en oscuro.
- Navegación: `clientWidth = scrollWidth = 683` en 1440 y 1280; los 7 enlaces visibles
  (Servidores, Logs, Alertas, Incidentes, Notificaciones, Métricas, Automatización).
- Menú **Administración** (Usuarios, Auditoría, Apariencia) y menú de **usuario**
  (Mi contraseña, Cerrar sesión) verificados abiertos y visibles.
- Controles en oscuro medidos por `getComputedStyle`: input hex, botón inactivo y `select`
  con fondo `rgb(17,26,46)` y texto claro (se corrigió el blanco nativo).

## Incidente de seguridad y rotación

Al subir el primer commit de esta fase se incluyó por error un script temporal de capturas
con la contraseña del administrador. El repositorio es público.

1. Se eliminó el archivo del commit con `git commit --amend` y `push --force-with-lease`
   (`767d83d` → `91c696b`), y se añadió a `.gitignore`.
2. Se rotó la contraseña del `admin` vía `POST /api/v1/auth/password`.
3. Se actualizó `SUPERADMIN_PASSWORD` en Coolify y se eliminó la variable duplicada obsoleta.
4. Tras redesplegar: contraseña nueva `200`, contraseña antigua `401`.
   El *break-glass* re-sincronizó el hash desde el entorno y quedó auditado como
   `USER_UPDATED` (`superadmin password resincronizada desde entorno`).
5. El commit antiguo puede seguir accesible por SHA en GitHub hasta que se recoja basura,
   pero la credencial ya no es válida.

**Lección:** nunca usar `git add -A` con scripts temporales; los secretos no van ni en
pruebas locales versionables. El script de capturas quedó como `_theme_shots.js` ignorado.

## Incidencia de build (codificación)

El primer deploy falló con `Error reading datamodel file ... stream did not contain valid
UTF-8`. Causa: PowerShell 5.1 `Add-Content` escribió `schema.prisma` y `globals.css` en
Windows-1252. Se reescribieron en UTF-8 sin BOM y `prisma validate` pasó.

**Regla operativa:** para tocar archivos con acentos usar la herramienta de escritura o
`[System.IO.File]::WriteAllText($path, $text, (New-Object Text.UTF8Encoding($false)))`.
Nunca `Add-Content` sobre archivos UTF-8 con PowerShell 5.1.

## Deploys

| Commit | Deployment | Resultado |
|---|---|---|
| `97a8eb4` | `grcuurnu1fc0htvotd5aqri8` | falló (UTF-8) → rollback |
| `79cf71f` | `8yldxd6krxszrq1nvtrt14bm` | `finished` 18:28, healthy |
| `91c696b` | `yvokmilysxkscvi8jlslnpjv` | `finished` 18:41, healthy |
| `813ccdc` | `hnyw5xx2gehmht4dc0nffgya` | `finished` 18:49, healthy |
| `608632c` | `8kdoh4c0ekupguiwyzpgihsp` | `finished` 18:55, healthy |

## Límites conocidos

- El tema es **global**; no hay preferencia por usuario ni por organización.
- Las alertas de seguridad se registran, pero con **0 canales configurados** el envío real
  queda en `delivered: 0`.
- El dominio público con Let's Encrypt sigue pendiente de DNS/NAT municipal; hoy se accede
  por `*.sslip.io` en LAN.

## Notas de operación

- `prisma db push` crea `system_settings` al arrancar el contenedor.
- El layout raíz es `force-dynamic`: una consulta por clave primaria por render, sin FOUC.
- Tras un cambio de tema, el cliente aplica los tokens al `documentElement` y hace
  `router.refresh()` para que el resto de la navegación tome el HTML nuevo.
