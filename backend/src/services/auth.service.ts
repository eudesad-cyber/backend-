/**
 * Regras de negocio de autenticacao.
 *
 * - Senhas nunca sao armazenadas em texto puro (bcrypt).
 * - Acesso via access token JWT (curto) + refresh token opaco (longo, rotativo,
 *   revogavel e persistido apenas como hash).
 * - Erros de login nao revelam se o email existe (evita enumeracao de usuarios).
 */
import bcrypt from 'bcryptjs';
import type { PrismaClient, Role } from '@prisma/client';
import { prisma as defaultPrisma } from '../config/prisma';
import { env } from '../config/env';
import { AppError } from '../errors/AppError';
import type { LoginInput, RegisterInput, UserPublic } from '../schemas/auth.schema';
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
} from './token.service';

const REFRESH_TTL_DAYS = 7;

export interface AuthContext {
  userAgent?: string;
  ip?: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  user: UserPublic;
}

type Db = PrismaClient;

export class AuthService {
  constructor(private readonly db: Db = defaultPrisma) {}

  /** Registra um usuario comum (role USER). */
  async register(input: RegisterInput, ctx: AuthContext = {}): Promise<AuthResult> {
    const existing = await this.db.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (existing) {
      throw AppError.conflict('Email ja cadastrado');
    }

    const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

    const user = await this.db.user.create({
      data: { name: input.name, email: input.email, passwordHash },
      select: publicUserSelect,
    });

    return this.issueTokens(user, ctx);
  }

  /** Autentica email + senha. */
  async login(input: LoginInput, ctx: AuthContext = {}): Promise<AuthResult> {
    const user = await this.db.user.findUnique({ where: { email: input.email } });

    // Compara mesmo quando o usuario nao existe para manter o tempo de resposta constante.
    const hash = user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvali';
    const passwordOk = await bcrypt.compare(input.password, hash);

    if (!user || !passwordOk) {
      throw AppError.unauthorized('Credenciais invalidas');
    }
    if (!user.isActive) {
      throw AppError.forbidden('Conta desativada');
    }

    return this.issueTokens(toPublicUser(user), ctx);
  }

  /**
   * Rotaciona o refresh token: valida, revoga o usado e emite um novo par.
   * Detectar token ja revogado interrompe a cadeia (possivel roubo de token).
   */
  async refresh(refreshToken: string, ctx: AuthContext = {}): Promise<AuthResult> {
    const tokenHash = hashRefreshToken(refreshToken);

    const stored = await this.db.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
      throw AppError.unauthorized('Refresh token invalido ou expirado');
    }
    if (!stored.user.isActive) {
      throw AppError.forbidden('Conta desativada');
    }

    await this.db.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(toPublicUser(stored.user), ctx);
  }

  /** Revoga um refresh token (logout). Idempotente. */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);
    await this.db.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Perfil do usuario autenticado. */
  async me(userId: string): Promise<UserPublic> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: publicUserSelect,
    });
    if (!user) throw AppError.notFound('Usuario nao encontrado');
    return user;
  }

  /** Lista usuarios (somente ADMIN). */
  async listUsers(): Promise<UserPublic[]> {
    return this.db.user.findMany({ select: publicUserSelect, orderBy: { createdAt: 'desc' } });
  }

  /** Altera o papel de um usuario (somente ADMIN). */
  async setRole(userId: string, role: Role): Promise<UserPublic> {
    const user = await this.db.user.findUnique({ where: { id: userId }, select: { id: true } });
    if (!user) throw AppError.notFound('Usuario nao encontrado');

    return this.db.user.update({
      where: { id: userId },
      data: { role },
      select: publicUserSelect,
    });
  }

  /** Emite access + refresh e persiste o hash do refresh. */
  private async issueTokens(user: UserPublic, ctx: AuthContext): Promise<AuthResult> {
    const accessToken = signAccessToken({ sub: user.id, email: user.email, role: user.role });

    const refreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.db.refreshToken.create({
      data: {
        tokenHash: hashRefreshToken(refreshToken),
        userId: user.id,
        expiresAt,
        userAgent: ctx.userAgent?.slice(0, 255),
        ip: ctx.ip?.slice(0, 64),
      },
    });

    // Limpeza oportunista de tokens expirados deste usuario (evita crescimento infinito).
    await this.db.refreshToken.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() } },
    });

    return { accessToken, refreshToken, expiresIn: env.JWT_EXPIRES_IN, user };
  }
}

export const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
} as const;

function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
}): UserPublic {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

export const authService = new AuthService();
