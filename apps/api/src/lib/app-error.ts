/**
 * Typed application error. Thrown anywhere in the request pipeline and turned
 * into a consistent JSON error response by the error middleware.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(400, 'BAD_REQUEST', message, details);
  }
  static unauthorized(message = 'Authentication required'): AppError {
    return new AppError(401, 'UNAUTHORIZED', message);
  }
  static forbidden(message = 'You do not have access to this resource'): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'Resource not found'): AppError {
    return new AppError(404, 'NOT_FOUND', message);
  }
  static conflict(message: string): AppError {
    return new AppError(409, 'CONFLICT', message);
  }
}
