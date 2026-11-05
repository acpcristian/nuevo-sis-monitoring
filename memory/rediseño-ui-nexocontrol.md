---
type: project
---

# Rediseño UI/UX institucional «NexoControl» (post feature 010)

## Qué se decidió

El dueño pidió mejorar la presentación siguiendo una spec de UI municipal
(secretarías como contenedores). Alcance elegido: **rediseño completo del
sistema** manteniendo todas las páginas existentes, y **secretarías vía
etiqueta** `secretaria` (sin migración de BD).

## Dónde quedó

- **Sidebar** `src/components/nav/Sidebar.tsx` — fija 248px `#151d2d`, drawer
  móvil con capa oscura, badge rojo de Alertas activas (`/api/v1/alerts?status=ACTIVE`).
  TopNav.tsx fue **eliminado** (no debe recrearse).
- **Shell** `src/components/nav/DashboardShell.tsx` — breadcrumb «Administración /
  …» e indicador «EN LÍNEA». El layout `(dashboard)` solo envuelve con esto.
- **Paleta** — preset `nexo` `#526fdf` es el DEFAULT del tema; tokens
  `--surface-0 #f5f7fa`, `--text-1 #172033`, `--text-3 #748196`, `--border-2
  #e2e7ee` en `core/domain/theme.ts`; semánticos remapeados desde `globals.css`
  (verde `#2d9b68`, ámbar `#c88a0b`, rojo `#d45b43`) sin tocar página por página.
- **Página Servidores** — doble vista en una sola página cliente: cuadrícula de
  secretarías (tag `secretaria`, grupo «Sin secretaría asignada» al final) →
  vista interna con tabla. Modal de alta = `ServerForm` con prop `embedded`
  + `defaultSecretaria` + datalist de secretarías.

## Gotchas

- El backend **NO recolecta CPU/memoria/uptime%**; la tabla interna muestra
  Estado/Servicios/Entorno/Última verificación (reales). Si el dueño pide
  CPU/Mem/Disponibilidad hay que extender los probes primero.
- La BD `system_settings` puede estar persistida con preset viejo («indigo»);
  el default nuevo solo aplica a instalaciones nuevas o al cambiar en /settings/appearance.
- Verificación en vivo: `tests/manual-verify-redesign.js` (login + recorrido
  completo, 15 checks; requiere `SUPERADMIN_USER`/`SUPERADMIN_PASSWORD` en env).

## Conexión con datos reales (fase 2)

La interfaz ya no muestra datos simulados: toda la información proviene del
backend real. Verificado E2E con `tests/verify-integracion.js` (14/14 checks).

- **Endpoint nuevo** `GET /api/v1/secretarias` (readonly, 401 sin sesión):
  agregado por la etiqueta `secretaria` con `listSecretariaGroups()` en
  `server-query.service.ts`; conteos ok/warn/down con `deriveGlobalStatus`,
  excluye RETIRED. Id = valor del tag; `_sin_secretaria` para sin etiqueta.
- **Filtro nuevo** `?secretaria=` en `GET /api/v1/servers` (tolera clé
  `secretaria`/`secretaría`, insensitive); `_sin_secretaria` = tags none.
- **Página servers**: grid de contenedores toma la lista del endpoint
  (`visibleGroups`); con búsqueda/filtro de estado activos se intersecta en
  cliente contra `searchedServers` (los conteos pasan a calcularse del subset).
  La relación servidor↔secretaría se mantiene por el tag (identificador).
- **Estados**: carga (spinner role=status), error (banner con Reintentar) y
  vacío ("No encontramos contenedores").
- **ServerForm**: Secretaría municipal * y Servicio principal * (select:
  Aplicaciones/Base de datos/Archivos/Respaldo/Virtualización) obligatorios;
  se guardan como tags `secretaria` y `servicio`. Sub-línea de tabla = `IP ·
  servicio principal` (fallback SO).
- **Sincronización de agregados**: mount, `onCatalogChange`, refresco manual y
  cada 60 s (`setInterval` de secretarias).

## Gotchas (fase 2)

- ⚠️ **NUNCA correr `pnpm build` con el dev server vivo**: el build
  sobrescribe `.next` de desarrollo y el servidor queda corrupto
  («Cannot find the middleware module», `GET /servers 404`, ENOENT
  vendor-chunks). Solución: matar procesos en puertos 3000/3001, borrar
  `.next`, reiniciar `pnpm dev`.
- Secretaría id del contenedor ≠ nombre: el grupo sin etiqueta tiene id
  `_sin_secretaria`; la vista interna resuelve el nombre legible con
  `selectedSecretariaName`.
- En `getByText("Secretaría de Hacienda")` el primer match es el
  `<option>` oculto del filtro; en scripts E2E usar
  `getByRole("button", { name: /.../ })`.
- El mensaje de validación HTML5 nativo no existe como texto del DOM;
  asserting con `input:invalid` + modal open.
