<!--
SYNC IMPACT REPORT
==================
Reemplazo de la plantilla starter genérica por la Constitución oficial del proyecto.

Versión anterior: 1.1.0 (plantilla starter genérica)
Versión nueva:    1.0.0 (Constitución oficial inicial del proyecto)

Principios anteriores eliminados (plantilla starter):
  - I.    Seguridad de Datos Primero (genérico)
  - II.   Soberanía / Self-Hosted (genérico)
  - III.  Multi-Tenancy Real (genérico)
  - IV.   Idempotencia en Integraciones Externas (genérico)
  - V.    Calidad Verificable Antes de "Hecho" (genérico)
  - VI.   Specs Antes de Código (genérico)
  - VII.  Trazabilidad de Decisiones (genérico)
  - VIII. Foco Vertical [DEFINE-TU-NICHO] (placeholder)
  - IX.   Verificación de Comportamiento en Vivo (genérico)

Principios aprobados (15 principios no negociables de infraestructura y observabilidad):
  - I.    SDD y Especificaciones como Fuente de Verdad
  - II.   Seguridad desde el Diseño (Security by Design)
  - III.  Gestión Segura de Credenciales y Secretos
  - IV.   Mínimo Privilegio y Separación de Funciones
  - V.    Seguridad Operativa de los Servidores Supervisados
  - VI.   Evidencia, Integridad y Trazabilidad
  - VII.  Análisis de Logs Responsable y Verificable
  - VIII. Alertas Útiles y Gestión del Ciclo de Incidente
  - IX.   Calidad del Software y Pruebas Obligatorias
  - X.    Arquitectura Modular y Evolutiva
  - XI.   Disponibilidad, Recuperación y Resiliencia
  - XII.  Experiencia de Usuario y Accesibilidad Operativa
  - XIII. Privacidad, Retención y Exposición Mínima de Datos
  - XIV.  Documentación y Operación Reproducible
  - XV.   Dependencias y Licencias

Secciones añadidas:
  - Identidad, Contexto de Negocio y Misión Crítica
  - Restricciones de Plataforma y Seguridad de Infraestructura
  - Flujo de Desarrollo SDD y Puertas de Calidad (Constitution Check y DoD Reforzada)
  - Criterios Obligatorios de Aprobación
  - Gobierno del Desarrollo (8 reglas normativas)

Estado de sincronización de plantillas dependientes:
  - .specify/templates/constitution-template.md: ✅ Compatible (plantilla abstracta preservada)
  - .specify/templates/plan-template.md: ✅ Compatible (Constitution Check alineado)
  - .specify/templates/spec-template.md: ✅ Compatible (criterios y escenarios alineados)
  - .specify/templates/tasks-template.md: ✅ Compatible (orden de dependencias y pruebas alineadas)
  - .specify/templates/checklist-template.md: ✅ Compatible (categorías dinámicas)

Elementos diferidos / Decisiones pendientes de confirmación:
  - TODO(RATIFICATION_DATE): Pendiente de ratificación formal por el responsable de infraestructura.
  - Selección de stack técnico (lenguaje backend, framework UI, base de datos de series temporales/logs, broker de mensajería): se resolverá en la fase speckit.plan mediante ADRs.
  - Proveedores externos de mensajería (SMS/WhatsApp): alcance y activación sujetos a aprobación de especificación dedicada.
-->

# Constitución del Proyecto: Plataforma Empresarial de Monitoreo, Análisis de Logs y Gestión de Incidentes

Esta Constitución constituye la norma suprema y la fuente de verdad arquitectónica, funcional y operativa para el diseño, especificación, desarrollo, aseguramiento de calidad, seguridad y despliegue de la **Plataforma Empresarial de Monitoreo, Análisis de Logs y Gestión de Incidentes**.

Toda especificación funcional, plan técnico, tarea de desarrollo, revisión de código, decisión de infraestructura y criterio de prueba **MUST** subordinarse a los principios y mandatos de este documento. En caso de discrepancia o conflicto entre cualquier especificación, propuesta técnica o implementación y esta Constitución, prevalecerá siempre esta Constitución.

---

## 1. Identidad, Contexto y Propósito

La plataforma tiene como finalidad proporcionar una solución web centralizada y de grado empresarial para:
- Supervisar de manera proactiva la salud, métricas y disponibilidad de múltiples servidores heterogéneos (Linux y Windows Server, extensible a otras plataformas).
- Detectar oportunamente degradaciones de servicio, pérdida de conectividad y anomalías operativas.
- Recopilar, clasificar, estructurar e interpretar registros (logs) procedentes de múltiples subsistemas de sistema operativo, red, aplicaciones y seguridad.
- Ofrecer diagnósticos asistidos vinculados a evidencias empíricas verificables, diferenciando hechos de conjeturas o hipótesis.
- Gestionar el ciclo de vida completo de las incidencias operativas y despachar alertas accionables, minimizando la fatiga de alertas.
- Garantizar la estricta segregación de permisos entre roles administrativos y de consulta, protegiendo las credenciales y la confidencialidad de la infraestructura monitoreada.

