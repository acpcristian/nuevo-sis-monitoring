# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: log-analysis.spec.ts >> Log Analysis E2E Tests >> Puertas de Seguridad (Constitución) >> Principio XIII: PII y credenciales enmascaradas antes de almacenamiento
- Location: tests\e2e\log-analysis.spec.ts:435:9

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 201
Received: 400
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - heading "Análisis de Logs" [level=1] [ref=e9]
      - paragraph [ref=e10]: Consulta y filtrado de registros de logs de servidores supervisados.
    - button "Refrescar" [disabled] [ref=e11]
  - generic [ref=e17]:
    - generic [ref=e18]:
      - textbox "Buscar por mensaje, servidor o ID..." [ref=e23]
      - generic [ref=e24]:
        - combobox [ref=e28]:
          - option "Todas las categorías" [selected]
          - option "Sistema/Kernel"
          - option "Autenticación"
          - option "Red/SSH"
          - option "Servicios"
          - option "Web"
          - option "Base de Datos"
          - option "Almacenamiento"
          - option "Backups"
          - option "Seguridad"
          - option "Agente"
        - combobox [ref=e34]:
          - option "Todas las severidades" [selected]
          - option "Info"
          - option "Advertencia"
          - option "Error"
          - option "Crítico"
        - button "Refrescar" [disabled] [ref=e35]
    - table [ref=e42]:
      - rowgroup [ref=e43]:
        - row [ref=e44]:
          - columnheader "Fecha del Evento" [ref=e45]
          - columnheader "Categoría" [ref=e46]
          - columnheader "Severidad" [ref=e47]
          - columnheader "Servidor" [ref=e48]
          - columnheader "Mensaje" [ref=e49]
          - columnheader "Acción" [ref=e50]
      - rowgroup [ref=e51]:
        - row [ref=e52]:
          - cell "No se encontraron eventos de log coincidentes con los filtros seleccionados." [ref=e53]
    - generic [ref=e54]:
      - generic [ref=e55]: Mostrando 0 de 0 eventos de log
      - text: "Zona horaria: Local del navegador con referencia UTC"
