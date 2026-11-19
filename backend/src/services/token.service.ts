import crypto from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env';

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: Role;
}

/** Gera o access token (curto) assinado com HS256. */
export function signAccessToken(payload: AccessTokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    algorithm: 'HS256',
    issuer: 'backend-tasks-api',
  };
  return jwt.sign({ email: payload.email, role: payload.role }, env.JWT_SECRET, {
    ...options,
    subject: payload.sub,
  });
}

/** Verifica assinatura + expiracao. Lanca em token invalido/expirado. */
export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: 'backend-tasks-api',
  }) as jwt.JwtPayload & { email: string; role: Role };

  if (!decoded.sub) {
    throw new Error('Token sem subject');
  }
  return { sub: decoded.sub, email: decoded.email, role: decoded.role };
}

/** Refresh token opaco (aleatorio). Nunca e salvo em texto puro. */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

/** Hash do refresh token para armazenamento (sha256 e suficiente: o token e aleatorio). */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
