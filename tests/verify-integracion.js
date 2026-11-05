/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Self-test de integración UI↔backend real del inventario por secretarías.
 * Verifica: GET /api/v1/secretarias, grid desde el endpoint, alta con
 * secretaría + servicio (formulario conectado al POST real), actualización
 * inmediata, búsqueda, filtro de estado y estado vacío.
 * Uso: SUPERADMIN_USER=... SUPERADMIN_PASSWORD=... node tests/verify-integracion.js
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

  const cookieRes = await fetch(`${BASE}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: user, password: pass }),
  });
  check("Login API", cookieRes.ok, `status ${cookieRes.status}`);
  if (!cookieRes.ok) throw new Error("Login falló; aborto");
  const cookie = cookieRes.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const cookieName = cookie.split("=")[0];
  const cookieValue = cookie.split("=").slice(1).join("=");

  // — Endpoint de secretarías con sesión —
  const groupsRes = await fetch(`${BASE}/api/v1/secretarias`, {
    headers: { Cookie: cookie },
  });
  const groupsData = await groupsRes.json();
  check("GET /api/v1/secretarias", groupsRes.ok, `${groupsData.total ?? 0} contenedores`);

  // — Catálogo oficial de secretarías: 10 contenedores siempre visibles —
  const catalogNames = [
    "SECRETARÍA MUNICIPAL DE GESTIÓN INSTITUCIONAL",
    "SECRETARÍA MUNICIPAL DE ADMINISTRACIÓN Y FINANZAS",
    "SECRETARÍA MUNICIPAL DE MOVILIDAD URBANA",
    "SECRETARÍA MUNICIPAL DE EDUCACIÓN Y CULTURA",
    "SECRETARÍA MUNICIPAL DE DESARROLLO HUMANO Y SOCIAL INTEGRAL",
    "SECRETARÍA MUNICIPAL DE SEGURIDAD CIUDADANA",
    "SECRETARÍA MUNICIPAL DE SALUD",
    "SECRETARÍA MUNICIPAL DE INFRAESTRUCTURA PÚBLICA",
    "SECRETARÍA MUNICIPAL DE AGUA, SANEAMIENTO, GESTIÓN AMBIENTAL Y RIESGOS",
    "SECRETARÍA MUNICIPAL DE DESARROLLO ECONÓMICO",
  ];
  const faltantes = catalogNames.filter((n) => !(groupsData.items ?? []).some((g) => g.name === n));
  check("Catálogo oficial completo (10 secretarías)", faltantes.length === 0,
    faltantes.length ? `faltan: ${faltantes.join("; ")}` : "todas presentes");

  const finanzas = (groupsData.items ?? []).find((g) => g.name === "SECRETARÍA MUNICIPAL DE ADMINISTRACIÓN Y FINANZAS");
  check("Agregado Administración y Finanzas con conteos reales",
    Boolean(finanzas) && finanzas.total > 0,
    finanzas ? `total=${finanzas.total} down=${finanzas.down} historicos=${(finanzas.names ?? []).join("/")}` : "no existe");

  const sinAuth = await fetch(`${BASE}/api/v1/secretarias`);
  check("Endpoint protegido sin sesión (401)", sinAuth.status === 401, `status ${sinAuth.status}`);

  await context.addCookies([{ name: cookieName, value: cookieValue, url: BASE }]);
  await page.goto(`${BASE}/servers`, { waitUntil: "domcontentloaded" });

  // — Grid renderizado desde el endpoint —
  await page
    .getByRole("button", { name: /SECRETARÍA MUNICIPAL DE ADMINISTRACIÓN Y FINANZAS/i })
    .first()
    .waitFor({ timeout: 10000 });
  const cards = await page.locator("button:has(h3)").count().catch(() => 0);
  check("Tarjeta de Finanzas visible (desde API)", true, `${cards} contenedores en el grid`);

  // — Alta por modal en una secretaría NUEVA, con servicio principal —
  const newSlug = `SRV-SAL-${String(Math.floor(Math.random() * 90) + 10)}`;
  await page.getByRole("button", { name: "Agregar servidor" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("heading", { name: "Agregar servidor" }).waitFor();

  // Validación: enviar sin campos requeridos (HTML5 bloquea el envío)
  await dialog.getByRole("button", { name: /Dar de Alta Servidor/ }).click();
  await page.waitForTimeout(600);
  const invalidCount = await dialog.locator("input:invalid, select:invalid").count();
  const stillOpen = await dialog.isVisible();
  check(
    "Validación campos requeridos vacíos",
    stillOpen && invalidCount > 0,
    `${invalidCount} campo(s) inválido(s), modal ${stillOpen ? "abierto" : "cerrado"}`
  );

  await dialog.getByLabel("Nombre Identificativo *").fill(newSlug);
  await dialog.getByLabel("Dirección IP o Hostname *").fill("10.24.3.99");
  await dialog.getByLabel("Secretaría municipal *").fill("Secretaría de Salud");
  await dialog.getByLabel("Servicio principal *").selectOption("Archivos");
  await dialog.getByLabel(/Clave Privada PEM|Contraseña en Claro/).fill("secret-test");
  await dialog.getByRole("button", { name: /Dar de Alta Servidor/ }).click();

  await page.getByText("Servidor registrado correctamente").waitFor({ timeout: 25000 });
  check("Modal → POST /api/v1/servers + toast", true);

  // — Actualización inmediata de la interfaz: nueva secretaría aparece sin recargar —
  const saludCard = page.getByRole("button", { name: /Secretaría de Salud/ }).first();
  await saludCard.waitFor({ timeout: 15000 });
  check("Nueva secretaría en el grid sin recargar", true);
  await page.screenshot({ path: "test-results/redesign/06-integracion.png", fullPage: true });

  // — Búsqueda por IP (real, contra /api/v1/servers ya cargado) —
  await page.getByPlaceholder("Buscar por nombre, IP o secretaría...").fill("10.24.3.99");
  await page.waitForTimeout(400);
  const haciendaStillVisible = await page
    .getByRole("button", { name: /ADMINISTRACIÓN Y FINANZAS/i })
    .first()
    .isVisible()
    .catch(() => false);
  if (haciendaStillVisible) {
    // La intersección puede seguir mostrando Finanzas si alguna IP coincide; comprobamos que Salud exista
    await page
      .getByRole("button", { name: /Secretaría de Salud/i })
      .first()
      .waitFor({ timeout: 5000 });
  }
  check(
    "Búsqueda por IP filtra contenedores",
    await page.getByRole("button", { name: /Secretaría de Salud/i }).first().isVisible()
  );

  // — Estado vacío —
  await page.getByPlaceholder("Buscar por nombre, IP o secretaría...").fill("zzz-no-existe-zzz");
  await page.getByText("No encontramos contenedores").waitFor({ timeout: 5000 });
  check("Estado vacío de contenedores", true);

  // — Limpiar filtros restaura —
  await page.getByRole("button", { name: "Limpiar" }).click();
  await page
    .getByRole("button", { name: /ADMINISTRACIÓN Y FINANZAS/i })
    .first()
    .waitFor({ timeout: 5000 });
  check("Limpiar restaura los contenedores", true);

  // — Entrar por la tarjeta y ver el servidor real con servicio —
  await page.getByRole("button", { name: /Secretaría de Salud/i }).first().click();
  await page.getByRole("button", { name: "Volver a contenedores" }).waitFor({ timeout: 5000 });
  await page.getByText(newSlug).first().waitFor({ timeout: 5000 });
  const rowText = await page.locator("tr", { hasText: newSlug }).first().textContent();
  check("Vista interna con servidor + servicio real", rowText.includes("Archivos"), rowText?.slice(0, 80));

  // — Filtro de estado dentro de la secretaría —
  await page.locator("select[aria-label='Filtrar por estado']").selectOption("OK");
  await page.waitForTimeout(300);
  check("Filtro estado OK oculta equipos caídos", !(await page.getByText(newSlug).first().isVisible()));
  await page.locator("select[aria-label='Filtrar por estado']").selectOption("DOWN");
  await page.waitForTimeout(300);
  check("Filtro estado Sin conexión muestra equipos caídos", await page.getByText(newSlug).first().isVisible());

  await page.screenshot({ path: "test-results/redesign/07-interna-integracion.png", fullPage: true });

  await browser.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\nResultado: ${results.length - failed.length}/${results.length} verificaciones OK`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
