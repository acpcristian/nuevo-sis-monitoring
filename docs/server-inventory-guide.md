# Guía Operativa: Gestión e Inventario de Servidores

Esta guía documenta los procedimientos de administración, operación y solución de problemas para el módulo de inventario de servidores de la plataforma.

---

## 1. Arquitectura de Seguridad y Criptografía

El módulo implementa los principios de la **Constitución v1.0.0**:

- **Cifrado en Reposo (Principio III)**: Las claves privadas SSH y contraseñas de servicio se cifran mediante **AES-256-GCM** a través de `SecretVault`.
  - La clave maestra reside en la variable de entorno `ENCRYPTION_KEY` (32 bytes hex).
  - Cada credencial tiene un vector de inicialización (`iv`) único de 12 bytes y un tag de autenticación (`auth_tag`) de 16 bytes.
  - Las respuestas de la API **nunca devuelven el secreto descifrado**.
- **Control de Acceso Backend (Principio IV)**:
  - `SUPERADMIN`: Control total (alta, edición, sondeo, mantenimiento, retiro).
  - `OBSERVADOR`: Solo lectura. Cualquier llamada de mutación (`POST`, `PATCH`, `DELETE`) es bloqueada con `403 Forbidden` y registrada en auditoría.
- **Sondeo No Intrusivo (Principio V)**:
  - Linux: Handshake SSH y consulta de banner en modo solo lectura con timeout estricto de 5s vía `ssh2`.
  - Windows: Comprobación de apertura de socket TCP / WinRM (puerto 5986/5985) con timeout de 5s.
  - Prohibida la ejecución automática de comandos modificadores o reinicios de servicio.

---

## 2. Procedimientos Operativos

### 2.1. Registro de un Servidor Linux con Clave SSH

1. Provisionar previamente un usuario técnico con permisos mínimos en el servidor remoto (e.g. `mon-user`).
2. Añadir la clave pública al archivo `~mon-user/.ssh/authorized_keys`.
3. En la interfaz web, pulsar **"Registrar Servidor"**.
4. Completar nombre, IP, entorno y subir la clave privada `.pem`.
5. El sistema ejecutará un handshake inmediato y reportará el estado (`ONLINE` o `UNREACHABLE`).

### 2.2. Declaración de Ventana de Mantenimiento

1. Acceder a la ficha del servidor (`/servers/[id]`).
2. Pulsar **"Ciclo de Vida"**.
3. Seleccionar **"Mantenimiento Programado"** e ingresar obligatoriamente el motivo de la intervención.
4. Mientras esté en mantenimiento, los sondeos automáticos de alerta se suspenderán para evitar fatiga de alertas (*Principio VIII*).

### 2.3. Desincorporación y Retiro Seguro

1. Acceder a la ficha del servidor.
2. Pulsar **"Retirar Servidor"**.
3. El sistema solicitará confirmación escribiendo el nombre exacto del equipo.
4. Al confirmar, el servidor pasa a `RETIRED` y **todas las credenciales y claves en reposo son eliminadas físicamente** (*Principio XIII*).
5. El historial de auditoría e incidentes se preserva intacto para cumplimiento forense.

---

## 3. Resolución de Problemas (Troubleshooting)

| Síntoma | Causa Probable | Acción Correctiva |
|---|---|---|
| Estado `UNREACHABLE` inmediato | Regla de firewall bloqueando puerto 22 o 5986 | Verificar grupos de seguridad o iptables en el servidor remoto. |
| Estado `AUTH_FAILED` | Clave privada incorrecta o usuario bloqueado | Comprobar que `authorized_keys` tenga permisos `0600` y el usuario esté activo. |
| Estado `DEGRADED` | Latencia de red > 3000 ms o pérdida de paquetes | Inspeccionar la ruta de enrutamiento o saturación de ancho de banda. |
| Error `403 Forbidden` | Usuario con rol OBSERVADOR intentando editar | Acceder con credenciales del rol SUPERADMIN. |

