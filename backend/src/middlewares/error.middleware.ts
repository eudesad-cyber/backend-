import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../errors/AppError';
import { isProd } from '../config/env';

interface ErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    stack?: string;
  };
}

/**
 * Tratamento centralizado de erros.
 *
 * Mapeia cada familia de erro para o status HTTP correto:
 *  - AppError                  -> status definido pela regra de negocio
 *  - ZodError                  -> 422 (dados invalidos)
 *  - Prisma P2002              -> 409 (violacao de unicidade)
 *  - Prisma P2025              -> 404 (registro inexistente)
 *  - Prisma P2003              -> 400 (violacao de FK)
 *  - Prisma P1001/P1002/P1017  -> 503 (banco fora do ar / inacessivel)
 *  - PayloadTooLarge/JSON      -> 413 / 400
 *  - qualquer outro            -> 500 (sem vazar stack em producao)
 */
export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (res.headersSent) {
    return next(err);
  }

  const { status, code, message, details } = normalize(err);

  if (status >= 500) {
    // Log completo apenas no servidor. 503 e previsivel: log curto, sem stack.
    if (status === 503) {
      console.error(`[error] ${req.method} ${req.originalUrl} -> 503 ${code}`);
    } else {
      console.error(`[error] ${req.method} ${req.originalUrl} -> ${status}`, err);
    }
  }

  const body: ErrorBody = {
    success: false,
    error: { code, message, ...(details !== undefined ? { details } : {}) },
  };

  if (!isProd && err instanceof Error) {
    body.error.stack = err.stack;
  }

  res.status(status).json(body);
}

function normalize(err: unknown): {
  status: number;
  code: string;
  message: string;
  details?: unknown;
} {
  if (err instanceof AppError) {
    return {
      status: err.statusCode,
      code: err.code,
      message: err.message,
      details: err.details,
    };
  }

  if (err instanceof ZodError) {
    return {
      status: 422,
      code: 'UNPROCESSABLE_ENTITY',
      message: 'Dados invalidos',
      details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
    };
  }

  // Banco fora do ar ou inacessivel: e indisponibilidade (503), nao bug do codigo.
  if (err instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: 503,
      code: 'DATABASE_UNAVAILABLE',
      message: 'Banco de dados indisponivel no momento. Tente novamente em instantes.',
    };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P1001' || err.code === 'P1002' || err.code === 'P1017') {
      return {
        status: 503,
        code: 'DATABASE_UNAVAILABLE',
        message: 'Banco de dados indisponivel no momento. Tente novamente em instantes.',
      };
    }
    switch (err.code) {
      case 'P2002': {
        const target = (err.meta?.target as string[] | undefined)?.join(', ');
        return {
          status: 409,
          code: 'CONFLICT',
          message: target ? `Valor ja cadastrado para: ${target}` : 'Registro duplicado',
        };
      }
      case 'P2025':
        return { status: 404, code: 'NOT_FOUND', message: 'Registro nao encontrado' };
      case 'P2003':
        return { status: 400, code: 'BAD_REQUEST', message: 'Referencia invalida' };
      default:
        return {
          status: 500,
          code: 'DATABASE_ERROR',
          message: 'Erro ao acessar o banco de dados',
        };
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    return { status: 400, code: 'BAD_REQUEST', message: 'Consulta invalida' };
  }

  if (err instanceof SyntaxError && 'body' in err) {
    return { status: 400, code: 'BAD_REQUEST', message: 'JSON malformado no corpo da requisicao' };
  }

  const anyErr = err as { type?: string; status?: number; statusCode?: number; message?: string };
  if (anyErr?.type === 'entity.too.large') {
    return { status: 413, code: 'PAYLOAD_TOO_LARGE', message: 'Corpo da requisicao muito grande' };
  }
  if (typeof anyErr?.status === 'number' && anyErr.status < 500) {
    return { status: anyErr.status, code: 'BAD_REQUEST', message: anyErr.message ?? 'Erro na requisicao' };
  }

  return {
    status: 500,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Erro interno do servidor',
  };
}