---

## 2. Core Principles (Principios No Negociables)

### I. SDD y Especificaciones como Fuente de Verdad

1. Toda funcionalidad, modificación de comportamiento observable o cambio en la arquitectura de datos **MUST** estar respaldada por una especificación formal aprobada (`spec.md`) antes de iniciar cualquier desarrollo de código o diseño técnico detallado.
2. La trazabilidad entre artefactos **MUST** ser continua y bidireccional: cada necesidad de negocio o técnica se justifica en una especificación, se descompone en un plan técnico (`plan.md`), se estructura en tareas ordenadas por dependencia (`tasks.md`), se materializa en código y se convalida mediante pruebas automatizadas.
3. Los agentes de desarrollo (humanos o automatizados) **MUST NOT** inventar requisitos funcionales, ampliar el alcance unilateralmente ni sustituir directrices documentadas por preferencias personales o supuestos no validados.
4. Cualquier ambigüedad que impacte la seguridad, el modelo de permisos, la integridad de los datos o el comportamiento operativo del sistema **MUST** resolverse y documentarse formalmente antes de considerar aprobada la especificación.
5. Todo cambio de alcance sobrevenido durante el desarrollo **MUST** quedar registrado como enmienda formal en la especificación y someterse a revisión antes de su implementación.

> **Rationale**: El desarrollo guiado por especificaciones (SDD) elimina la ambigüedad, previene el desperdicio de esfuerzo en retrabajo y garantiza que las decisiones críticas de ingeniería estén documentadas y consensuadas antes de ejecutarse.

---

### II. Seguridad desde el Diseño (Security by Design)

1. La seguridad **MUST** ser un componente intrínseco de cada decisión arquitectónica, diseño de modelo y línea de código, y **MUST NOT** considerarse como una verificación cosmética o fase accesoria posterior al desarrollo.
2. Toda entrada de datos recibida por la plataforma —ya proceda de la interfaz de usuario, endpoints de la API, servidores supervisados, agentes de recolección o proveedores externos de mensajería— **MUST** validarse rigurosamente en el servidor backend contra esquemas estrictos de tipo, longitud, rango y formato antes de su procesamiento o persistencia.
3. El sistema **MUST** implementar controles arquitectónicos para mitigar amenazas comunes y avanzadas, incluyendo: autenticación débil, escalamiento de privilegios vertical y horizontal, inyecciones (SQL, comandos de sistema operativo, plantillas, LDAP), manipulación de referencias a objetos (IDOR/BOLA), exposición indebida de metadatos internos y abuso de llamadas remotas.
4. Todas las sesiones interactivas, canales de transporte de APIs y comunicaciones con servidores monitoreados **MUST** utilizar protocolos criptográficamente seguros con cifrado obligatorio en tránsito (TLS 1.2 o superior, SSHv2 con algoritmos robustos).
5. El sistema **MUST NOT** habilitar accesos anónimos a información sensible, ni desplegar credenciales predeterminadas o configuraciones permisivas por defecto.

> **Rationale**: Una plataforma centralizada de monitoreo reúne telemetría y llaves de acceso a toda la infraestructura corporativa; su vulneración representaría un fallo sistémico de seguridad para la organización.

---

### III. Gestión Segura de Credenciales y Secretos

1. Las contraseñas maestras (root/Administrator), claves privadas SSH, credenciales WinRM, tokens de API, contraseñas de bases de datos y secretos de integración **MUST** clasificarse y tratarse como información de máxima sensibilidad confidencial.
2. El sistema **MUST NOT**:
   - Almacenar contraseñas de servidores o servicios en texto plano en ninguna base de datos, caché, archivo temporal o memoria no protegida.
   - Incluir secretos, tokens o credenciales reales en el código fuente, repositorios Git, plantillas de configuración o archivos de ejemplo versionados.
   - Exponer credenciales en la interfaz de usuario, respuestas de API, trazas de depuración, logs del sistema o informes exportables.
   - Reutilizar credenciales administrativas entre diferentes servidores o entornos de ejecución sin aislamiento documentado.
   - Devolver contraseñas o claves privadas ya almacenadas al consultar o editar los datos de un servidor en la API o interfaz; las operaciones de actualización solo **MAY** permitir sobrescribir o renovar el secreto sin revelar el valor previo.
