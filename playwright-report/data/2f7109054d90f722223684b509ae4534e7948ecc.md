# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: log-analysis.spec.ts >> Log Analysis E2E Tests >> Flujo 4: Generación de Diagnóstico Estructurado (SUPERADMIN) >> debe crear un diagnóstico con todas las secciones requeridas
- Location: tests\e2e\log-analysis.spec.ts:199:9

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
  142 |           server_id: "550e8400-e29b-41d4-a716-446655440000",
  143 |           event_timestamp: "2026-10-29T10:20:00Z",
  144 |           severity: "ERROR",
  145 |           message: "Login failed for user admin with password=supersecret123",
  146 |           raw_log: "Login failed for user admin with password=supersecret123",
  147 |         },
  148 |       });
  149 | 
  150 |       expect(response.status()).toBe(201);
  151 |       const data = await response.json();
  152 |       expect(data.sanitized_message).not.toContain("supersecret123");
  153 |       expect(data.sanitized_message).toContain("[REDACTED]");
  154 |     });
  155 | 
  156 |     test("debe enmascarar tokens JWT", async ({ page }) => {
  157 |       const response = await page.request.post(`${baseURL}/api/v1/logs`, {
  158 |         headers: {
  159 |           Authorization: `Bearer ${superAdminToken}`,
  160 |           "Content-Type": "application/json",
  161 |         },
  162 |         data: {
  163 |           server_id: "550e8400-e29b-41d4-a716-446655440000",
  164 |           event_timestamp: "2026-10-29T10:25:00Z",
  165 |           severity: "ERROR",
  166 |           message: "Authorization header with token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
  167 |         },
  168 |       });
  169 | 
  170 |       expect(response.status()).toBe(201);
  171 |       const data = await response.json();
  172 |       expect(data.sanitized_message).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
  173 |       expect(data.sanitized_message).toContain("[REDACTED]");
  174 |     });
  175 | 
  176 |     test("debe enmascarar claves SSH", async ({ page }) => {
  177 |       const response = await page.request.post(`${baseURL}/api/v1/logs`, {
  178 |         headers: {
  179 |           Authorization: `Bearer ${superAdminToken}`,
  180 |           "Content-Type": "application/json",
  181 |         },
  182 |         data: {
  183 |           server_id: "550e8400-e29b-41d4-a716-446655440000",
  184 |           event_timestamp: "2026-10-29T10:30:00Z",
  185 |           severity: "ERROR",
  186 |           message: "SSH key: ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...",
  187 |           raw_log: "SSH key: ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...",
  188 |         },
  189 |       });
  190 | 
  191 |       expect(response.status()).toBe(201);
  192 |       const data = await response.json();
  193 |       expect(data.sanitized_message).not.toContain("AAAAB3NzaC1yc2EAAAADAQABAAABAQC");
  194 |       expect(data.sanitized_message).toContain("[REDACTED]");
  195 |     });
  196 |   });
  197 | 
  198 |   test.describe("Flujo 4: Generación de Diagnóstico Estructurado (SUPERADMIN)", () => {
  199 |     test("debe crear un diagnóstico con todas las secciones requeridas", async ({ page }) => {
  200 |       // Crear eventos de prueba
  201 |       const event1 = await page.request.post(`${baseURL}/api/v1/logs`, {
  202 |         headers: { Authorization: `Bearer ${superAdminToken}`, "Content-Type": "application/json" },
  203 |         data: {
  204 |           server_id: "550e8400-e29b-41d4-a716-446655440000",
  205 |           event_timestamp: "2026-10-29T11:00:00Z",
  206 |           severity: "ERROR",
  207 |           message: "Database connection pool exhausted",
  208 |         },
  209 |       });
  210 |       const event1Id = (await event1.json()).id;
  211 | 
  212 |       const event2 = await page.request.post(`${baseURL}/api/v1/logs`, {
  213 |         headers: { Authorization: `Bearer ${superAdminToken}`, "Content-Type": "application/json" },
  214 |         data: {
  215 |           server_id: "550e8400-e29b-41d4-a716-446655440000",
  216 |           event_timestamp: "2026-10-29T11:01:00Z",
  217 |           severity: "ERROR",
  218 |           message: "Query timeout on user table",
  219 |         },
  220 |       });
  221 |       const event2Id = (await event2.json()).id;
  222 | 
  223 |       // Crear diagnóstico
  224 |       const diagResponse = await page.request.post(`${baseURL}/api/v1/diagnoses`, {
  225 |         headers: {
  226 |           Authorization: `Bearer ${superAdminToken}`,
  227 |           "Content-Type": "application/json",
  228 |         },
  229 |         data: {
  230 |           event_ids: [event1Id, event2Id],
  231 |           observed_facts: "Servidor srv-db-prod-01 reporta 3 errores de conexión consecutivos en 2 minutos",
  232 |           probable_cause: "Agotamiento de conexiones en el pool de PostgreSQL",
  233 |           evidence_support: { log_ids: [event1Id, event2Id] },
  234 |           alternative_diagnoses: "Posible problema de red intermitente",
  235 |           impact_potential: "Servicio degradado para usuarios finales",
  236 |           verification_steps: "Revisar métricas de pool y logs de aplicación",
  237 |           remediation_recommendations: "Aumentar pool size y corregir fuga",
  238 |           confidence_level: "HIGH",
  239 |         },
  240 |       });
  241 | 
> 242 |       expect(diagResponse.status()).toBe(201);
      |                                     ^ Error: expect(received).toBe(expected) // Object.is equality
  243 |       const diagnosis = await diagResponse.json();
  244 |       expect(diagnosis.id).toBeDefined();
  245 |       expect(diagnosis.observed_facts).toContain("3 errores de conexión");
  246 |       expect(diagnosis.probable_cause).toContain("pool de PostgreSQL");
  247 |       expect(diagnosis.evidence_support).toBeDefined();
  248 |       expect(diagnosis.alternative_diagnoses).toContain("red intermitente");
  249 |       expect(diagnosis.impact_potential).toContain("degradado");
  250 |       expect(diagnosis.verification_steps).toContain("métricas de pool");
  251 |       expect(diagnosis.remediation_recommendations).toContain("pool size");
  252 |       expect(diagnosis.confidence_level).toBe("HIGH");
  253 |       expect(diagnosis.status).toBe("DRAFT");
  254 |       expect(diagnosis.events.length).toBe(2);
  255 |     });
  256 |   });
  257 | 
  258 |   test.describe("Flujo 5: Intento de Mutación No Autorizada por OBSERVADOR (Principio IV)", () => {
  259 |     test("debe devolver 403 cuando OBSERVADOR intenta crear diagnóstico", async ({ page }) => {
  260 |       const response = await page.request.post(`${baseURL}/api/v1/diagnoses`, {
  261 |         headers: {
  262 |           Authorization: `Bearer ${observerToken}`,
  263 |           "Content-Type": "application/json",
  264 |         },
  265 |         data: {
  266 |           event_ids: ["550e8400-e29b-41d4-a716-446655440000"],
  267 |           observed_facts: "Intento no autorizado",
  268 |           probable_cause: "Prueba de seguridad",
  269 |           confidence_level: "LOW",
  270 |         },
  271 |       });
  272 | 
  273 |       expect(response.status()).toBe(403);
  274 |       const data = await response.json();
  275 |       expect(data.error_code).toBe("FORBIDDEN_ACTION");
  276 |     });
  277 | 
  278 |     test("debe devolver 403 cuando OBSERVADOR intenta reconocer alerta", async ({ page }) => {
  279 |       const response = await page.request.patch(`${baseURL}/api/v1/alerts/some-id`, {
  280 |         headers: {
  281 |           Authorization: `Bearer ${observerToken}`,
  282 |           "Content-Type": "application/json",
  283 |         },
  284 |         data: { action: "acknowledge" },
  285 |       });
  286 | 
  287 |       expect(response.status()).toBe(403);
  288 |     });
  289 |   });
  290 | 
  291 |   test.describe("Flujo 6: Deduplicación de Alertas (Tormenta de Eventos)", () => {
  292 |     test("debe generar una única alerta agrupada para tormenta de eventos idénticos", async ({ page }) => {
  293 |       // Enviar múltiples eventos idénticos
  294 |       for (let i = 0; i < 5; i++) {
  295 |         await page.request.post(`${baseURL}/api/v1/logs`, {
  296 |           headers: { Authorization: `Bearer ${superAdminToken}`, "Content-Type": "application/json" },
  297 |           data: {
  298 |             server_id: "550e8400-e29b-41d4-a716-446655440000",
  299 |             event_timestamp: new Date(Date.now() + i * 1000).toISOString(),
  300 |             severity: "ERROR",
  301 |             message: "Error burst: connection refused",
  302 |             raw_log: "Error burst: connection refused",
  303 |           },
  304 |         });
  305 |       }
  306 | 
  307 |       // Consultar alertas
  308 |       const response = await page.request.get(`${baseURL}/api/v1/alerts`, {
  309 |         headers: { Authorization: `Bearer ${superAdminToken}` },
  310 |       });
  311 | 
  312 |       expect(response.status()).toBe(200);
  313 |       const data = await response.json();
  314 |       // Al menos una alerta debe existir
  315 |       expect(data.items.length).toBeGreaterThanOrEqual(0);
  316 |     });
  317 |   });
  318 | 
  319 |   test.describe("Flujo 7: Estado de Frescura de Datos (Principio VIII)", () => {
  320 |     test("debe devolver estados de frescura con valores válidos", async ({ page }) => {
  321 |       const response = await page.request.get(`${baseURL}/api/v1/freshness`, {
  322 |         headers: { Authorization: `Bearer ${observerToken}` },
  323 |       });
  324 | 
  325 |       expect(response.status()).toBe(200);
  326 |       const data = await response.json();
  327 |       expect(data.items).toBeDefined();
  328 |       expect(Array.isArray(data.items)).toBe(true);
  329 | 
  330 |       // Si hay items, validar estructura
  331 |       if (data.items.length > 0) {
  332 |         const item = data.items[0];
  333 |         expect(item.server_id).toBeDefined();
  334 |         expect(item.server_name).toBeDefined();
  335 |         expect(["FRESH", "STALE", "AGENT_DISCONNECTED", "UNREACHABLE"]).toContain(item.freshness_state);
  336 |       }
  337 |     });
  338 | 
  339 |     test("servidor sin telemetría debe ser STALE no FRESH", async ({ page }) => {
  340 |       const response = await page.request.get(`${baseURL}/api/v1/freshness`, {
  341 |         headers: { Authorization: `Bearer ${observerToken}` },
  342 |       });
```