import { test, expect } from "@playwright/test";

test.describe("Flujo Completo E2E: Gestión e Inventario de Servidores", () => {
  test("debe cargar la vista de inventario con controles de búsqueda y filtros", async ({ page }) => {
    await page.goto("/servers");

    // Verificar encabezado y controles
    await expect(page.getByRole("heading", { name: "Inventario de Servidores" })).toBeVisible();
    await expect(page.getByPlaceholder("Buscar por nombre, IP o host...")).toBeVisible();
    await expect(page.getByRole("link", { name: "Registrar Servidor" })).toBeVisible();
  });

  test("debe permitir navegar al formulario de alta de servidor", async ({ page }) => {
    await page.goto("/servers");
    await page.getByRole("link", { name: "Registrar Servidor" }).click();

    await expect(page).toHaveURL("/servers/new");
    await expect(page.getByRole("heading", { name: "Registrar Nuevo Servidor" })).toBeVisible();
    await expect(page.getByPlaceholder("srv-prod-web-01")).toBeVisible();
  });

  test("debe mostrar campos dinámicos de credencial según el sistema operativo", async ({ page }) => {
    await page.goto("/servers/new");

    // Default Linux -> SSH Key
    const osSelect = page.locator("select").first();
    await expect(osSelect).toHaveValue("LINUX");
    await expect(page.getByText("Clave Privada PEM *")).toBeVisible();

    // Cambiar a Windows -> Contraseña y puerto 5986
    await osSelect.selectOption("WINDOWS");
    await expect(page.getByText("Contraseña en Claro *")).toBeVisible();
  });
});

