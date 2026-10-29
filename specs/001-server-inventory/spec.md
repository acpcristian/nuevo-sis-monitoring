# Feature Specification: Gestión e Inventario de Servidores

**Feature Branch**: `001-server-inventory`  
**Created**: 2026-10-28  
**Status**: Draft  
**Input**: User description: "Gestión e inventario de servidores (Módulo 2.1: registro, ciclo de vida, conectividad y metadatos de servidores Linux/Windows)"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registro y alta de un nuevo servidor (Priority: P1)

Como **SUPERADMIN**, quiero registrar un nuevo servidor en el inventario especificando sus datos de red, sistema operativo, método de conexión seguro y metadatos organizacionales, para que la plataforma comience a supervisar su estado y disponibilidad.

**Why this priority**: Es la funcionalidad fundacional del sistema. Sin la capacidad de dar de alta servidores en el inventario, no es posible recolectar métricas, analizar logs ni gestionar incidentes.

**Independent Test**: Puede probarse de forma aislada dando de alta un servidor con credenciales válidas y comprobando que aparece inmediatamente en el inventario con estado de conectividad comprobado y evento de auditoría emitido.

**Acceptance Scenarios**:

1. **Alta exitosa con clave SSH (Linux)**:
   - **Given** que el SUPERADMIN ha iniciado sesión y accede a la sección de inventario,
   - **When** completa el formulario con nombre ("srv-db-prod-01"), IP/hostname ("192.168.10.15"), sistema operativo ("Linux / Ubuntu 24.04"), método ("SSH por clave"), usuario técnico ("mon-user"), sube la clave privada y asigna entorno ("Producción"),
   - **Then** el sistema valida los parámetros, ejecuta una comprobación no intrusiva de conectividad en modo solo lectura, almacena la referencia cifrada de la credencial sin exponerla, añade el servidor en estado `ONLINE` y registra el alta en la auditoría.

2. **Alta exitosa de servidor Windows**:
   - **Given** que el SUPERADMIN registra un servidor con sistema operativo Windows Server,
   - **When** selecciona el método de conexión seguro aplicable (WinRM HTTPS o Agente local) con credencial técnica de servicio,
   - **Then** el sistema valida la comunicación, confirma el alcance del puerto y registra el equipo con sus etiquetas y grupo asignados.

3. **Rechazo por duplicidad o datos inválidos**:
   - **Given** que ya existe un servidor registrado con la IP "192.168.10.15" en el entorno "Producción",
   - **When** el SUPERADMIN intenta registrar otro servidor con la misma combinación de IP y entorno,
   - **Then** el sistema rechaza la operación, muestra un mensaje descriptivo indicando el conflicto de dirección y no crea registros duplicados.

4. **Tratamiento ante falla de conectividad en el alta**:
   - **Given** que el SUPERADMIN ingresa datos de un servidor cuya IP o puerto no responde por restricciones de firewall,
   - **When** se solicita el registro con prueba de verificación,
   - **Then** el sistema informa que el servidor es inalcanzable (`UNREACHABLE`), permite guardar el servidor en estado `PENDING_CONNECTION` si el operador lo decide, y no reporta falsas mediciones de disponibilidad.

---

### User Story 2 - Consulta, filtrado y visualización detallada del inventario (Priority: P1)

Como **SUPERADMIN** u **OBSERVADOR**, quiero consultar el listado centralizado de servidores con sus estados de salud, métricas resumidas y filtros avanzados, para conocer el estado operativo general de la infraestructura y localizar equipos rápidamente.

**Why this priority**: Proporciona visibilidad operativa diaria para el equipo de guardia y soporte técnico. Debe permitir la inspección sin comprometer la seguridad ni revelar secretos.

**Independent Test**: Puede verificarse navegando al inventario con usuarios de distintos roles (SUPERADMIN y OBSERVADOR), aplicando filtros combinados y comprobando que los datos sensibles están protegidos.

**Acceptance Scenarios**:

1. **Visualización y filtrado multifactorial**:
   - **Given** un inventario con múltiples servidores heterogéneos,
   - **When** un usuario filtra por entorno "Producción", sistema operativo "Linux" y estado "ONLINE",
   - **Then** la interfaz lista únicamente los servidores que coinciden con todos los criterios en menos de 1 segundo, mostrando nombre, IP, SO, entorno, última comprobación y estado visual accesible (icono y texto, no solo color).

2. **Protección de credenciales para rol OBSERVADOR**:
   - **Given** que un usuario con rol OBSERVADOR consulta la ficha detallada de un servidor,
   - **When** examina la sección de conexión y credenciales,
   - **Then** el sistema muestra únicamente información no sensible (tipo de método: "SSH Key", usuario técnico: "mon-user", estado de credencial: "Configurada"), y en ningún caso muestra la clave privada, contraseñas ni permite su descarga.

