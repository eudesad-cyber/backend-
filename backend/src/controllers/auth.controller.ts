import type { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import type { LoginInput, RegisterInput, UpdateUserRoleInput } from '../schemas/auth.schema';
import { AppError } from '../errors/AppError';
import type { Role } from '@prisma/client';

/** Contexto do cliente para auditoria dos refresh tokens. */
function contextOf(req: Request) {
  return { userAgent: req.get('user-agent') ?? undefined, ip: req.ip };
}

/** POST /api/v1/auth/register -> 201 */
export async function register(req: Request, res: Response): Promise<void> {
  const body = req.body as RegisterInput;
  const result = await authService.register(body, contextOf(req));
  res.status(201).json({ success: true, data: result });
}

/** POST /api/v1/auth/login -> 200 */
export async function login(req: Request, res: Response): Promise<void> {
  const body = req.body as LoginInput;
  const result = await authService.login(body, contextOf(req));
  res.status(200).json({ success: true, data: result });
}

/** POST /api/v1/auth/refresh -> 200 (rotaciona o refresh token) */
export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as { refreshToken: string };
  const result = await authService.refresh(refreshToken, contextOf(req));
  res.status(200).json({ success: true, data: result });
}

/** POST /api/v1/auth/logout -> 204 */
export async function logout(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as { refreshToken: string };
  await authService.logout(refreshToken);
  res.status(204).send();
}

/** GET /api/v1/auth/me -> 200 */
export async function me(req: Request, res: Response): Promise<void> {
  if (!req.user) throw AppError.unauthorized();
  const user = await authService.me(req.user.id);
  res.status(200).json({ success: true, data: user });
}

/** GET /api/v1/users -> 200 (ADMIN) */
export async function listUsers(_req: Request, res: Response): Promise<void> {
  const users = await authService.listUsers();
  res.status(200).json({ success: true, data: users });
}

/** PATCH /api/v1/users/:id/role -> 200 (ADMIN) */
export async function updateUserRole(req: Request, res: Response): Promise<void> {
  const { role } = req.body as UpdateUserRoleInput;
  const user = await authService.setRole(req.params.id, role as Role);
  res.status(200).json({ success: true, data: user });
}
