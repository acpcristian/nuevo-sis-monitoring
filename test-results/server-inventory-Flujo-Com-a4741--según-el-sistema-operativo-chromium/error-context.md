# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: server-inventory.spec.ts >> Flujo Completo E2E: Gestión e Inventario de Servidores >> debe mostrar campos dinámicos de credencial según el sistema operativo
- Location: tests\e2e\server-inventory.spec.ts:22:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Contraseña en Claro *')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('Contraseña en Claro *') with timeout 5000ms
  - waiting for getByText('Contraseña en Claro *')

```

```yaml
- link "Volver al Inventario":
  - /url: /servers
  - img
  - text: Volver al Inventario
- heading "Alta de Servidor" [level=1]
- paragraph: Incorpora un nuevo servidor físico o virtual al sistema de observabilidad.
- img
- heading "Registrar Nuevo Servidor" [level=2]
- paragraph: Añadir nodo al inventario con verificación segura de conectividad en modo solo lectura.
- text: Nombre Identificativo *
- textbox "srv-prod-web-01"
- text: Dirección IP o Hostname *
- textbox "192.168.10.15"
- text: Sistema Operativo *
- combobox:
  - option "Linux (SSH)"
  - option "Windows Server (WinRM / TCP)" [selected]
  - option "Otro Sistema Operativo"
- text: Distribución / Versión
- textbox "Ubuntu 24.04 LTS": Ubuntu 24.04
- text: Entorno Operativo *
- combobox:
  - option "Producción (PROD)" [selected]
  - option "Staging / Pre-producción"
  - option "Desarrollo (DEV)"
  - option "Control de Calidad (QA)"
- text: Puerto de Conexión *
- spinbutton: "22"
- img
- heading "Credencial Técnica de Sondeo" [level=3]
- img
- text: Cifrado AES-256-GCM Usuario Técnico *
- textbox "mon-user"
- text: Tipo de Secreto
- combobox:
  - option "Clave Privada SSH (Recomendado)" [selected]
  - option "Contraseña de Servicio"
- text: Clave Privada PEM *Cargar archivo .pem / .key
- button "Cargar archivo .pem / .key"
- textbox "-----BEGIN OPENSSH PRIVATE KEY----- ...":
  - /placeholder: "-----BEGIN OPENSSH PRIVATE KEY-----\n..."
- text: Passphrase de la Clave (opcional)
- textbox "Opcional si la clave está protegida"
- text: Responsable Técnico
- textbox "Equipo InfraOps / dba-team@corp.local"
- text: Etiquetas (clave=valor, separadas por coma)
- textbox "datacenter=us-east, tier=backend": role=app, tier=frontend
- text: Descripción / Propósito
- textbox "Notas operativas, criticidad o servicios alojados..."
- button "Cancelar"
- button "Dar de Alta Servidor"
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("Flujo Completo E2E: Gestión e Inventario de Servidores", () => {
  4  |   test("debe cargar la vista de inventario con controles de búsqueda y filtros", async ({ page }) => {
  5  |     await page.goto("/servers");
  6  | 
  7  |     // Verificar encabezado y controles
  8  |     await expect(page.getByRole("heading", { name: "Inventario de Servidores" })).toBeVisible();
  9  |     await expect(page.getByPlaceholder("Buscar por nombre, IP o host...")).toBeVisible();
  10 |     await expect(page.getByRole("link", { name: "Registrar Servidor" })).toBeVisible();
  11 |   });
  12 | 
  13 |   test("debe permitir navegar al formulario de alta de servidor", async ({ page }) => {
  14 |     await page.goto("/servers");
  15 |     await page.getByRole("link", { name: "Registrar Servidor" }).click();
  16 | 
  17 |     await expect(page).toHaveURL("/servers/new");
  18 |     await expect(page.getByRole("heading", { name: "Registrar Nuevo Servidor" })).toBeVisible();
  19 |     await expect(page.getByPlaceholder("srv-prod-web-01")).toBeVisible();
  20 |   });
  21 | 
  22 |   test("debe mostrar campos dinámicos de credencial según el sistema operativo", async ({ page }) => {
  23 |     await page.goto("/servers/new");
  24 | 
  25 |     // Default Linux -> SSH Key
  26 |     const osSelect = page.locator("select").first();
  27 |     await expect(osSelect).toHaveValue("LINUX");
  28 |     await expect(page.getByText("Clave Privada PEM *")).toBeVisible();
  29 | 
  30 |     // Cambiar a Windows -> Contraseña y puerto 5986
  31 |     await osSelect.selectOption("WINDOWS");
> 32 |     await expect(page.getByText("Contraseña en Claro *")).toBeVisible();
     |                                                           ^ Error: expect(locator).toBeVisible() failed
  33 |   });
  34 | });
  35 | 
  36 | 
```