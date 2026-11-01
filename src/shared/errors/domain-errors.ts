export class DomainError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string = "DOMAIN_ERROR", statusCode: number = 400) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message: string = "Sesión no autenticada o token inválido.") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message: string = "No tienes permisos suficientes para realizar esta acción.") {
    super(message, "FORBIDDEN_ACTION", 403);
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string = "Recurso") {
    super(`${resource} no encontrado.`, "NOT_FOUND", 404);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}

export class ValidationError extends DomainError {
  public readonly details?: string[];

  constructor(message: string, details?: string[]) {
    super(message, "VALIDATION_FAILED", 400);
    this.details = details;
  }
}