3. Las conexiones remotas hacia servidores Linux **MUST** priorizar el uso de autenticación SSH basada en pares de claves asimétricas y cuentas de usuario técnicas con permisos mínimos requeridos.
4. La autenticación de servidores mediante contraseña solo **MAY** admitirse como método excepcional bajo justificación explícita; en tal caso, las contraseñas **MUST** persistirse cifradas en reposo utilizando esquemas criptográficos robustos de grado empresarial (e.g. cifrado de sobre / envelope encryption o integración con gestores de secretos dedicados, con claves maestras externas a la base de datos), acompañadas de rotación obligatoria y auditoría de acceso.
5. El acceso interactivo o directo como superusuario `root` o `Administrator` **MUST NOT** ser el método de conexión predeterminado; cualquier excepción requerida para inspecciones de bajo nivel **MUST** estar documentada, aislada y sujeta a autorización.
6. Las claves privadas, tokens y contraseñas de conexión a servidores **MUST NOT** ser accesibles, consultables ni descargables por usuarios con rol OBSERVADOR bajo ninguna circunstancia.

> **Rationale**: El almacenamiento o exposición insegura de credenciales administrativas en el sistema de monitoreo anula los perímetros de seguridad individuales de cada servidor administrado.

---

### IV. Mínimo Privilegio y Separación de Funciones

1. Cada usuario humano, proceso del sistema, servicio en segundo plano, agente de telemetría e integración de terceros **MUST** recibir y ejecutar únicamente el conjunto mínimo indispensable de privilegios para cumplir su función operativa.
2. El servidor backend **MUST** aplicar validaciones de autorización obligatorias sobre cada operación protegida y sobre cada recurso individual consultado, creado, actualizado o eliminado, con independencia de los controles presentes en el frontend.
3. Las restricciones de autorización **MUST** prevalecer de manera inviolable ante cualquier intento de navegación manual a URLs, manipulación de peticiones HTTP, inyección de parámetros o consumo de APIs fuera del cliente web.
4. La plataforma **MUST** garantizar la estricta separación de los dos roles fundamentales de su alcance:
   - **SUPERADMIN**: Autorizado para gestionar el inventario de servidores, usuarios, permisos, integraciones, parámetros globales y auditorías.
   - **OBSERVADOR**: Autorizado exclusivamente para consultar servidores asignados, servicios, métricas, logs, informes e incidencias en modo solo lectura; **MUST NOT** crear, modificar ni eliminar entidades de configuración, usuarios o servidores, ni ejecutar comandos remotos.
5. El sistema **MUST** incorporar salvaguardas que impidan que una acción administrativa (eliminación, suspensión o degradación de rol) deje la plataforma sin al menos un usuario SUPERADMIN activo y funcional.
6. Todos los contratos y barreras de autorización **MUST** verificarse exhaustivamente mediante pruebas automatizadas de seguridad tanto positivas como negativas.

> **Rationale**: La separación estricta de funciones impide la manipulación no autorizada del inventario y garantiza que los operadores con fines de inspección no alteren la configuración crítica.

---

### V. Seguridad Operativa de los Servidores Supervisados

1. Las operaciones de monitoreo, recolección de métricas e inspección de servicios sobre los servidores remotos **MUST** ser estrictamente de solo lectura por defecto.
2. La recolección periódica de telemetría, consultas de procesos y transferencia de registros **MUST** diseñarse para minimizar el impacto en los sistemas supervisados, garantizando un consumo acotado y predecible de CPU, memoria, I/O de disco y ancho de banda.
3. La plataforma **MUST NOT** ejecutar de forma autónoma o desatendida comandos de modificación en los servidores supervisados, tales como reiniciar servicios, alterar configuraciones, instalar paquetes, manipular reglas de cortafuegos o eliminar archivos basándose únicamente en la detección de fallos por parte de analizadores de logs o motores de reglas.
4. Cualquier capacidad de remediación remota o acción operativa que se autorice en el futuro **MUST** contar con una especificación aprobada, requerir autorización explícita de un SUPERADMIN, incorporar confirmación humana en la interfaz (human-in-the-loop), respetar límites de tasa de ejecución y registrar una auditoría exhaustiva de la acción y su resultado.
5. La plataforma **MUST** mantener una rigurosa separación conceptual y de interfaz entre la fase de diagnóstico (observación y análisis) y la fase de remediación (intervención correctiva).

> **Rationale**: Un sistema de monitoreo que modifique autónomamente la infraestructura ante falsos positivos o condiciones imprevistas puede desencadenar incidentes en cascada y denegaciones de servicio no controladas.

---

### VI. Evidencia, Integridad y Trazabilidad