3. **Inspección de detalles técnicos por SUPERADMIN**:
   - **Given** que un SUPERADMIN visualiza la ficha del servidor,
   - **When** accede a la sección de configuración de conexión,
   - **Then** puede verificar el estado de la conexión, rotar o sobrescribir la credencial existente, pero no se le devuelve la contraseña o clave privada previamente guardada en texto claro.

---

### User Story 3 - Gestión del ciclo de vida y edición de metadatos (Priority: P2)

Como **SUPERADMIN**, quiero editar los metadatos organizacionales de un servidor (etiquetas, responsable, descripción) y cambiar su estado de ciclo de vida (Habilitado, Mantenimiento, Deshabilitado), para reflejar intervenciones programadas y evitar falsas alarmas.

**Why this priority**: Impide la generación de falsos incidentes cuando un servidor entra en ventana de mantenimiento programado o es retirado temporalmente de servicio.

**Independent Test**: Puede probarse cambiando un servidor a estado "Mantenimiento" y verificando que los sondeos de alerta quedan suspendidos para ese equipo y el cambio queda registrado en auditoría.

**Acceptance Scenarios**:

1. **Paso a ventana de mantenimiento**:
   - **Given** un servidor activo en estado `ONLINE`,
   - **When** el SUPERADMIN cambia su estado a `MAINTENANCE` e indica el motivo ("Parcheo de kernel mensual"),
   - **Then** el sistema actualiza el estado visible en el inventario, suspende las notificaciones de caída para este servidor mientras dure el mantenimiento y emite un evento de auditoría con el motivo ingresado.

2. **Deshabilitación temporal**:
   - **Given** un servidor que será apagado de forma planificada,
   - **When** el SUPERADMIN selecciona la acción "Deshabilitar servidor",
   - **Then** el servidor pasa al estado `DISABLED`, cesan los intentos periódicos de conexión y se preserva todo su histórico previo.

3. **Rehabilitación operativa**:
   - **Given** un servidor en estado `MAINTENANCE` o `DISABLED`,
   - **When** el SUPERADMIN selecciona "Habilitar servidor",
   - **Then** el sistema reanuda inmediatamente la comprobación de conectividad, actualiza el estado según la respuesta real del equipo (`ONLINE` o `UNREACHABLE`) y reactiva las políticas de alerta.

4. **Bloqueo de edición para OBSERVADOR**:
   - **Given** un usuario con rol OBSERVADOR,
   - **When** intenta enviar una modificación de metadatos o estado a través de la interfaz o API,
   - **Then** el sistema rechaza la operación con código `403 Forbidden`, no aplica ningún cambio y registra el intento no autorizado en la auditoría.

---

### User Story 4 - Retiro y desincorporación formal del inventario (Priority: P3)

Como **SUPERADMIN**, quiero retirar de forma permanente un servidor dado de baja de la infraestructura física o virtual, para mantener el inventario limpio y asegurar que no queden credenciales residuales activas en el sistema.

**Why this priority**: Cierra el ciclo de vida del servidor, asegurando que los secretos de conexión sean revocados o destruidos en reposo, mientras se conserva la trazabilidad histórica de incidentes y auditorías pasadas.

**Independent Test**: Puede verificarse retirando un servidor con confirmación explícita y comprobando que no vuelve a figurar en sondeos activos, sus credenciales son eliminadas de forma segura y su histórico queda conservado en modo archivado.

**Acceptance Scenarios**:

1. **Retiro exitoso con doble confirmación**:
   - **Given** un servidor que ha sido decomisado en la infraestructura,
   - **When** el SUPERADMIN solicita su desincorporación, escribe el nombre del servidor como confirmación de seguridad y confirma la baja,
   - **Then** el sistema cancela definitivamente todo trabajo de sondeo, elimina de forma irrecuperable los secretos y credenciales de conexión asociados al servidor, marca el servidor en estado `RETIRED` (o archivado histórico según política de retención) y registra la baja en la auditoría con el responsable y fecha.

2. **Preservación del histórico de incidentes pasados**:
   - **Given** un servidor retirado que tuvo incidentes y logs históricos en meses anteriores,
   - **When** un operador consulta reportes de disponibilidad o incidentes históricos de dicho periodo,
   - **Then** los registros e incidentes pasados se mantienen consultables y legibles para fines de auditoría, indicando claramente que el servidor asociado se encuentra actualmente retirado.

---

### Edge Cases

