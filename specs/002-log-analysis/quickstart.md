# Quickstart & Verification Guide: Análisis de Logs y Diagnóstico Estructurado

**Feature**: `002-log-analysis`  
**Date**: 2026-10-29  
**Status**: Ready for QA / Implementation  

Este documento describe cómo inicializar, configurar y verificar de extremo a extremo la funcionalidad de análisis de logs, cubriendo el camino feliz (*happy path*), el camino de degradación (*unhappy path*) y las puertas de seguridad de la Constitución.

---

## 1. Requisitos Previos y Entorno

1. **Variables de Entorno**:
   Asegurar que `.env` contenga las variables del spec 001 más las específicas de logs:
   ```env
   # Clave maestra para cifrado de credenciales (AES-256-GCM - 32 bytes hex)
   ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

   # Conexión a PostgreSQL
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/nuevo_sis_dev

   # Puerto de la aplicación
   PORT=3000
   ```

2. **Migraciones de Base de Datos**:
   Ejecutar las migraciones deterministas para crear las tablas del spec 001
   (servidores, credenciales, auditoría) más las nuevas tablas de logs:
   `log_categories`, `log_events`, `incident_diagnoses`, `data_freshness_states`, `log_alerts`.

3. **Categorías de Log Precargadas**:
   Las 10 categorías prioritarias deben estar cargadas en `log_categories` antes de ingestar eventos.

---

## 2. Pruebas de Verificación Funcional (E2E)

### Flujo 1: Ingesta y Clasificación de Log (SUPERADMIN / Agente)

1. **Acción**:
   Enviar un evento de log de autenticación SSH fallida:
   ```bash
   curl -X POST http://localhost:3000/api/v1/logs \
     -H "Authorization: Bearer <TOKEN_SUPERADMIN>" \
     -H "Content-Type: application/json" \
     -d '{
       "server_id": "uuid-del-servidor",
       "category": "AUTH_ACCESS",
       "event_timestamp": "2026-10-29T10:00:00Z",
       "event_type": "ssh_login_failed",
       "severity": "ERROR",
       "message": "Failed password for invalid user admin from 10.0.0.5 port 2222 ssh2",
       "raw_log": "Oct 29 10:00:01 sshd[1234]: Failed password for invalid user admin from 10.0.0.5 port 2222 ssh2"
     }'
   ```

2. **Verificación Esperada**:
   - Código HTTP: `201 Created`.
   - El evento se clasifica en categoría `AUTH_ACCESS`.
   - `sanitized_message` no contiene direcciones IP sensibles ni credenciales (si las hubiera).
   - `raw_log` se almacena inmutablemente.
   - `is_untrusted` es `true`.

---

### Flujo 2: Consulta y Filtrado de Logs (OBSERVADOR)

1. **Acción**:
   Consultar logs con filtros combinados:
   ```bash
   curl -X GET "http://localhost:3000/api/v1/logs?category=SECURITY_AUDIT&server_id=<UUID>&severity=CRITICAL&from=2026-10-29T00:00:00Z&to=2026-10-29T23:59:59Z" \
     -H "Authorization: Bearer <TOKEN_OBSERVADOR>"
   ```

2. **Verificación Esperada**:
   - Código HTTP: `200 OK`.
   - Solo se devuelven eventos que coinciden con todos los filtros.
   - Los mensajes están sanetizados (sin secretos expuestos).
   - Tiempo de respuesta < 2 segundos sobre repositorio de prueba.

---

### Flujo 3: Sanitización de Datos Sensibles (Principio III)

1. **Acción**:
   Enviar un log que contenga una contraseña embebida:
   ```bash
   curl -X POST http://localhost:3000/api/v1/logs \
     -H "Authorization: Bearer <TOKEN_SUPERADMIN>" \
     -H "Content-Type: application/json" \
     -d '{
       "server_id": "<UUID>",
       "category": "AUTH_ACCESS",
       "event_timestamp": "2026-10-29T10:05:00Z",
       "severity": "ERROR",
       "message": "Login failed for user admin with password=supersecret123",
       "raw_log": "Login failed for user admin with password=supersecret123"
     }'
   ```

2. **Verificación Esperada**:
   - `sanitized_message` contiene `[REDACTED]` en lugar de `supersecret123`.
   - `raw_log` se almacena pero el sistema debe tener mecanismos para no exponerlo en consultas de OBSERVADOR.
   - Ninguna respuesta de API a OBSERVADOR revela el valor original del secreto.

---

### Flujo 4: Generación de Diagnóstico Estructurado (SUPERADMIN)