1. Toda alerta, anomalía reportada, diagnóstico técnico o resumen ejecutivo **MUST** vincularse de forma verificable con los datos crudos, métricas o registros de log que justifican su emisión.
2. Todo registro y evento ingerido por la plataforma **MUST** contener metadatos normalizados: identificador único de origen, servidor afectado, marcas de tiempo normalizadas, tipo de evento y severidad estandarizada.
3. El sistema **MUST** capturar, diferenciar y conservar con claridad tres marcas temporales para cada evento de telemetría:
   - `event_timestamp`: Momento exacto de generación del evento en el servidor de origen.
   - `ingestion_timestamp`: Momento de recepción del evento en la plataforma de monitoreo.
   - `processed_timestamp`: Momento de procesamiento, normalización o evaluación por el analizador.
4. Los registros de logs originales (**raw logs**) **MUST** preservarse inmutables y almacenarse desacoplados de sus representaciones analizadas, enriquecimientos o interpretaciones posteriores.
5. Las operaciones administrativas sobre usuarios, roles, permisos, configuración de servidores, integraciones y umbrales de alerta **MUST** generar un registro de auditoría append-only protegido contra modificaciones o eliminaciones.
6. Los registros de auditoría **MUST NOT** almacenar contraseñas, secretos, tokens ni claves criptográficas privadas bajo ningún concepto.

> **Rationale**: La trazabilidad forense inmutable es indispensable para auditar incidentes de seguridad, depurar errores operativos complejos y justificar decisiones ante revisiones de cumplimiento.

---

### VII. Análisis de Logs Responsable y Verificable

1. La clasificación de registros **MUST** sustentarse en esquemas estructurados, taxonomías documentadas y criterios de severidad consistentes a lo largo de las diez categorías prioritarias del sistema:
   - Sistema operativo y kernel.
   - Autenticación, sesiones y accesos.
   - SSH y conectividad de red.
   - Servicios del sistema y procesos.
   - Aplicaciones y servidores web.
   - Motores de bases de datos.
   - Almacenamiento, sistemas de archivos y hardware.
   - Copias de seguridad y tareas programadas.
   - Seguridad, auditoría y eventos potencialmente sospechosos.
   - Errores de agentes, conectividad y canal de telemetría.
2. Las explicaciones técnicas automatizadas **MUST** distinguir rigurosamente los hechos constatables (extraídos directamente de los logs) de las inferencias o hipótesis de diagnóstico.
3. Cuando se utilicen componentes de Inteligencia Artificial o modelos de lenguaje para asistir en el análisis, las explicaciones generadas **MUST** estar contextualizadas, fundamentadas en fragmentos reales de log y citar las evidencias utilizadas.
4. Todo diagnóstico generado **MUST** articularse obligatoriamente según la siguiente estructura mínima:
   - **Hechos observados**: Eventos, códigos de error y cambios de estado comprobados empíricamente.
   - **Causa probable**: Hipótesis técnica fundamentada sobre el origen de la falla.
   - **Evidencias de soporte**: Referencias específicas a líneas de log, marcas temporales o métricas correlacionadas.
   - **Diagnósticos alternativos**: Otras causas potenciales que expliquen los síntomas.
   - **Impacto potencial**: Consecuencias operativas sobre servicios, datos o rendimiento.
   - **Pasos de verificación**: Acciones recomendadas de comprobación para el operador técnico.
   - **Recomendaciones de solución**: Pautas de resolución sugeridas para su ejecución manual supervisada.
   - **Nivel de confianza y limitaciones**: Grado de certeza del análisis y mención de información faltante.
5. El sistema **MUST NOT** declarar resuelto un incidente o problema técnico sin constatar señales verificables de telemetría que acrediten la normalización del servicio.
6. Los modelos de Inteligencia Artificial **MUST NOT** contar con privilegios para ejecutar comandos remotos en los servidores supervisados ni tener acceso directo a credenciales o secretos almacenados.
7. Los contenidos textuales procedentes de logs y respuestas de servidores **MUST** considerarse **DATOS NO CONFIABLES** (untrusted data); el sistema **MUST** sanearlos adecuadamente para neutralizar riesgos de inyección de comandos, inyección de código (XSS) y manipulación contextual de modelos (prompt injection).

> **Rationale**: Las interpretaciones técnicas engañosas o las alucinaciones de modelos de IA en plataformas de infraestructura pueden inducir a errores graves de diagnóstico y aumentar el tiempo de resolución.

---

### VIII. Alertas Útiles y Gestión del Ciclo de Incidente