- **Cambio de IP o Hostname**: Cuando un servidor cambia de dirección de red, el SUPERADMIN puede actualizarla; el sistema debe revalidar conectividad de inmediato y no perder el enlace con los logs históricos previamente recolectados.
- **Degradación intermitente de red**: Si un servidor responde a la comprobación básica de puerto pero con pérdida sustancial de paquetes o latencia anormal (> 3000 ms), el estado se clasifica como `DEGRADED`, sin marcarlo falsamente como `ONLINE` impecable ni como `OFFLINE` total.
- **Credencial revocada en el servidor destino**: Si la clave SSH o usuario técnico es modificado o revocado en el servidor remoto, la comprobación pasa a `AUTHENTICATION_FAILED`, alertando al SUPERADMIN sin bloquear el acceso al resto del inventario.
- **Intento de registrar servidor con usuario `root` directo sin justificación**: La interfaz debe advertir que el uso de superusuario directo contraviene el Principio III de la Constitución y exigir el uso de una cuenta técnica con privilegios mínimos, requiriendo justificación explícita si se fuerza una excepción.
- **Servidores sin respuesta de hostname (DNS inalcanzable)**: Si se provee un FQDN que no resuelve, el sistema debe informar el fallo de resolución DNS específico y permitir el uso alternativo de la dirección IP directa.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema **MUST** permitir al SUPERADMIN registrar nuevos servidores en el inventario capturando de forma obligatoria: Nombre identificativo único, Dirección IP o Hostname resoluble, Sistema Operativo base (Linux / Windows Server) y Entorno lógico (Producción, Staging, Desarrollo, etc.).
- **FR-002**: El sistema **MUST** permitir asignar metadatos opcionales pero recomendados: Grupo organizativo, Etiquetas (*tags* clave-valor), Responsable técnico del servidor, Puerto de conexión y Descripción de propósito.
- **FR-003**: El sistema **MUST** soportar métodos de conexión seguros: SSH mediante clave pública/privada (con o sin passphrase) para Linux, y WinRM HTTPS o Agente local para Windows Server.
- **FR-004**: El sistema **MUST NOT** almacenar contraseñas ni claves privadas en texto plano en la base de datos ni exponerlas en respuestas de consulta de la API o vistas de interfaz.
- **FR-005**: Al registrar o editar un servidor, el sistema **MUST** ofrecer una acción de verificación de conectividad inmediata que compruebe la accesibilidad de red y la validez de la credencial en modo de solo lectura.
- **FR-006**: Las operaciones de verificación y sondeo de servidores **MUST NOT** realizar modificaciones en el sistema operativo remoto, ni alterar archivos, ni reiniciar servicios, en estricto cumplimiento del Principio V de la Constitución.
- **FR-007**: El sistema **MUST** calcular y clasificar de forma inequívoca los siguientes estados operativos del servidor:
  - `ONLINE`: Conectividad confirmada y servicios respondiendo dentro de parámetros normales.
  - `DEGRADED`: Conectividad parcial, alta latencia o pérdida de paquetes detectada.
  - `UNREACHABLE`: Servidor inaccesible por red, fallo de enrutamiento o puerto cerrado.
  - `AUTHENTICATION_FAILED`: Puerto accesible pero credencial rechazada por el servidor.
  - `MAINTENANCE`: Servidor temporalmente en ventana de mantenimiento programada (sondeos silenciados).
  - `DISABLED`: Servidor deshabilitado administrativamente (sondeos detenidos).
  - `RETIRED`: Servidor desincorporado permanentemente del inventario activo.
- **FR-008**: La interfaz del inventario **MUST** presentar los estados utilizando texto explicativo e iconografía distintiva, y **MUST NOT** depender exclusivamente del color para indicar la salud del servidor.
- **FR-009**: La lista de inventario **MUST** proporcionar filtrado en tiempo real por: Entorno, Sistema Operativo, Estado de Salud, Grupo, Etiquetas y búsqueda predictiva por Nombre o IP.
- **FR-010**: El sistema **MUST** aplicar control de acceso en backend:
  - Usuarios con rol **SUPERADMIN** pueden: Crear, Editar, Habilitar, Deshabilitar, Retirar y Probar servidores.
  - Usuarios con rol **OBSERVADOR** pueden: Consultar la lista, ver detalles operativos y filtrar servidores; **MUST NOT** ejecutar ninguna acción de mutación.
- **FR-011**: Cualquier petición no autorizada emitida por un usuario con rol OBSERVADOR hacia endpoints de creación, modificación o baja **MUST** ser rechazada con código HTTP `403 Forbidden` y registrada en la auditoría.
- **FR-012**: Toda acción de alta, modificación de datos de conexión, cambio de estado de ciclo de vida y retiro de un servidor **MUST** generar un evento de auditoría append-only que registre: Identificador del usuario, fecha/hora con zona horaria, servidor afectado, tipo de cambio y valores modificados (excluyendo secretos).
- **FR-013**: Al editar un servidor, el sistema **MUST NOT** devolver la clave privada ni la contraseña previamente almacenada; solo permitirá mantener la credencial actual o cargar una nueva credencial de reemplazo.
- **FR-014**: Al desincorporar un servidor (`RETIRED`), el sistema **MUST** solicitar confirmación explícita con el nombre del equipo, purgar las claves privadas y contraseñas asociadas de forma segura y preservar el historial de eventos para auditoría forense.
- **FR-015**: La plataforma **MUST** registrar y mostrar para cada servidor las marcas temporales de: Fecha de creación, Última comprobación de conectividad realizada y Última respuesta exitosa recibida, indicando de forma explícita la zona horaria utilizada.

