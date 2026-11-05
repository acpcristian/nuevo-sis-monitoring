/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Self-test de comportamiento E2E del rediseño UI/UX (definición de hecha
 * reforzada). Login real, recorrido por la nueva vista de Secretarías →
 * interna, alta de servidor por modal y badge de la sidebar.
 * Uso: SUPERADMIN_USER=... SUPERADMIN_PASSWORD=... node verify-redesign.js
 * Saca capturas en test-results/redesign/.
 */
const { chromium } = require("@playwright/test");

const BASE = "http://localhost:3000";
const user = process.env.SUPERADMIN_USER;
const pass = process.env.SUPERADMIN_PASSWORD;

if (!user || !pass) {
  console.error("Faltan SUPERADMIN_USER/SUPERADMIN_PASSWORD en el entorno");
  process.exit(2);
}

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const results = [];
  const check = (name, ok, extra = "") => {
    results.push({ name, ok, extra });
    console.log(`${ok ? "✅" : "❌"} ${name}${extra ? ` — ${extra}` : ""}`);
  };

  // 1. Login capturando cookie de sesión
  const loginRes = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user, password: pass }),
  });
  check("Login API", loginRes.ok, `status ${loginRes.status}`);
  if (!loginRes.ok) throw new Error("Login falló; aborto");
  const cookie = loginRes.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  await context.addCookies([
    {
      name: cookie.split("=")[0],
      value: cookie.split("=").slice(1).join("="),
      url: BASE,
    },
  ]);

  // 2. Página de servidores (nueva vista de contenedores)
  await page.goto(`${BASE}/servers`, { waitUntil: "domcontentloaded" });

  // Sidebar institucional visible en escritorio
  const sidebar = page.locator("aside").first();
  await sidebar.waitFor();
  const box = await sidebar.boundingBox();
  check("Sidebar fija visible 248px", Math.abs(box.width - 248) < 4, `ancho ${box.width}`);
  await sidebar
    .getByText("NexoControl")
    .first()
    .waitFor({ timeout: 5000 })
    .then(() => check("Branding NexoControl visible", true))
    .catch(() => check("Branding NexoControl visible", false));

  const onlineBadge = page.getByText("EN LÍNEA", { exact: true });
  await onlineBadge.waitFor({ timeout: 5000 }).then(() => check("Barra superior con EN LÍNEA", true)).catch(() => check("Barra superior con EN LÍNEA", false));

  await page.getByRole("button", { name: "Agregar servidor" }).first().waitFor({ timeout: 10000 });
  check("Botón «Agregar servidor»", true);
  check("Encabezado «Servidores»", await page.getByRole("heading", { name: "Servidores", exact: true }).isVisible());
  check("Breadcrumb Administración / Servidores", await page.getByRole("navigation", { name: "Ruta actual" }).getByText("Administración", { exact: true }).isVisible());

  await page.screenshot({ path: "test-results/redesign/01-contenedores.png", fullPage: true });

  // 3. Alta de un servidor de la Secretaría de Hacienda por modal (nombre único por corrida)
  await page.getByRole("button", { name: "Agregar servidor" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("heading", { name: "Agregar servidor" }).waitFor();
  check("Modal «Agregar servidor» abre", true);

  const uniqueName = `SRV-HAC-${String(Math.floor(Math.random() * 90) + 10)}`;
  await dialog.getByLabel("Nombre Identificativo *").fill(uniqueName);
  await dialog.getByLabel("Dirección IP o Hostname *").fill("127.0.0.1");
  await dialog.getByLabel("Secretaría municipal").fill("Secretaría de Hacienda");
  await dialog.getByLabel("Clave Privada PEM *").or(dialog.getByLabel("Contraseña en Claro *")).first().fill("dummy-secret-para-sondeo-local");
  await page.screenshot({ path: "test-results/redesign/02-modal.png", fullPage: true });

  const mensajeErrorRegistro = page.locator("form").locator("div.bg-rose-50").first();
  await dialog.getByRole("button", { name: /Dar de Alta Servidor/ }).click();
  await Promise.race([
    page.getByText("Servidor registrado correctamente").waitFor({ timeout: 25000 }),
    mensajeErrorRegistro.waitFor({ timeout: 25000 }),
  ])
    .then(async () => {
      const ok = await page
        .getByText("Servidor registrado correctamente")
        .isVisible()
        .catch(() => false);
      check("Alta servidor + toast", Boolean(ok), ok ? "" : "error visible en el formulario");
    })
    .catch(() => check("Alta servidor + toast", false, "sin respuesta del formulario"));

  await page.screenshot({ path: "test-results/redesign/03-post-alta.png", fullPage: true });

  // 4. La secretaría creada aparece como tarjeta y entramos
  const card = page.getByRole("button", { name: /Secretaría de Hacienda/ }).first();
  try {
    await card.waitFor({ timeout: 10000 });
    check("Tarjeta de secretaría visible", true);
    await card.click();
    await page.getByRole("button", { name: "Volver a contenedores" }).waitFor({ timeout: 5000 });
    check("Vista interna con «Volver a contenedores»", true);
    check("Tabla interna muestra SRV-HAC-01", await page.getByText("SRV-HAC-01").first().isVisible());
    await page.screenshot({ path: "test-results/redesign/04-vista-interna.png", fullPage: true });

    // Móvil: drawer de sidebar
    await page.setViewportSize({ width: 390, height: 844 });
    const drawer = page.locator("aside").nth(1);
    const menuButton = page.getByRole("button", { name: "Abrir menú" });

    const readDrawerX = async () => {
      await drawer.waitFor({ state: "visible" });
      const aBox = await drawer.boundingBox();
      return aBox?.x ?? -9999;
    };

    let x = await readDrawerX();
    await menuButton.click();
    await page.waitForTimeout(350); // duración de la transición + margen
    x = await readDrawerX();
    if (x < 0) {
      await menuButton.click();
      await page.waitForTimeout(350);
      x = await readDrawerX();
    }
    check("Drawer móvil abierto y visible", x >= 0, `x=${x}`);
    check("Branding en drawer móvil", await drawer.getByText("NexoControl").first().isVisible());
    await menuButton.isVisible().then(async (v) => {
      if (v) {
        // Cerrar por capa oscura (clic fuera) para validar el cierre
        await page.locator('div[aria-hidden="true"]').first().click({ force: true, position: { x: 380, y: 700 } });
        await page.waitForTimeout(350);
        const closedX = await readDrawerX();
        check("Drawer se cierra con capa oscura", closedX < 0, `x=${closedX}`);
      }
    });
    await page.screenshot({ path: "test-results/redesign/05-movil-drawer.png", fullPage: true });
  } catch (error) {
    check("Flujo de secretaría", false, String(error).slice(0, 200));
    await page.screenshot({ path: "test-results/redesign/error-flujo.png", fullPage: true });
  }

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\nResultado: ${results.length - failed.length}/${results.length} verificaciones OK`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