1. Las alertas emitidas por la plataforma **MUST** ser accionables, claras y priorizadas según una matriz objetiva de impacto y severidad.
2. El motor de alertas **MUST** integrar mecanismos obligatorios de deduplicación, control de frecuencia (anti-flood / flapping mitigation) y correlación de eventos concurrentes para evitar la saturación y fatiga del operador técnico.
3. Los despachos de notificación a través de canales externos (correo electrónico y proveedores de mensajería configurables) **MUST** incorporar políticas de reintento controlado con retroceso exponencial, registro del estado de entrega y supervisión de la disponibilidad de cada canal.
4. La normalización o recuperación de un servidor o servicio **MUST NOT** eliminar ni purgar el historial del incidente asociado; el evento de recuperación **MUST** quedar vinculado a la incidencia para su análisis posterior y evaluación de disponibilidad.
5. La plataforma **MUST** distinguir inequívocamente entre una falla intrínseca del servidor/servicio supervisado y una interrupción del mecanismo de recolección de telemetría, y **MUST NOT** presentar la ausencia de datos como si fuera una medición de salud satisfactoria. Se diferenciarán explícitamente los estados: `ONLINE`, `DEGRADED`, `SERVICE_DOWN`, `UNREACHABLE`, `AGENT_DISCONNECTED` y `STALE_DATA`.

> **Rationale**: La fatiga de alertas genera desensibilización en los equipos de guardia, mientras que ocultar la pérdida de comunicación bajo falsos positivos de salud genera una falsa sensación de seguridad.

---

### IX. Calidad del Software y Pruebas Obligatorias

1. Toda funcionalidad definida en una especificación **MUST** contar con criterios de aceptación explícitos, objetivos y verificables mediante escenarios estructurados (Given/When/Then).
2. El código de la aplicación **MUST** estar respaldado por un conjunto integral de pruebas automatizadas en proporción al riesgo de cada componente: pruebas unitarias de lógica de negocio, pruebas de integración de base de datos y APIs, pruebas de seguridad de autorización positiva/negativa, y pruebas de extremo a extremo (E2E) para flujos críticos de usuario.
3. Las migraciones de base de datos **MUST** ser deterministas, reproducibles e idempotentes, y **MUST** contar con procedimientos documentados de reversión o mitigación ante fallos.
4. La batería de pruebas automatizadas **MUST** incluir de manera obligatoria la validación de los siguientes escenarios de falla crítica:
   - Intentos de acceso y manipulación de datos con permisos insuficientes o tokens revocados.
   - Pérdida súbita, latencia excesiva o intermitencia en la conectividad hacia los servidores supervisados.
   - Expiración de credenciales, claves SSH o certificados durante la operación continua.
   - Errores de análisis, logs con formatos inesperados o corrupción del canal de ingestión.
   - Deduplicación y agregación correcta de alertas ante tormentas simultáneas de eventos.
   - Transición de estados y despacho de notificaciones ante la recuperación de servicios caídos.
5. Ninguna funcionalidad crítica **MUST** declararse como "Hecha" (Done) sin contar con la totalidad de sus pruebas automatizadas en estado verde y la documentación explícita de sus riesgos residuales.
6. Las pruebas automatizadas **MUST NOT** ejecutarse contra servidores o bases de datos de producción si conllevan riesgo de alteración de estado, degradación de servicio o destrucción de datos reales.

> **Rationale**: La fiabilidad y resiliencia de una herramienta de monitoreo debe superar la de los sistemas que supervisa; una falla interna en el monitor ciega al equipo ante incidentes graves.

---

### X. Arquitectura Modular y Evolutiva

1. La plataforma **MUST** estructurarse siguiendo una separación nítida de responsabilidades en capas desacopladas: Presentación (UI), Lógica de Dominio y Negocio, Control de Acceso y Autorización, Persistencia y Almacenamiento, Recolección de Telemetría e Ingestión, Motor de Análisis de Logs y Notificaciones.
2. Las integraciones con servicios externos (proveedores de mensajería, correo, agentes de recolección o herramientas de infraestructura) **MUST** aislarse tras interfaces bien definidas (puertos y adaptadores), evitando el acoplamiento directo del núcleo de la aplicación.
3. El diseño del sistema **MUST** evaluar y priorizar la integración de estándares y herramientas consolidadas de la industria antes de emprender el desarrollo a medida de componentes complejos de recolección o transporte.
4. Las decisiones arquitectónicas de impacto (selección de bases de datos, patrones de persistencia para telemetría, gestión de colas y mensajería) **MUST** documentarse mediante Registros de Decisiones de Arquitectura (ADR).
5. La elección concreta de lenguajes, frameworks, bases de datos y motores de colas **MUST** evaluarse y formalizarse durante la fase de planificación técnica (`speckit.plan`), sin considerarse prescrita dogmáticamente por esta Constitución.

> **Rationale**: La modularidad permite sustituir tecnologías obsoletas, escalar componentes independientes y evolucionar la plataforma sin comprometer el núcleo de negocio.

---

### XI. Disponibilidad, Recuperación y Resiliencia