---

### Key Entities *(include if feature involves data)*

- **Servidor (Managed Server)**:
  - Representa un equipo físico, máquina virtual o instancia supervisada.
  - Atributos clave: Identificador único, nombre del servidor, IP/hostname, sistema operativo base, distribución/versión, entorno, grupo, estado del ciclo de vida (`ACTIVE`, `MAINTENANCE`, `DISABLED`, `RETIRED`), estado de salud actual (`ONLINE`, `DEGRADED`, `UNREACHABLE`, `AUTH_FAILED`), marca de última comprobación y marca de última respuesta exitosa.
- **Referencia de Credencial de Conexión (Server Credential Reference)**:
  - Representa el mecanismo de autenticación técnica hacia el servidor.
  - Atributos clave: Identificador único, tipo de credencial (`SSH_KEY`, `PASSWORD_ENCRYPTED`, `AGENT_TOKEN`), usuario técnico de conexión, referencia al contenedor seguro/KMS del secreto cifrado, fecha de última rotación y huella digital (fingerprint) pública de la clave (nunca el secreto crudo).
- **Registro de Comprobación de Conectividad (Connectivity Check Log)**:
  - Representa una comprobación puntual de disponibilidad de red y protocolo.
  - Atributos clave: Identificador, servidor asociado, marca temporal de sondeo (`event_timestamp`), latencia de respuesta (ms), resultado del sondeo (`SUCCESS`, `TIMEOUT`, `REFUSED`, `AUTH_ERROR`) y mensaje de diagnóstico seguro.
- **Etiqueta / Tag**:
  - Par clave-valor lógico asignado a un servidor para organización y filtrado dinámico (e.g. `cluster: analytics`, `datacenter: us-east`).
- **Evento de Auditoría de Inventario (Inventory Audit Record)**:
  - Registro inmutable de cada acción administrativa sobre el inventario.
  - Atributos clave: Identificador del evento, fecha/hora exacta (`timestamp`), usuario actor, acción (`SERVER_CREATED`, `METADATA_UPDATED`, `STATUS_CHANGED`, `SERVER_RETIRED`), servidor afectado y detalle de campos modificados.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un SUPERADMIN puede completar el alta de un nuevo servidor y obtener la primera verificación de conectividad en menos de 90 segundos.
- **SC-002**: La interfaz del inventario carga y filtra un catálogo de al menos 1,000 servidores en menos de 1 segundo en condiciones normales de red de oficina técnica.
- **SC-003**: El 100% de los intentos de mutación (creación, edición, eliminación o prueba) ejecutados por usuarios con rol OBSERVADOR son rechazados con error de autorización y quedan auditados.
- **SC-004**: En el 100% de las respuestas de API y vistas de usuario, las contraseñas y claves privadas permanecen ocultas (0% de exposición de secretos).
- **SC-005**: El 100% de los cambios de estado del ciclo de vida (alta, mantenimiento, deshabilitación y retiro) quedan registrados en el log inmutable de auditoría con identificación del usuario operador.
- **SC-006**: La interfaz permite diferenciar el estado de salud de cualquier servidor en menos de 3 segundos de inspección visual, sin necesidad de interpretar códigos de color aislados.

---

## Assumptions

- **A-001**: Los servidores que se registren en la plataforma son alcanzables a nivel de red (vía IP directa, subred privada o túnel) desde el componente de recolección de la plataforma.
- **A-002**: Las cuentas de usuario técnicas en los servidores supervisados han sido provisionadas previamente por los administradores de sistemas con permisos restringidos de solo lectura para comandos de inspección.
- **A-003**: El sistema de gestión de usuarios y autenticación de la plataforma provee la identidad del usuario y su rol verificado (**SUPERADMIN** u **OBSERVADOR**) en cada solicitud entrante.
- **A-004**: El idioma oficial de los textos de la interfaz, mensajes de error y etiquetas del inventario es español, con soporte para términos técnicos de industria estándar (SSH, WinRM, Hostname, FQDN, IP, Ping).
- **A-005**: El soporte inicial cubre servidores Linux (distribuciones principales basadas en Debian, RHEL y Alpine) y Windows Server (versiones 2016 en adelante), extensible mediante adaptadores modulares a futuro.

