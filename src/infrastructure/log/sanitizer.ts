/**
 * Sanitizador de datos sensibles en registros de log.
 *
 * Implementa el Principio III (Gestión Segura de Credenciales) y el
 * Principio XIII (Privacidad y Exposición Mínima de Datos) de la
 * Constitución. Todos los patrones de credenciales, tokens, claves
 * privadas y PII se enmascaran antes del almacenamiento.
 */

// Patrones de datos sensibles a enmascarar
const SENSITIVE_PATTERNS: Array<{ name: string; regex: RegExp; replacement: string }> = [
  {
    name: "contraseña embebida",
    regex: /(password|passwd|pwd|contraseña|secret)\s*[:=\s]\s*["']?([^\s"',}]+)["']?/gi,
    replacement: "$1=[REDACTED]",
  },
  {
    name: "token de sesión/API (Bearer, JWT, API key)",
    regex: /(token|api[_-]?key|access[_-]?token|bearer)\s*[:=\s]\s*["']?([^\s"',}]+)["']?/gi,
    replacement: "$1=[REDACTED]",
  },
  {
    name: "JWT token standalone",
    regex: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    replacement: "[REDACTED]",
  },
  {
    name: "clave privada SSH",
    regex: /-----BEGIN\s+(OPENSSH\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(OPENSSH\s+)?PRIVATE\s+KEY-----/gi,
    replacement: "-----BEGIN PRIVATE KEY-----\n[REDACTED]\n-----END PRIVATE KEY-----",
  },
  {
    name: "clave pública SSH",
    regex: /ssh-rsa\s+[A-Za-z0-9+/]+={0,3}/gi,
    replacement: "ssh-rsa [REDACTED]",
  },
  {
    name: "dirección IP privada (en contexto de credencial)",
    regex: /(from|connecting\s+from|client)\s+(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/gi,
    replacement: "$1 [REDACTED_IP]",
  },
  {
    name: "número de tarjeta de crédito",
    regex: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: "[REDACTED_CARD]",
  },
  {
    name: "correo electrónico (PII)",
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: "[REDACTED_EMAIL]",
  },
  {
    name: "UUID/identificador interno",
    regex: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g,
    replacement: "[REDACTED_ID]",
  },
];

/**
 * Enmascara datos sensibles en un mensaje de log.
 * Devuelve el mensaje sanetizado y un booleano indicando si se detectaron datos sensibles.
 *
 * @param message - Mensaje original del log
 * @returns Objeto con el mensaje sanetizado y si se encontraron datos sensibles
 */
export function sanitizeMessage(message: string): {
  sanitized: string;
  hasSensitiveData: boolean;
} {
  let sanitized = message;
  let hasSensitive = false;

  for (const pattern of SENSITIVE_PATTERNS) {
    const newSanitized = sanitized.replace(pattern.regex, pattern.replacement);
    if (newSanitized !== sanitized) {
      hasSensitive = true;
      sanitized = newSanitized;
    }
  }

  return { sanitized, hasSensitiveData: hasSensitive };
}

/**
 * Enmascara datos sensibles en el texto crudo de un log.
 * El raw log se preserva inmutable pero con campos sensibles enmascarados
 * para evitar exposición accidental en consultas y exports.
 *
 * @param rawLog - Texto original del log
 * @returns Texto crudo con datos sensibles enmascarados
 */
export function sanitizeRawLog(rawLog: string): string {
  let sanitized = rawLog;

  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern.regex, pattern.replacement);
  }

  return sanitized;
}

/**
 * Verifica si un mensaje contiene datos sensibles que requieren enmascaramiento.
 */
export function containsSensitiveData(message: string): boolean {
  return SENSITIVE_PATTERNS.some((p) => p.regex.test(message));
}