1. Las comunicaciones remotas, las conexiones a bases de datos y las operaciones en segundo plano **MUST** protegerse mediante límites estrictos de tiempo de espera (timeouts), mecanismos de reintento controlado con retroceso y patrones de tolerancia a fallos (e.g. circuit breakers).
2. El sistema **MUST** discriminar y presentar de forma transparente la frescura de la información: datos en tiempo real (frescos y válidos), datos históricos consolidados y datos desactualizados (`stale data`) por interrupción de telemetría.
3. Se **MUST** diseñar y documentar políticas de respaldo (backup) periódico y procedimientos de restauración probados para el inventario de servidores, secretos cifrados, registros de auditoría, incidentes y parámetros globales de configuración.
4. Las metas de disponibilidad de la plataforma (SLO/SLA), las ventanas de retención de telemetría y los objetivos de tiempo y punto de recuperación (RTO/RPO) **MUST** definirse formalmente en las especificaciones del producto con base en los requerimientos del negocio, y **MUST NOT** fijarse mediante valores asumidos o arbitrarios.
5. Los agentes de desarrollo **MUST NOT** prometer ni asumir garantías de alta disponibilidad o rendimiento sin un respaldo experimental validado bajo cargas de prueba.

> **Rationale**: Durante caídas de red o fallos mayores en centros de datos, la plataforma de monitoreo debe permanecer operativa y proporcionar información confiable a los operadores.

---

### XII. Experiencia de Usuario y Accesibilidad Operativa

1. La interfaz de usuario **MUST** estar optimizada para el flujo de trabajo de investigación técnica, priorizando la densidad de información relevante, la legibilidad, la claridad y la reducción del estrés operativo durante incidentes críticos.
2. Los estados de criticidad, salud y severidad **MUST** comunicarse mediante múltiples canales perceptivos (iconos inequívocos, texto explícito, contrastes y jerarquía visual) y **MUST NOT** depender exclusivamente del código de color para su interpretación.
3. La interfaz **MUST** permitir al operador identificar y navegar hacia el servidor afectado, la gravedad del problema, la línea temporal de los eventos y las evidencias asociadas en un máximo de tres interacciones lógicas.
4. Las vistas de incidentes, logs y servidores **MUST** proporcionar capacidades robustas de filtrado multifactorial, búsqueda textual, ordenamiento cronológico y navegación fluida entre eventos correlacionados.
5. El idioma principal obligatorio de la interfaz web, los estados y las explicaciones diagnósticas **MUST** ser español.
6. Todas las marcas temporales presentadas en pantalla o incluidas en informes **MUST** formularse de manera consistente, indicando de forma visible e inequívoca la zona horaria de referencia (e.g. hora local del operador y/o UTC).
7. La aplicación **MUST** gestionar adecuadamente los estados vacíos (empty states), tiempos de carga asíncronos y situaciones de degradación o desconexión, proporcionando mensajes explicativos comprensibles y accionables.

> **Rationale**: En situaciones de crisis de infraestructura, la claridad y ergonomía de la herramienta impactan directamente en el Tiempo Medio de Reparación (MTTR) y evitan decisiones erróneas por fatiga del operador.

---

### XIII. Privacidad, Retención y Exposición Mínima de Datos

1. La recopilación de telemetría y registros de log **MUST** ceñirse estrictamente a los datos requeridos para los fines autorizados de supervisión técnica, diagnóstico y seguridad operativa.
2. La canalización de ingestión de logs **MUST** incorporar reglas automatizadas de sanitización y enmascaramiento (redaction/masking) para evitar que contraseñas, tokens de sesión, credenciales incrustadas, información de identificación personal (PII) o secretos operativos queden indexados en texto claro.
3. La plataforma **MUST** implementar políticas formales de ciclo de vida de los datos, contemplando ventanas de retención configurables, compactación de series históricas y eliminación segura o archivado de telemetría caduca.
4. Las operaciones de exportación masiva, consulta profunda de logs y purga de registros **MUST** estar restringidas exclusivamente al rol SUPERADMIN y dejar constancia en la auditoría del sistema.
5. La centralización de registros **MUST NOT** transformarse en un mecanismo inadvertido de fuga de datos ni en un punto de acceso indiscriminado a contenidos sensibles de los servidores supervisados.

> **Rationale**: Los repositorios consolidados de logs representan volúmenes masivos de datos sensibles; sin políticas de enmascaramiento y depuración, constituyen una grave vulnerabilidad de privacidad y cumplimiento normativo.

---

### XIV. Documentación y Operación Reproducible