1. **Acción**:
   Solicitar un diagnóstico para un conjunto de eventos de fallo de base de datos:
   ```bash
   curl -X POST http://localhost:3000/api/v1/diagnoses \
     -H "Authorization: Bearer <TOKEN_SUPERADMIN>" \
     -H "Content-Type: application/json" \
     -d '{
       "event_ids": ["<UUID-evento-1>", "<UUID-evento-2>"],
       "observed_facts": "Servidor srv-db-prod-01 reporta 3 errores de conexión consecutivos en 2 minutos",
       "probable_cause": "Agotamiento de conexiones en el pool de PostgreSQL",
       "confidence_level": "MEDIUM"
     }'
   ```

2. **Verificación Esperada**:
   - Código HTTP: `201 Created`.
   - El diagnóstico incluye todas las secciones: hechos observados, causa probable, evidencias de soporte, diagnósticos alternativos, impacto, pasos de verificación, recomendaciones, nivel de confianza.
   - Las evidencias de soporte citan específicamente los IDs de eventos de log.
   - Evento de auditoría generado con el usuario SUPERADMIN.

---

### Flujo 5: Intento de Mutación No Autorizada por OBSERVADOR (Puerta de Seguridad IV)

1. **Acción**:
   Intentar generar un diagnóstico con rol OBSERVADOR:
   ```bash
   curl -X POST http://localhost:3000/api/v1/diagnoses \
     -H "Authorization: Bearer <TOKEN_OBSERVADOR>" \
     -H "Content-Type: application/json" \
     -d '{
       "event_ids": ["<UUID>"],
       "observed_facts": "Intento no autorizado",
       "probable_cause": "Prueba de seguridad",
       "confidence_level": "LOW"
     }'
   ```

2. **Verificación Esperada**:
   - Código HTTP: `403 Forbidden`.
   - No se crea ningún diagnóstico.
   - Intento no autorizado registrado en auditoría.

---

### Flujo 6: Deduplicación de Alertas (Tormenta de Eventos)

1. **Acción**:
   Enviar 100 eventos de error idénticos en un minuto desde el mismo servidor:
   ```bash
   # (en un bucle o lote) enviar 100 eventos con category=SECURITY_AUDIT, same server, same pattern
   ```

2. **Verificación Esperada**:
   - Se genera una única alerta agrupada con `event_count = 100`.
   - No se generan 100 alertas individuales (reducción ≥ 99% en volumen de alertas).
   - Severidad de la alerta reflecte la gravedad de la tormenta.

---

### Flujo 7: Estado de Frescura de Datos

1. **Acción**:
   Consultar estados de frescura:
   ```bash
   curl -X GET http://localhost:3000/api/v1/freshness \
     -H "Authorization: Bearer <TOKEN_OBSERVADOR>"
   ```

2. **Verificación Esperada**:
   - Servidores con telemetría reciente: `freshness_state = FRESH`.
   - Servidores sin telemetría en ventana configurada: `freshness_state = STALE` o `AGENT_DISCONNECTED`.
   - Ningún servidor muestra `ONLINE` implícito por falta de datos.

---

## 3. Puertas de Seguridad (Constitución)

| Principio | Verificación |
|-----------|-------------|
| **III** Gestión Segura de Credenciales | 0% de secretos en respuestas de API y vistas de interfaz. |
| **IV** Mínimo Privilegio | OBSERVADOR recibe 403 en endpoints de mutación (diagnósticos, alertas). |
| **VI** Evidencia y Trazabilidad | Auditoría append-only para ingestión, diagnósticos y cierres de incidente. |
| **VII** Análisis de Logs Responsable | Diagnósticos distinguen hechos de inferencias; evidencias de soporte verificables. |
| **VIII** Alertas Útiles | Deduplicación de tormentas de eventos; estados de frescura explícitos. |
| **XIII** Privacidad | Enmascaramiento de PII y credenciales antes del almacenamiento. |

---

## 4. Criterios de Éxito Medibles

- **SC-001**: Ingesta y clasificación de ≥ 10,000 eventos de log por hora.
- **SC-002**: Filtrado de logs en < 2 segundos sobre 100,000 registros.
- **SC-003**: 100% de logs con secretos enmascarados (0% exposición).
- **SC-004**: 100% de diagnósticos con evidencias de soporte comprobables.
- **SC-005**: Tormenta de 1,000 eventos idénticos → 1 única alerta agrupada.
- **SC-006**: Cierre de incidente bloqueado sin evidencias de telemetría de recuperación.
