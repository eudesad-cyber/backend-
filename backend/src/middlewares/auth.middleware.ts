import type { NextFunction, Request, Response } from 'express';
import type { Role } from '@prisma/client';
import { verifyAccessToken } from '../services/token.service';
import { AppError } from '../errors/AppError';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Autenticacao: exige `Authorization: Bearer <accessToken>` valido.
 * Popula `req.user` com id/email/role extraidos do JWT.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Token de acesso ausente'));
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    return next(AppError.unauthorized('Token de acesso ausente'));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    return next();
  } catch (err) {
    const expired = (err as Error).name === 'TokenExpiredError';
    return next(
      AppError.unauthorized(expired ? 'Token de acesso expirado' : 'Token de acesso invalido'),
    );
  }
}

/**
 * Autorizacao por papel (RBAC). Uso: `authorize('ADMIN')` ou `authorize('ADMIN','USER')`.
 * Deve ser usado sempre DEPOIS de `authenticate`.
 */
export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return next(AppError.forbidden('Seu perfil nao tem permissao para esta acao'));
    }
    return next();
  };
}
