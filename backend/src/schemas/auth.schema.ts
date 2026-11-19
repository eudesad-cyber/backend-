import type { Role } from '@prisma/client';
import { z } from 'zod';

const passwordPolicy = z
  .string()
  .min(8, 'A senha deve ter no minimo 8 caracteres')
  .max(72, 'A senha deve ter no maximo 72 caracteres')
  .regex(/[A-Za-z]/, 'A senha deve conter ao menos uma letra')
  .regex(/[0-9]/, 'A senha deve conter ao menos um numero');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nome muito curto').max(120, 'Nome muito longo'),
  email: z.string().trim().toLowerCase().email('Email invalido').max(180),
  password: passwordPolicy,
  // `role` NAO e aceito no registro publico: elevacao de privilegio so via ADMIN.
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email invalido'),
  password: z.string().min(1, 'Informe a senha'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10, 'refreshToken invalido'),
});

export const updateUserRoleSchema = z.object({
  role: z.enum(['USER', 'ADMIN']),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type UpdateUserRoleInput = z.infer<typeof updateUserRoleSchema>;

export interface UserPublic {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
}
