# Plan Técnico: 010-apariencia

## 1. Modelo

```prisma
model SystemSetting {
  id           String   @id @default("global")
  preset       String   @default("indigo")
  primaryColor String   @default("#4f46e5") @map("primary_color")
  mode         String   @default("light")
  radius       Int      @default(8)
  density      String   @default("comfortable")
  updatedBy    String?  @map("updated_by")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")
  @@map("system_settings")
}
```

Se crea con `prisma db push` al arrancar el contenedor (sin migración manual).

## 2. Dominio puro (`src/core/domain/theme.ts`)

- Presets institucionales y tipo `Theme`.
- `resolveTheme` normaliza preset/hex/modo/radio/densidad (el preset conocido impone su color).
- Utilidades de color: mezcla, aclarado/oscurecido, luminancia y contraste.
- `themeVars(theme)` genera los tokens:
  - escala `--primary-50…900`, `--primary-contrast`;
  - `--radius-md/lg/xl/2xl`;
  - superficies, bordes y textos según modo.
- Sin Prisma ni APIs de Node → importable desde componentes cliente.

## 3. Servicio (`ThemeService`)

- `getThemeRecord()`: lee la fila `global`; si no existe o la BD falla → `DEFAULT_THEME`
  (protege el build y las caídas).
- `updateTheme(theme, actor)`: `upsert` + `THEME_UPDATED` con `before/after` e IP.

## 4. API

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/api/v1/settings/theme` | cualquier usuario autenticado |
| PUT | `/api/v1/settings/theme` | SUPERADMIN (`assertSuperAdmin("UPDATE_THEME")`) |

Validación con `ThemeSchema` (Zod): preset, `#rrggbb`, modo, radio 0–16 y densidad.

## 5. Aplicación sin parpadeo

`src/app/layout.tsx` es `force-dynamic` y renderiza:

```tsx
<html lang="es" data-theme={theme.mode} data-density={theme.density} style={themeVars(theme)}>
```

Con esto el primer HTML ya trae los colores correctos (incluida `/login`).

## 6. Capa de compatibilidad visual (`globals.css`)

La app usa cientos de utilidades `bg-indigo-*`, `text-slate-*`, `bg-white`, etc. En lugar de
reescribir 20 pantallas, se añade una capa después de `@tailwind utilities` que remapea:

- `indigo-*` → `--primary-*` (incluye `hover:`, `focus:`, `ring`, `fill`, `border`).
- `white`, `slate-*`, `zinc-*` → superficies, bordes y textos tokenizados.
- `rounded-md/lg/xl/2xl` → tokens de radio.
- `html[data-density="compact"]` → `font-size: 15px` (escala rem).
- Modo oscuro: variantes `[data-theme="dark"]` para matices del primario, colores semánticos
  (emerald/rose/red/amber/sky/violet) y degradados del login.

La especificidad (`:root .clase`, `[data-theme="dark"] .clase`) garantiza que las reglas
personalizadas ganen a las utilidades sin `!important`, y funcionan también dentro de la
vista previa anidada.

## 7. UI `/settings/appearance`

- Carga en paralelo `/auth/me` y `/settings/theme`; si no es SUPERADMIN muestra 403.
- Presets en tarjetas con swatch; color picker + hex; paleta derivada 50/100/500/600/700.
- Modo claro/oscuro, slider de radio y selector de densidad.
- Vista previa aislada con `themeVars` inline y `data-theme`, incluyendo nav, tarjeta, badges,
  barra de progreso, botones e input.
- Guardar: PUT → aplica tokens a `documentElement` → `router.refresh()`.
- Restablecer: vuelve a `DEFAULT_THEME` (no guarda hasta confirmar).
- Enlace «Apariencia» en la navegación solo para SUPERADMIN.

## 8. Pruebas

- Unit: normalización de hex, presets, límites de radio, escalas, superficies por modo y
  contraste.
- Integración: `getThemeRecord` (sin fila, fila, fallo de BD) y `updateTheme` (upsert,
  normalización del preset, auditoría before/after).
- Gate: `tsc --noEmit`, `vitest run`, `next build`.
- E2E en vivo: GET/PUT, HTML con `data-theme` y variables, auditoría `THEME_UPDATED`,
  OBSERVADOR 403 + alerta, persistencia tras reinicio.

## 9. Constitución (chequeo)

| Principio | Cumplimiento |
|---|---|
| II. Auditoría | `THEME_UPDATED` con before/after e IP |
| IV. Mínimo privilegio | PUT solo SUPERADMIN; lectura para autenticados |
| VI. Trazabilidad | Registro del actor y del cambio exacto |
| XI. Resiliencia | Fallo de BD → tema por defecto, sin romper render |
| XV. Dependencias | Ninguna nueva |
