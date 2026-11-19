import rateLimit from 'express-rate-limit';
import { env, isTest } from '../config/env';
import { AppError } from '../errors/AppError';

/**
 * Rate limit global: protege a API de abuso e forca bruta distribuida.
 * Desativado em testes para nao gerar flakiness.
 */
export const globalRateLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => isTest,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests('Muitas requisicoes. Tente novamente em alguns minutos.'));
  },
});

/** Rate limit mais rigoroso em login/registro (anti brute force). */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: () => isTest,
  handler: (_req, _res, next) => {
    next(AppError.tooManyRequests('Muitas tentativas de login. Tente novamente mais tarde.'));
  },
});