```

# Test source

```ts
  346 |       // Validar que ningún servidor muestra FRESH sin telemetría reciente
  347 |       data.items.forEach((item: any) => {
  348 |         expect(item.freshness_state).not.toBe("ONLINE"); // No existe estado ONLINE en frescura
  349 |       });
  350 |     });
  351 |   });
  352 | 
  353 |   test.describe("Puertas de Seguridad (Constitución)", () => {
  354 |     test("Principio III: 0% secretos en respuestas API a OBSERVADOR", async ({ page }) => {
  355 |       const response = await page.request.get(`${baseURL}/api/v1/logs`, {
  356 |         headers: { Authorization: `Bearer ${observerToken}` },
  357 |       });
  358 | 
  359 |       expect(response.status()).toBe(200);
  360 |       const data = await response.json();
  361 |       // Verificar que ningún item tiene raw_log
  362 |       data.items.forEach((item: any) => {
  363 |         expect(item.raw_log).toBeNull();
  364 |       });
  365 |     });
  366 | 
  367 |     test("Principio IV: OBSERVADOR solo lectura en diagnósticos", async ({ page }) => {
  368 |       const response = await page.request.get(`${baseURL}/api/v1/diagnoses`, {
  369 |         headers: { Authorization: `Bearer ${observerToken}` },
  370 |       });
  371 | 
  372 |       expect(response.status()).toBe(200); // Lectura permitida
  373 |     });
  374 | 
  375 |     test("Principio VI: Auditoría append-only para ingestión", async ({ page }) => {
  376 |       await page.request.post(`${baseURL}/api/v1/logs`, {
  377 |         headers: { Authorization: `Bearer ${superAdminToken}`, "Content-Type": "application/json" },
  378 |         data: {
  379 |           server_id: "550e8400-e29b-41d4-a716-446655440000",
  380 |           event_timestamp: new Date().toISOString(),
  381 |           severity: "INFO",
  382 |           message: "Test audit log",
  383 |         },
  384 |       });
  385 | 
  386 |       // La auditoría se verifica indirectamente (no hay endpoint público de auditoría)
  387 |       // Este test documenta el requisito
  388 |       expect(true).toBe(true);
  389 |     });
  390 | 
  391 |     test("Principio VII: Diagnósticos distinguen hechos de inferencias", async ({ page }) => {
  392 |       const event = await page.request.post(`${baseURL}/api/v1/logs`, {
  393 |         headers: { Authorization: `Bearer ${superAdminToken}`, "Content-Type": "application/json" },
  394 |         data: {
  395 |           server_id: "550e8400-e29b-41d4-a716-446655440000",
  396 |           event_timestamp: new Date().toISOString(),
  397 |           severity: "ERROR",
  398 |           message: "Test event for diagnosis",
  399 |         },
  400 |       });
  401 |       const eventId = (await event.json()).id;
  402 | 
  403 |       const diag = await page.request.post(`${baseURL}/api/v1/diagnoses`, {
  404 |         headers: { Authorization: `Bearer ${superAdminToken}`, "Content-Type": "application/json" },
  405 |         data: {
  406 |           event_ids: [eventId],
  407 |           observed_facts: "Hecho observado: 5 errores en 1 minuto",
  408 |           probable_cause: "Inferencia: probable fuga de memoria",
  409 |           evidence_support: { event_ref: eventId },
  410 |           confidence_level: "MEDIUM",
  411 |         },
  412 |       });
  413 | 
  414 |       expect(diag.status()).toBe(201);
  415 |       const diagnosis = await diag.json();
  416 |       expect(diagnosis.observed_facts).toContain("Hecho observado");
  417 |       expect(diagnosis.probable_cause).toContain("Inferencia");
  418 |       expect(diagnosis.evidence_support).toBeDefined();
  419 |     });
  420 | 
  421 |     test("Principio VIII: Alertas deduplican tormentas", async ({ page }) => {
  422 |       // Verificar que la deduplicación está implementada en el servicio
  423 |       const response = await page.request.get(`${baseURL}/api/v1/alerts`, {
  424 |         headers: { Authorization: `Bearer ${superAdminToken}` },
  425 |       });
  426 | 
  427 |       expect(response.status()).toBe(200);
  428 |       const data = await response.json();
  429 |       // Si hay alertas, verificar que tienen event_count > 1 para tormentas
  430 |       data.items.forEach((alert: any) => {
  431 |         expect(alert.event_count).toBeGreaterThanOrEqual(1);
  432 |       });
  433 |     });
  434 | 
  435 |     test("Principio XIII: PII y credenciales enmascaradas antes de almacenamiento", async ({ page }) => {
  436 |       const response = await page.request.post(`${baseURL}/api/v1/logs`, {
  437 |         headers: { Authorization: `Bearer ${superAdminToken}`, "Content-Type": "application/json" },
  438 |         data: {
  439 |           server_id: "550e8400-e29b-41d4-a716-446655440000",
  440 |           event_timestamp: new Date().toISOString(),
  441 |           severity: "ERROR",
  442 |           message: "User john.doe@example.com login failed with password=secret123",
  443 |         },
  444 |       });
  445 | 
> 446 |       expect(response.status()).toBe(201);
      |                                 ^ Error: expect(received).toBe(expected) // Object.is equality
  447 |       const data = await response.json();
  448 |       expect(data.sanitized_message).not.toContain("john.doe@example.com");
  449 |       expect(data.sanitized_message).not.toContain("secret123");
  450 |       expect(data.sanitized_message).toContain("[REDACTED_EMAIL]");
  451 |       expect(data.sanitized_message).toContain("[REDACTED]");
  452 |     });
  453 |   });
  454 | });
```