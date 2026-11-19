/**
 * Erro de aplicacao com status HTTP.
 *
 * Todo erro "esperado" (validacao, regra de negocio, autorizacao) e lancado como
 * AppError; o error.middleware transforma isso na resposta HTTP correta. Qualquer
 * outro erro cai em 500 sem vazar detalhes internos.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    message: string,
    options: { code?: string; details?: unknown } = {},
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = options.code ?? defaultCode(statusCode);
    this.details = options.details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, AppError);
  }

  static badRequest(message = 'Requisicao invalida', details?: unknown) {
    return new AppError(400, message, { code: 'BAD_REQUEST', details });
  }
  static unauthorized(message = 'Nao autenticado') {
    return new AppError(401, message, { code: 'UNAUTHORIZED' });
  }
  static forbidden(message = 'Acesso negado') {
    return new AppError(403, message, { code: 'FORBIDDEN' });
  }
  static notFound(message = 'Recurso nao encontrado') {
    return new AppError(404, message, { code: 'NOT_FOUND' });
  }
  static conflict(message = 'Conflito de dados') {
    return new AppError(409, message, { code: 'CONFLICT' });
  }
  static unprocessable(message = 'Dados invalidos', details?: unknown) {
    return new AppError(422, message, { code: 'UNPROCESSABLE_ENTITY', details });
  }
  static tooManyRequests(message = 'Muitas requisicoes') {
    return new AppError(429, message, { code: 'TOO_MANY_REQUESTS' });
  }
}

function defaultCode(status: number): string {
  const map: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    429: 'TOO_MANY_REQUESTS',
    500: 'INTERNAL_SERVER_ERROR',
  };
  return map[status] ?? 'ERROR';
}
