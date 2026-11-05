import { test, expect } from "@playwright/test";

test.describe("Flujo Completo E2E: Inventario de Servidores por Secretarías", () => {
  test("debe cargar la vista de inventario con contenedores de secretarías", async ({ page }) => {
    await page.goto("/servers");

    // Verificar encabezado institucional
    await expect(page.getByRole("heading", { name: "Servidores", exact: true })).toBeVisible();
    await expect(
      page.getByText("Secretarías municipales", { exact: true })
    ).toBeVisible();

    // Controles de búsqueda y filtros de la spec
    await expect(
      page.getByPlaceholder("Buscar por nombre, IP o secretaría...")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Agregar servidor" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Limpiar" })).toBeVisible();
  });

  test("debe abrir el modal de alta desde la vista general", async ({ page }) => {
    await page.goto("/servers");
    await page.getByRole("button", { name: "Agregar servidor" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Agregar servidor" })).toBeVisible();
    await expect(dialog.getByPlaceholder("srv-prod-web-01")).toBeVisible();
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

  test("debe permitir entrar y volver de una secretaría", async ({ page }) => {
    await page.goto("/servers");

    // La primera tarjeta de secretaría clicable muestra "X servidores"
    const firstCard = page.getByRole("button", { name: /servidores/ }).first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();

    // Vista interna: botón de regreso visible
    await expect(page.getByRole("button", { name: "Volver a contenedores" })).toBeVisible();
    await expect(page.getByText("Servidores asignados a esta secretaría municipal.")).toBeVisible();

    // Regresar a contenedores
    await page.getByRole("button", { name: "Volver a contenedores" }).click();
    await expect(page.getByText("Secretarías municipales", { exact: true })).toBeVisible();
  });
});
