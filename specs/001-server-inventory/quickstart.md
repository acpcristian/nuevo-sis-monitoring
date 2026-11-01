# Quickstart & Verification Guide: Gestión e Inventario de Servidores

**Feature**: `001-server-inventory`  
**Date**: 2026-10-28  
**Status**: Ready for QA / Implementation  

Este documento describe cómo inicializar, configurar y verificar de extremo a extremo la funcionalidad de gestión e inventario de servidores, cubriendo el camino feliz (*happy path*), el camino de degradación (*unhappy path*) y las puertas de seguridad de la Constitución.

---

## 1. Requisitos Previos y Entorno

1. **Variables de Entorno**:
   Asegurar que `.env` contenga la clave criptográfica y la conexión a la base de datos:
   ```env
   # Clave maestra para cifrado de credenciales (AES-256-GCM - 32 bytes hex)
   ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

   # Conexión a PostgreSQL
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/nuevo_sis_dev
   ```

2. **Migraciones de Base de Datos**:
   Ejecutar las migraciones deterministas para crear las tablas `servers`, `server_credentials`, `connectivity_checks`, `tags` y `inventory_audit_logs`.

---

## 2. Pruebas de Verificación Funcional (E2E)

### Flujo 1: Alta de Servidor Linux con Clave SSH (Rol SUPERADMIN)

1. **Acción**:
   Iniciar sesión como `SUPERADMIN` y enviar una solicitud de alta:
   ```bash
   curl -X POST http://localhost:3000/api/v1/servers \
     -H "Authorization: Bearer <TOKEN_SUPERADMIN>" \
     -H "Content-Type: application/json" \
     -d '{
       "name": "srv-prod-web-01",
       "ip_address": "192.168.1.100",
       "os_type": "LINUX",
       "os_version": "Debian 12",
       "environment": "PROD",
       "connection_port": 22,
       "technical_owner": "InfraOps Team",
       "credential": {
         "credential_type": "SSH_KEY",
         "username": "mon-user",
         "secret_value": "-----BEGIN OPENSSH PRIVATE KEY-----\n...\n-----END OPENSSH PRIVATE KEY-----"
       },
       "tags": [{"key": "role", "value": "web"}, {"key": "zone", "value": "dmz"}]
     }'
   ```
2. **Verificación Esperada**:
   - Código HTTP de respuesta: `201 Created`.
   - El payload de respuesta contiene `id`, `name`, `status: "PENDING"` o `"ONLINE"`, `has_credential: true`, y `key_fingerprint: "SHA256:..."`.
   - **En ningún campo de la respuesta aparece la clave privada (`secret_value`)**.
   - En la base de datos, `server_credentials.encrypted_payload` contiene el texto cifrado Base64, con `iv` y `auth_tag`.

---

### Flujo 2: Consulta de Inventario con Rol OBSERVADOR (Higiene de Secretos y Filtros)

1. **Acción**:
   Consultar el servidor recién creado utilizando un token con rol `OBSERVADOR`:
   ```bash
   curl -X GET "http://localhost:3000/api/v1/servers?environment=PROD" \
     -H "Authorization: Bearer <TOKEN_OBSERVADOR>"
   ```
2. **Verificación Esperada**:
   - Código HTTP de respuesta: `200 OK`.
   - La lista incluye `srv-prod-web-01` con sus metadatos y estado.
   - La sección de credencial solo muestra:
     ```json
     "credential_summary": {
       "type": "SSH_KEY",
       "username": "mon-user",
       "key_fingerprint": "SHA256:..."
     }
     ```
   - Ningún dato secreto es visible ni descargable.

---

### Flujo 3: Intento de Mutación No Autorizada por OBSERVADOR (Puerta de Seguridad IV)

1. **Acción**:
   Intentar modificar el servidor o cambiar su estado con el rol `OBSERVADOR`:
   ```bash
   curl -X PATCH http://localhost:3000/api/v1/servers/<SERVER_ID>/lifecycle \
     -H "Authorization: Bearer <TOKEN_OBSERVADOR>" \
     -H "Content-Type: application/json" \
     -d '{"new_state": "MAINTENANCE", "reason": "Intento no autorizado"}'
   ```
2. **Verificación Esperada**:
   - Código HTTP de respuesta: `403 Forbidden`.
   - Mensaje de error claro indicando que el rol OBSERVADOR no tiene privilegios de mutación.
   - En la tabla `inventory_audit_logs` queda asentado un intento de acceso no autorizado con la IP y el usuario.

---

### Flujo 4: Camino Infeliz - Falla de Conectividad y Timeout de Red

1. **Acción**:
   Ejecutar prueba de conectividad contra una IP inalcanzable (`192.0.2.1` / red de prueba sin enrutamiento):
   ```bash
   curl -X POST http://localhost:3000/api/v1/servers/<SERVER_ID>/test-connection \
     -H "Authorization: Bearer <TOKEN_SUPERADMIN>"
   ```
2. **Verificación Esperada**:
   - La llamada responde en un máximo de 5 segundos (timeout controlado).
   - Código de estado devuelto en el resultado: `status: "TIMEOUT"`.
   - El estado de salud del servidor transiciona a `UNREACHABLE` (o `DEGRADED` si es el primer fallo).
   - **No se muestran mediciones de disponibilidad falsas como si el servidor estuviera sano**.

---

### Flujo 5: Ciclo de Vida - Mantenimiento y Retiro Permanente

1. **Paso a Mantenimiento**:
   - El SUPERADMIN envía `PATCH /lifecycle` con `new_state: "MAINTENANCE"`.
   - El servidor cambia a `MAINTENANCE`. Las comprobaciones automáticas se suspenden y las alertas quedan silenciadas.
2. **Retiro y Desincorporación**:
   - El SUPERADMIN envía `DELETE /servers/<ID>` confirmando el nombre exacto `"srv-prod-web-01"`.
   - Respuesta: `200 OK`.
   - El servidor pasa a `RETIRED`.
   - En base de datos, el registro en `server_credentials` es eliminado físicamente (`PURGED`).
   - El historial en `inventory_audit_logs` y `connectivity_checks` se conserva para auditoría forense.

