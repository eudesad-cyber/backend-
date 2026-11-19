/**
 * Testes de autenticacao (regras de negocio de login/refresh/logout).
 */
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { AuthService } from '../services/auth.service';
import { hashRefreshToken, verifyAccessToken } from '../services/token.service';

function buildPrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  };
}

const password = 'Senha1234';
let passwordHash: string;

const userRow = () => ({
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Usuario Demo',
  email: 'user@example.com',
  role: 'USER' as const,
  isActive: true,
  createdAt: new Date(),
  passwordHash,
});

describe('AuthService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: AuthService;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(password, 4); // custo baixo: testes rapidos
  });

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new AuthService(prisma as unknown as PrismaClient);
    prisma.refreshToken.create.mockResolvedValue({});
    prisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('registra usuario com hash de senha e emite tokens validos', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const { passwordHash: _ignored, ...publicRow } = userRow();
    prisma.user.create.mockResolvedValue(publicRow);

    const result = await service.register({ name: 'Usuario Demo', email: 'user@example.com', password });

    const createArgs = prisma.user.create.mock.calls[0][0];
    expect(createArgs.data.passwordHash).not.toBe(password);
    expect(await bcrypt.compare(password, createArgs.data.passwordHash)).toBe(true);

    expect(result.user).not.toHaveProperty('passwordHash');
    expect(verifyAccessToken(result.accessToken).sub).toBe(publicRow.id);

    // O refresh token so e persistido como hash.
    const storedHash = prisma.refreshToken.create.mock.calls[0][0].data.tokenHash;
    expect(storedHash).toBe(hashRefreshToken(result.refreshToken));
    expect(storedHash).not.toBe(result.refreshToken);
  });

  it('rejeita registro com email duplicado (409)', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'x' });

    await expect(
      service.register({ name: 'Usuario Demo', email: 'user@example.com', password }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('autentica com credenciais corretas', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());

    const result = await service.login({ email: 'user@example.com', password });

    expect(result.accessToken).toBeTruthy();
    expect(result.user.email).toBe('user@example.com');
  });

  it('rejeita senha incorreta e email inexistente com a mesma mensagem (sem enumeracao)', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());
    const wrongPassword = service.login({ email: 'user@example.com', password: 'Errada123' });

    prisma.user.findUnique.mockResolvedValue(null);
    const unknownUser = service.login({ email: 'nobody@example.com', password });

    await expect(wrongPassword).rejects.toMatchObject({ statusCode: 401, message: 'Credenciais invalidas' });
    await expect(unknownUser).rejects.toMatchObject({ statusCode: 401, message: 'Credenciais invalidas' });
  });

  it('rejeita conta desativada (403)', async () => {
    prisma.user.findUnique.mockResolvedValue({ ...userRow(), isActive: false });

    await expect(service.login({ email: 'user@example.com', password })).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('rotaciona o refresh token: revoga o antigo e emite um novo par', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      tokenHash: 'hash',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: userRow(),
    });
    prisma.refreshToken.update.mockResolvedValue({});

    const result = await service.refresh('refresh-token-qualquer');

    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt-1' },
      data: { revokedAt: expect.any(Date) },
    });
    expect(result.refreshToken).toBeTruthy();
  });

  it('rejeita refresh token expirado, revogado ou desconhecido', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null);
    await expect(service.refresh('x')).rejects.toMatchObject({ statusCode: 401 });

    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      user: userRow(),
    });
    await expect(service.refresh('x')).rejects.toMatchObject({ statusCode: 401 });

    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      user: userRow(),
    });
    await expect(service.refresh('x')).rejects.toMatchObject({ statusCode: 401 });
  });

  it('logout revoga o token pelo hash', async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    await service.logout('meu-refresh');

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { tokenHash: hashRefreshToken('meu-refresh'), revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
