# Phase 0: Research & Technical Decisions (001-server-inventory)

**Feature**: `001-server-inventory`  
**Date**: 2026-10-28  
**Status**: Completed  

---

## 1. Decisiones Técnicas y Arquitectónicas

### DEC-001: Framework de Aplicación y Arquitectura del Servicio
- **Decisión**: Aplicación web unificada Full-Stack en **TypeScript estricto** utilizando **Next.js 15+ (App Router)** o arquitectura desacoplada **Node.js (Fastify/Express) + React (Vite)**.
  - Para este proyecto crítico de monitoreo, se selecciona **Next.js (App Router) con TypeScript estricto** (`strict: true`, `noUncheckedIndexedAccess: true`), combinando Server Components (renderizado seguro en servidor sin filtración de datos de infraestructura al navegador), Route Handlers para la API REST v1 y Server Actions protegidas.
- **Rationale**:
  - Evita la duplicación de tipos de TypeScript entre cliente y servidor.
  - Las operaciones criptográficas (cifrado/descifrado de secretos) y conexiones SSH/WinRM se ejecutan exclusivamente en Node.js runtime del backend, garantizando que ninguna librería de red o secreto sea enviada al bundle del navegador (*Principio II y III*).
  - Facilita el empaquetado en un único contenedor Docker ligero para despliegue auto-hospedado (*Self-Hosted*) en Coolify o servidores dedicados.
- **Alternativas consideradas**:
  - *Fastify + Vite SPA separado*: Excelente rendimiento, pero incrementa la complejidad operativa al requerir dos procesos, gestión de CORS y sincronización manual de tipos.
  - *Go / Python backend + React*: Buen soporte de red, pero divide el stack en dos lenguajes sin ventaja significativa para la gestión de inventario y metadatos.

---

### DEC-002: Almacenamiento Seguro de Secretos y Cifrado en Reposo
- **Decisión**: Cifrado simétrico autenticado **AES-256-GCM** para todos los secretos de conexión (claves privadas SSH, contraseñas de servicio y tokens de agente) a nivel de aplicación antes de la persistencia en base de datos.
- **Especificación del Cifrado**:
  - **Algoritmo**: `aes-256-gcm` provisto por el módulo nativo `node:crypto`.
  - **Gestión de Claves**: Clave maestra de 256 bits derivada de la variable de entorno `ENCRYPTION_KEY` (32 bytes hex).
  - **Vector de Inicialización (IV)**: 12 bytes criptográficamente aleatorios (`randomBytes(12)`) generados por cada registro cifrado; nunca reutilizados.
  - **Tag de Autenticación**: 16 bytes (128 bits) para garantizar integridad y detectar manipulaciones en la base de datos.
  - **Estructura almacenada**:
    ```json
    {
      "encrypted_data": "<base64_ciphertext>",
      "iv": "<base64_iv>",
      "tag": "<base64_tag>",
      "key_fingerprint": "<sha256_public_fingerprint>"
    }
    ```
- **Rationale**:
  - Cumple estrictamente con el *Principio III (Gestión Segura de Credenciales)*. Si la base de datos o sus respaldos sufren una fuga, las claves privadas y contraseñas permanecen ilegibles sin la variable de entorno `ENCRYPTION_KEY`.
  - El cifrado autenticado (GCM) previene ataques de modificación de texto cifrado (*tampering*).
- **Alternativas consideradas**:
  - *Hashicorp Vault externo*: Robusto para grandes corporaciones, pero añade una dependencia pesada de infraestructura para despliegues auto-hospedados iniciales. Se diseñará una interfaz desacoplada `SecretVault` (*Principio X*) para permitir conectar Vault a futuro.
  - *AES-256-CBC*: No proporciona autenticación integrada de integridad, vulnerable a ataques de relleno (*padding oracle*). Descartado en favor de GCM.

---

### DEC-003: Mecanismo de Verificación y Sondeo No Intrusivo (Linux y Windows)
- **Decisión**: Conectividad basada en handshake y comprobación de estado de solo lectura mediante `ssh2` para Linux y socket TCP / WinRM HTTPS para Windows Server.
- **Protocolo de Comprobación Linux (SSH)**:
  - Uso de la librería de bajo nivel `ssh2` en Node.js.
  - Se negocia la conexión utilizando la clave privada descifrada temporalmente en memoria.
  - Al completar la autenticación, se consulta el banner / uname en una sesión no interactiva con timeout estricto de 5 segundos.
  - La conexión se cierra inmediatamente. **Bajo ninguna circunstancia se ejecutan comandos de escritura, sudo, reinicio de servicios o modificación de configuraciones** (*Principio V*).