1. Las decisiones arquitectónicas, especificaciones y procedimientos operativos **MUST** documentarse con suficiente rigor para que cualquier ingeniero de infraestructura o DevOps competente pueda instalar, configurar, auditar y operar la plataforma sin requerir asistencia del desarrollador original.
2. La documentación técnica **MUST** cubrir de manera obligatoria: instalación desde cero, configuración de entornos, aprovisionamiento de certificados y secretos, procedimientos de respaldo y restauración, guías de resolución de problemas internos (runbooks) y protocolos de recuperación ante desastres.
3. La configuración operativa **MUST** regirse por los principios de la metodología 12-Factor App, separando de forma estricta el código base respecto de las variables y credenciales específicas de cada entorno (desarrollo, staging, producción).
4. El aprovisionamiento y despliegue de la solución **MUST** ser reproducible mediante automatización (e.g. contenedores o scripts de infraestructura como código) y **MUST NOT** depender de modificaciones manuales efímeras o pasos no registrados.
5. Todo procedimiento de actualización de versión, migración de esquema de base de datos o reversión (rollback) **MUST** validarse satisfactoriamente en entornos equivalentes antes de autorizar su ejecución en producción.

> **Rationale**: La reproducibilidad operativa elimina la fragilidad del conocimiento tácito ("solo funciona en mi entorno") y asegura la sostenibilidad y continuidad operativa a largo plazo.

---

### XV. Dependencias y Licencias

1. La selección de librerías, dependencias de software, módulos de terceros y servicios auxiliares **MUST** evaluarse formalmente según criterios de reputación de seguridad, mantenimiento activo, compatibilidad de licencias con el ámbito corporativo y ausencia de exfiltración de telemetría hacia servicios no controlados.
2. El proyecto **MUST NOT** incorporar dependencias abandonadas, librerías con modelos de licencia restrictivos o incompatibles, dependencias innecesarias que incrementen la superficie de ataque, ni componentes que remitan datos a servidores externos sin consentimiento documentado.
3. El ciclo de desarrollo **MUST** incorporar análisis continuo de vulnerabilidades conocidas (CVEs) en las dependencias; cualquier vulnerabilidad crítica o de alto impacto detectada **MUST** evaluarse y mitigarse de manera prioritaria mediante actualización o medidas compensatorias documentadas.

> **Rationale**: Las dependencias no auditadas constituyen uno de los vectores principales de compromiso de la cadena de suministro de software y pueden introducir riesgos legales graves.

---

## 3. Restricciones de Plataforma y Seguridad de Infraestructura

Derivadas de los Principios II, III, IV y V, las siguientes restricciones normativas aplican de forma inmediata y verificable:

1. **Gestión de Secretos en Reposo**: Todos los secretos de conexión (claves privadas SSH, tokens de API, contraseñas de servicio) **MUST** residir cifrados en reposo utilizando claves maestras gestionadas externamente al código fuente y al repositorio Git.
2. **Inmutabilidad de Logs**: Los registros originales de log (**raw logs**) **MUST** ser de solo lectura y append-only en la persistencia; ninguna rutina de enriquecimiento, normalización o inferencia **MUST** modificar el contenido textual original del log recibido.
3. **Monitoreo No Intrusivo**: La recolección de métricas sobre servidores supervisados **MUST NOT** instalar software intrusivo no autorizado ni modificar archivos de configuración del sistema operativo destino sin autorización expresa.
4. **Validación Backend de Roles**: El backend **MUST** evaluar los privilegios del rol en cada solicitud; cualquier intento de un usuario con rol OBSERVADOR de invocar un endpoint de mutación (POST, PUT, PATCH, DELETE) sobre servidores, usuarios o configuraciones **MUST** responder con rechazo `403 Forbidden` y generar un evento de auditoría.
5. **Aislamiento de Integraciones Externas**: Los conectores con proveedores de mensajería (correo, WhatsApp, SMS) **MUST** desacoplarse mediante colas asíncronas para que una indisponibilidad del proveedor externo no bloquee el flujo de monitoreo e ingestión.

---

## 4. Flujo de Desarrollo SDD y Puertas de Calidad

El ciclo de vida del proyecto se rige estrictamente por la disciplina de Spec-Driven Development (SDD), organizada en las siguientes fases y controles:

```
[ spec.md ] ──► [ Constitution Check ] ──► [ plan.md ] ──► [ tasks.md ] ──► [ implement ] ──► [ DoD Reforzada ]
```

1. **Secuencia Obligatoria**: `specify` (`spec.md`) → `plan` (`plan.md`) → `tasks` (`tasks.md`) → `implement`. Ninguna fase puede comenzar sin que el artefacto de la fase anterior haya sido completado y aprobado.
2. **Puerta Constitucional (Constitution Check)**:
   - Todo plan técnico (`plan.md`) **MUST** evaluar el cumplimiento de los 15 principios de esta Constitución antes de iniciar el diseño detallado (Fase 0) y revalidarlo al concluir la arquitectura (Fase 1).
   - Cualquier complejidad técnica, excepción o desviación temporal respecto de los principios **MUST** registrarse en la sección de Complexity Tracking del plan, acompañarse de justificación técnica y someterse a aprobación explícita.
