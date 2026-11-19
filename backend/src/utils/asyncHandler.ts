import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Encapsula controllers assincronos.
 *
 * No Express 4, uma Promise rejeitada dentro de um handler nao vai para o
 * error middleware e derruba o processo / deixa a requisicao pendurada.
 * Este wrapper garante que todo `throw`/reject chegue em `errorMiddleware`.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