- **Protocolo de Comprobación Windows (WinRM / TCP)**:
  - Verificación en dos etapas:
    1. Comprobación de apertura de puerto y latencia TCP (puerto 5986 HTTPS para WinRM seguro o puerto configurable).
    2. Handshake HTTP/Negotiate básico con timeout de 5 segundos.
- **Rationale**:
  - Garantiza que la recolección sea ligera, no intrusiva y predecible en el consumo de recursos de los servidores destino (*Principio V*).
  - Los fallos de red se discriminan con códigos específicos: `ETIMEDOUT` (`UNREACHABLE`), `ECONNREFUSED` (`PORT_CLOSED`), `AUTH_FAILURE` (`AUTHENTICATION_FAILED`).

---

### DEC-004: Base de Datos y Estrategia de Migraciones
- **Decisión**: **PostgreSQL 16+** como base de datos relacional transaccional, gestionada mediante **Prisma ORM** o **Drizzle ORM** con TypeScript.
- **Rationale**:
  - Cumple con los requerimientos de integridad referencial, transacciones ACID para operaciones de inventario y auditoría append-only (*Principio VI*).
  - Soporte nativo para columnas `JSONB` que permite indexar y consultar etiquetas dinámicas (*tags*) y metadatos específicos de plataforma sin sacrificar estructura relacional.
  - Migraciones de esquema versionadas en código, reproducibles y deterministas (*Principio IX y XIV*).
- **Alternativas consideradas**:
  - *MongoDB / Document DB*: Flexibilidad en esquemas, pero carece de la rigidez referencial requerida para auditorías inmutables y relaciones de permisos.
  - *SQLite*: Adecuado para desarrollo local, pero insuficiente para concurrencia empresarial y volumen de telemetría proyectado.

---

### DEC-005: Control de Acceso Basado en Roles (RBAC) en Backend
- **Decisión**: Validación de permisos en dos capas:
  1. **Middleware de Rutas (Edge/Route Guard)**: Valida la sesión activa y rechaza tokens inválidos o expirados con `401 Unauthorized`.
  2. **Domain Service Guard**: En cada función de servicio de negocio (`ServerService.create`, `ServerService.update`, `ServerService.retire`), se verifica que el rol del usuario autenticado coincida con `SUPERADMIN`.
  3. **DTO Sanitizer**: En las capas de salida de datos (`ServerPresenter` / serializers), se purga cualquier campo de credencial antes de serializar la respuesta HTTP para roles `OBSERVADOR`.
- **Rationale**:
  - Cumple con el *Principio IV (Mínimo Privilegio)*: la autorización no depende de la UI; peticiones directas fuera del navegador son bloqueadas con `403 Forbidden` y generan registro de auditoría.
- **Alternativas consideradas**:
  - *RBAC solo en frontend*: Violación constitucional inaceptable (*Principio IV*).

---

## 2. Resumen de Respuestas a Posibles Ambigüedades

1. **¿Qué ocurre si un servidor no tiene clave SSH y requiere contraseña temporalmente?**
   - El sistema soportará contraseña como excepción, pero la cifrará con el mismo estándar AES-256-GCM y marcará el servidor con una advertencia de seguridad recomendando migrar a clave SSH (*Principio III*).
2. **¿Se permite el borrado físico de registros de servidores (`DELETE CASCADE`)?**
   - **No.** Se implementa desincorporación lógica (`lifecycle_state = 'RETIRED'`). Los datos históricos de incidentes y auditoría permanecen vinculados para trazabilidad (*Principio VI y VIII*), pero las credenciales se purgan físicamente.
3. **¿Cómo se previene el flapping de estado si la red oscila?**
   - Un servidor solo pasa a `ONLINE` o `UNREACHABLE` tras 2 comprobaciones consecutivas fallidas o exitosas, clasificándose temporalmente como `DEGRADED` durante la fluctuación.
