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

## Producción (Coolify)

- Panel: `https://panel.elalto.gob.bo` (red interna del municipio; resuelve a
  `172.16.100.22`). ⚠️ Su certificado TLS NO es confiable: PowerShell y curl
  fallan sin `-k`; usar curl con `-k` para el API.
- App: `nuevo-sis-monitoring` uuid `gqe0clxgeedygjtnwqzpagpw`, branch `main`,
  status `running:healthy`. Credenciales en `.env` como `COOLIFY_API_URL`,
  `COOLIFY_API_TOKEN` (NUNCA publicar el token en el chat).
- URL pública de la app (delta hoy): `http://gqe0clxgeedygjtnwqzpagpw.172.16.100.22.sslip.io`
  — solo LAN (sslip.io con IP interna). El dueño elvió dejarla así; si pide
  `https://nexocontrol.elalto.gob.bo` hay que crear registro DNS A →
  172.16.100.22 y luego PATCH `domains` en Coolify (Let's Encrypt elegido).
- Healthcheck prod: `GET /api/health` → 200 `{"status":"ok"}`.
- Deploy verificado 2026-11-05 con el commit `0f573f2` (rediseño +
  secretarias): deploy forzado vía `POST /api/v1/deploy {"uuid":..., `
  `"force":true}`, ~6 min de build, y el endpoint nuevo `GET
  /api/v1/secretarias` responde 401 (código nuevo en producción).

### Gotchas

- El `COOLIFY_API_URL` original era un placeholder (`panel-coolify.tudominio.com`
  → web aparcada que responde 200 HTML) y el `COOLIFY_APP_UUID` inicial NO
  correspondía a la app ("Application not found"); para descubrir el uuid
  correcto: `GET /api/v1/applications` y filtrar por `git_repository`.
- `Invoke-RestMethod` de PowerShell NO logra pasar el certificado del panel
  aunque se setee `ServerCertificateValidationCallback` ("Error inesperado de
  envío"); curl `-k` sí funciona → usar curl para todo el API de Coolify.
- Los PNG de evidencia viven en `test-results/redesign/` (commit `0f573f2`).

## Dominio de producción (actualización)

- ⭐ Desde 2026-11-05 de noche la app sirve con HTTPS y Let's Encrypt en
  `https://nexocontrol.elalto.gob.bo` (A → 172.16.100.22, configurado en
  Coolify por el equipo del municipio NO por el agente). curl SIN `-k`
  valida el certificado: el proxy emisario ya entrega ACME válido.
- El FQDN viejo `http://gqe0...172.16.100.22.sslip.io` quedó DESHABilitado
  (Traefik regeneró labels al Host nuevo → Go 404). Usar NUNCA más el sslip.
- Barra superior contrastada (commit `9efae9e`): fondo `--sidebar-bg`
  #151d2d, breadcrumb con tokens sidebar, EN LÍNEA verde claro (#7ee2b0).
  Verificado visualmente con localStorage… captura 08-header-contraste.png.
- El modificar `/95` NO aplica a variables CSS en Tailwind
  (`bg-[var(--x)]/95` genera nada); usar el token completo sin opacidad.
- En localhost el puerto 3000 puede estar ocupado por el panel demo viejo
  (`src/server.js` de OTRO proyecto del dueño): NO matarlo; levantar el dev
  del SIS con `pnpm dev --port 3002`.

- Integración agente SSH ya DESPLEGADA (commits `32946b0`, `6b2e85e`):
  - El estado UNKNOWN no era del agente sino del **tick del monitor** que
    sobrescribía todos los servicios cada 15 s («Sin puerto ni endpoint
    configurado…»). Corregido: el tick EXCLUYE servicios sin port/endpoint
    y preserva el estado que reportó el agente.
  - Agente v3: mapa `ss -tlnp`/`netstat -tlnp` → puertos en escucha por
    unidad (MainPID + nombre de proceso), estado exacto vía
    `systemctl show -p ActiveState/-p Description/-p MainPID` (1 llamada),
    lista blanca ANCLADA (falsos positivos eliminados: kmod-static-nodes
    casaba 'node', systemd-tpm2 casaba 'pm2') y campo `puertos` en el
    item systemd; mapper llena `port` para ambos orígenes.
  - Al re-escanear, cada servicio queda con `lastResult`: «Verificado por
    agente SSH — escuchando en el puerto N / servicio local sin puertos
    publicados».
  - ⚠️ Tras NUEVO deploy hay que volver a disparar el escaneo por servidor
    (botón «Probar conexión» del detalle, que hace handshake + discovery,
    o el endpoint manual) para refrescar estado/puerto de los servicios
    ya persistidos con el esquema viejo.
  - Cert LE sigue default (TRAEFIK DEFAULT CERT) a la fecha; la app
    responde 200 con -k en producción; pendiente log del proxy/NAT.

## Pendiente crítico (heredado)

- `POST /api/v1/auth/login` en producción responde 500 con CUALQUIER
  usuario (también inexistente) → falla en ruta común de
  `AuthService.login()` (seed superadmin / auditoría). La BD está sana
  (monitor corre, db push sincronizado, variables completas). El stack
  exacto solo está en los logs del contenedor: el dueño debe pegar las
  líneas «Error en POST /api/v1/auth/login» del panel (Logs) para
  diagnosticar. El login en producción funcionaba antes del día 2026-11-05.

## Integración del agente SSH al backend (2026-11-05, commit `32946b0`)

- `SshAgentProbe` (`src/infrastructure/network/ssh-agent-probe.ts`):
  `conn.exec("bash -s -u")` transmitiendo `scripts/nexo_agent.sh` por
  stdin (nunca se instala en el remoto), timeouts handshake 6 s / global
  25 s, cap stdout 512 KB, clasificación de errores idéntica a SshProbe.
- `AgentDiscoveryService` (`agent-discovery.service.ts` + mapper puro
  `agent-payload-mapper.ts`): escaneo SOLO a demanda —jamás en el tick de
  60 s— con guard anti-scaneos en vuelo por servidor, parseo JSON estricto
  (tolera únicamente BOM + espacios perimetrales), doble upsert por
  `(serverId, name)` → los servicios creados a mano nunca se eliminan.
  Mapeo: systemd active→RUNNING, inactive→STOPPED, failed→ERROR;
  docker running→RUNNING, exited/created/paused→STOPPED, dead→ERROR;
  primer puerto host parseado de `puertos` (`0.0.0.0:8080->80/tcp`→8080).
- Ganchos: `createServer` (tras handshake SUCCESS), `testConnection`
  (discovery en la respuesta, campo `discovery`), PATCH de rotación
  (post-tx si cambió credencial/IP/puerto) y endpoint manual
  `POST /servers/[id]/discover-services` (SuperAdmin, auditoría
  `SERVICES_DISCOVERED` agregada a `AUDIT_ACTIONS`).
- Suite: 176/176 tests (16 nuevos del mapper), tsc y build limpios.
  El script NUNCA lee otros modos: credencial descifrada en memoria
  (AES-GCM) solo durante la ejecución.
- ⚠️ Post-deploy `xh3yxxcftwujmztg9fwjgijc` (finished, app
  running:healthy) Traefik quedó sirviendo el TRAEFIK DEFAULT CERT para
  el dominio: HTTPS estricto falla (curl sin -k → 000) aunque la app
  responde 200 con -k, :80 → 302 a https y el desafío ACME routes ok.
  Reinicio del proxy (API /proxy/restart) NO lo resolvió. Sospechas:
  acme.json vaciado en el reinicio de Traefik de 03:28 UTC o racha
  externa (NAT 80/443 pública / rate-limit LE). Falta ver el log del
  proxy en el panel (Servers → Proxy → Logs) o el estado del NAT
  público — intercambio con el dueño pendiente.
