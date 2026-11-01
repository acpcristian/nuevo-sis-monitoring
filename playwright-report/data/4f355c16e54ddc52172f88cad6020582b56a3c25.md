# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: log-analysis.spec.ts >> Log Analysis E2E Tests >> Flujo 2: Consulta y Filtrado de Logs (OBSERVADOR) >> no debe exponer raw_log a OBSERVADOR
- Location: tests\e2e\log-analysis.spec.ts:108:9

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 500
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
  27  |           message: "Failed password for invalid user admin from 10.0.0.5 port 2222 ssh2",
  28  |           raw_log: "Oct 29 10:00:01 sshd[1234]: Failed password for invalid user admin from 10.0.0.5 port 2222 ssh2",
  29  |         },
  30  |       });
  31  | 
  32  |       expect(response.status()).toBe(201);
  33  |       const data = await response.json();
  34  |       expect(data.category).toBe("AUTH_ACCESS");
  35  |       expect(data.severity).toBe("ERROR");
  36  |       expect(data.id).toBeDefined();
  37  |       expect(data.sanitized_message).toBeDefined();
  38  |       expect(data.is_untrusted).toBe(true);
  39  |     });
  40  | 
  41  |     test("debe clasificar automáticamente un log de seguridad como SECURITY_AUDIT", async ({ page }) => {
  42  |       const response = await page.request.post(`${baseURL}/api/v1/logs`, {
  43  |         headers: {
  44  |           Authorization: `Bearer ${superAdminToken}`,
  45  |           "Content-Type": "application/json",
  46  |         },
  47  |         data: {
  48  |           server_id: "550e8400-e29b-41d4-a716-446655440000",
  49  |           event_timestamp: "2026-10-29T10:05:00Z",
  50  |           severity: "CRITICAL",
  51  |           message: "Security alert: intrusion detected from external IP",
  52  |           raw_log: "ALERT: Security breach detected on interface eth0",
  53  |         },
  54  |       });
  55  | 
  56  |       expect(response.status()).toBe(201);
  57  |       const data = await response.json();
  58  |       expect(data.category).toBe("SECURITY_AUDIT");
  59  |     });
  60  | 
  61  |     test("debe clasificar automáticamente un log de base de datos como DATABASE", async ({ page }) => {
  62  |       const response = await page.request.post(`${baseURL}/api/v1/logs`, {
  63  |         headers: {
  64  |           Authorization: `Bearer ${superAdminToken}`,
  65  |           "Content-Type": "application/json",
  66  |         },
  67  |         data: {
  68  |           server_id: "550e8400-e29b-41d4-a716-446655440000",
  69  |           event_timestamp: "2026-10-29T10:10:00Z",
  70  |           severity: "ERROR",
  71  |           message: "PostgreSQL connection pool exhausted, query timeout",
  72  |           raw_log: "ERROR: database connection failed after 30s",
  73  |         },
  74  |       });
  75  | 
  76  |       expect(response.status()).toBe(201);
  77  |       const data = await response.json();
  78  |       expect(data.category).toBe("DATABASE");
  79  |     });
  80  |   });
  81  | 
  82  |   test.describe("Flujo 2: Consulta y Filtrado de Logs (OBSERVADOR)", () => {
  83  |     test("debe filtrar logs por categoría, servidor, severidad y rango de fechas", async ({ page }) => {
  84  |       // Primero ingestar algunos logs de prueba
  85  |       await page.request.post(`${baseURL}/api/v1/logs`, {
  86  |         headers: { Authorization: `Bearer ${superAdminToken}`, "Content-Type": "application/json" },
  87  |         data: {
  88  |           server_id: "550e8400-e29b-41d4-a716-446655440000",
  89  |           event_timestamp: "2026-10-29T10:00:00Z",
  90  |           severity: "CRITICAL",
  91  |           message: "Critical security event",
  92  |         },
  93  |       });
  94  | 
  95  |       // Consultar con filtros
  96  |       const response = await page.request.get(`${baseURL}/api/v1/logs?category=SECURITY_AUDIT&server_id=550e8400-e29b-41d4-a716-446655440000&severity=CRITICAL&from=2026-10-29T00:00:00Z&to=2026-10-29T23:59:59Z`, {
  97  |         headers: { Authorization: `Bearer ${observerToken}` },
  98  |       });
  99  | 
  100 |       expect(response.status()).toBe(200);
  101 |       const data = await response.json();
  102 |       expect(data.items).toBeDefined();
  103 |       expect(Array.isArray(data.items)).toBe(true);
  104 |       expect(data.total).toBeDefined();
  105 |       expect(data.page).toBe(1);
  106 |     });
  107 | 
  108 |     test("no debe exponer raw_log a OBSERVADOR", async ({ page }) => {
  109 |       const ingestResponse = await page.request.post(`${baseURL}/api/v1/logs`, {
  110 |         headers: { Authorization: `Bearer ${superAdminToken}`, "Content-Type": "application/json" },
  111 |         data: {
  112 |           server_id: "550e8400-e29b-41d4-a716-446655440000",
  113 |           event_timestamp: "2026-10-29T10:15:00Z",
  114 |           severity: "ERROR",
  115 |           message: "Test message with sensitive data",
  116 |           raw_log: "Original raw log with secrets",
  117 |         },
  118 |       });
  119 | 
  120 |       const eventId = (await ingestResponse.json()).id;
  121 | 
  122 |       // Consultar como OBSERVADOR
  123 |       const response = await page.request.get(`${baseURL}/api/v1/logs/${eventId}`, {
  124 |         headers: { Authorization: `Bearer ${observerToken}` },
  125 |       });
  126 | 
> 127 |       expect(response.status()).toBe(200);
      |                                 ^ Error: expect(received).toBe(expected) // Object.is equality
  128 |       const data = await response.json();
  129 |       expect(data.raw_log).toBeNull(); // OBSERVADOR no ve raw_log
  130 |       expect(data.sanitized_message).toBeDefined();
  131 |     });
  132 |   });
  133 | 
  134 |   test.describe("Flujo 3: Sanitización de Datos Sensibles (Principio III)", () => {
  135 |     test("debe enmascarar contraseñas en sanitized_message", async ({ page }) => {
  136 |       const response = await page.request.post(`${baseURL}/api/v1/logs`, {
  137 |         headers: {
  138 |           Authorization: `Bearer ${superAdminToken}`,
  139 |           "Content-Type": "application/json",
  140 |         },
  141 |         data: {
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
```