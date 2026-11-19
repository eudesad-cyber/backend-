import { Router } from 'express';
import { z } from 'zod';
import * as authController from '../controllers/auth.controller';
import {
  loginSchema,
  refreshSchema,
  registerSchema,
  updateUserRoleSchema,
} from '../schemas/auth.schema';
import { validate } from '../middlewares/validate.middleware';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { loginRateLimiter } from '../middlewares/rateLimit.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

/** POST /auth/register — cria conta (role USER) e ja devolve tokens. */
router.post('/register', loginRateLimiter, validate(registerSchema), asyncHandler(authController.register));

/** POST /auth/login — autentica e devolve access + refresh token. */
router.post('/login', loginRateLimiter, validate(loginSchema), asyncHandler(authController.login));

/** POST /auth/refresh — rotaciona o refresh token. */
router.post('/refresh', validate(refreshSchema), asyncHandler(authController.refresh));

/** POST /auth/logout — revoga o refresh token informado. */
router.post('/logout', validate(refreshSchema), asyncHandler(authController.logout));

/** GET /auth/me — perfil do usuario autenticado. */
router.get('/me', authenticate, asyncHandler(authController.me));

/** GET /users — lista usuarios (somente ADMIN). */
router.get('/users', authenticate, authorize('ADMIN'), asyncHandler(authController.listUsers));

/** PATCH /users/:id/role — promove/rebaixa um usuario (somente ADMIN). */
router.patch(
  '/users/:id/role',
  authenticate,
  authorize('ADMIN'),
  validate(z.object({ id: z.string().uuid() }), 'params'),
  validate(updateUserRoleSchema),
  asyncHandler(authController.updateUserRole),
);

export default router;
