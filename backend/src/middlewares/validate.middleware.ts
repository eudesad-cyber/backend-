import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { AppError } from '../errors/AppError';

type Source = 'body' | 'query' | 'params';

/**
 * Valida e *substitui* os dados da requisicao pelo resultado tipado do Zod.
 * Assim o controller recebe apenas dados validados (nada de `as any`).
 */
export function validate(schema: ZodTypeAny, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return next(
        AppError.unprocessable('Dados invalidos', formatIssues(result.error.issues)),
      );
    }

    // req.query/req.params sao getters em algumas versoes do Express:
    // atribuimos com defineProperty para garantir a substituicao.
    Object.defineProperty(req, source, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    return next();
  };
}

export function formatIssues(issues: z.ZodIssue[]) {
  return issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
    code: issue.code,
  }));
}