3. **Definición de Hecho Reforzada (Definition of Done)**:
   - Ninguna tarea o funcionalidad se considerará "Hecha" únicamente porque supere la compilación o las pruebas de tipado/lint.
   - El implementador **MUST** ejecutar pruebas de comportamiento de punta a punta (camino feliz y camino infeliz de degradación controlada) y verificar el resultado observable antes de entregar el incremento.
   - Lo que no sea verificable automáticamente **MUST** marcarse explícitamente como "pendiente de verificación humana"; queda estrictamente prohibido reportar tareas como concluidas basándose en expectativas no probadas.

---

## 5. Criterios Obligatorios de Aprobación

Para que un incremento de software, módulo o especificación sea aprobado para su integración y despliegue productivo, **MUST** cumplir la totalidad de las siguientes condiciones mínimas:

- [ ] **Validación de Permisos**: Los permisos están implementados y verificados en el backend, contando con pruebas automatizadas negativas que demuestran el rechazo a accesos no autorizados.
- [ ] **Higiene de Secretos**: No existen credenciales, contraseñas, claves privadas ni secretos expuestos en código, repositorios Git, logs, trazas de error ni respuestas de API.
- [ ] **Protocolos Seguros**: Las conexiones hacia servidores remotos e interfaces externas utilizan exclusivamente mecanismos aprobados de transporte cifrado y autenticación segura.
- [ ] **Exactitud de Estados**: Los fallos de conectividad, agentes desconectados y datos caducos se representan mediante estados explícitos (`UNREACHABLE`, `AGENT_DISCONNECTED`, `STALE_DATA`), impidiendo que la ausencia de telemetría se interprete como normalidad.
- [ ] **Trazabilidad de Diagnósticos**: Todo diagnóstico, alerta o categorización automática está respaldada por referencias comprobables a líneas de log o métricas de soporte.
- [ ] **Auditoría de Acciones Críticas**: Todas las operaciones sobre usuarios, servidores, credenciales y parámetros de configuración emiten registros de auditoría estructurados e inmutables.
- [ ] **Pruebas de Resiliencia Ejecutadas**: Las pruebas automatizadas que cubren pérdida de conectividad, saturación de alertas, recuperación de servicios y errores de ingestión han sido ejecutadas satisfactoriamente con resultados documentados.
- [ ] **Documentación Operativa Completa**: Las guías de instalación, configuración, actualización y recuperación ante contingencias están redactadas y validadas.
- [ ] **Gestión de Vulnerabilidades**: Las dependencias no presentan vulnerabilidades críticas conocidas sin mitigación formalmente autorizada.

---

## 6. Gobierno del Desarrollo

1. **Supremacía Constitucional**: Esta Constitución prevalece sobre cualquier convención, práctica de equipo o conveniencia temporal. Ante cualquier discrepancia, la resolución favorecerá siempre las obligaciones aquí estipuladas.
2. **Especificación como Contrato**: La especificación aprobada es el contrato vinculante del comportamiento observable del sistema; el código que se aparte de la especificación sin enmienda formal previa es defectuoso por definición.
3. **Prohibición de Relajación Silenciosa**: Ningún control de seguridad, validación de autorización ni puerta de calidad podrá desactivarse o relajarse silenciosamente para permitir que una prueba pase o acelerar una entrega.
4. **Gestión de Ambigüedades**: Cuando un agente de desarrollo o ingeniero identifique una ambigüedad crítica en requerimientos de seguridad, datos o permisos, **MUST** detenerse de inmediato y solicitar una decisión explícita al responsable del proyecto antes de proceder.
5. **Procedimiento de Enmienda**: Toda modificación a esta Constitución requerirá:
   - Propuesta formal por escrito justificando la motivación técnica y el impacto en el sistema.
   - Aprobación explícita del arquitecto de software o responsable del proyecto.
   - Actualización del Sync Impact Report al inicio del documento.
   - Evaluación y ajuste de las plantillas y especificaciones dependientes.
6. **Política de Versionado Semántico de la Constitución**:
   - **MAJOR (X.0.0)**: Modificaciones que redefinan, eliminen o alteren de forma incompatible principios fundamentales, reglas de seguridad o gobernanza.
   - **MINOR (1.X.0)**: Incorporación de nuevos principios, ampliación sustancial de directrices o adición de secciones normativas compatibles.
   - **PATCH (1.0.X)**: Correcciones editoriales, aclaraciones de redacción, resolución de erratas o refinamientos de estilo que no alteren el alcance normativo.
7. **Revisión de Cumplimiento**: Toda revisión de arquitectura, pull request o entrega de fase evaluará explícitamente el cumplimiento de estos principios antes de su aprobación.

---

**Version**: 1.0.0 | **Ratified**: Pendiente de confirmación | **Last Amended**: 2026-10-28
