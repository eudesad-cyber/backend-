/**
 * Smoke test da aplicacao Express (sem banco): valida middlewares globais,
 * validacao de entrada, rota 404 e o formato padrao de erro.
 *
 * A rota de login e exercitada com o AuthService "stubado" via jest.spyOn para
 * nao depender de PostgreSQL.
 */
import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../app';
import { authService } from '../services/auth.service';
import { taskService } from '../services/task.service';

describe('App (HTTP)', () => {
  let app: Application;

  beforeEach(() => {
    app = createApp();
  });

  afterEach(() => jest.restoreAllMocks());

  it('GET /health responde 200', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /docs.json entrega a especificacao OpenAPI', async () => {
    const res = await request(app).get('/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
    expect(res.body.paths['/tasks']).toBeDefined();
  });

  it('rota inexistente responde 404 no formato padrao de erro', async () => {
    const res = await request(app).get('/api/v1/nao-existe');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('POST /auth/login com corpo invalido responde 422 com detalhes por campo', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ email: 'nao-e-email' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });

  it('rotas de tarefas exigem token (401)', async () => {
    const res = await request(app).get('/api/v1/tasks');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('token malformado responde 401', async () => {
    const res = await request(app).get('/api/v1/tasks').set('Authorization', 'Bearer abc.def.ghi');
    expect(res.status).toBe(401);
  });

  it('POST /auth/login devolve 200 e tokens quando as credenciais sao validas', async () => {
    jest.spyOn(authService, 'login').mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: '1h',
      user: {
        id: '22222222-2222-4222-8222-222222222222',
        name: 'Usuario Demo',
        email: 'user@example.com',
        role: 'USER',
        isActive: true,
        createdAt: new Date(),
      },
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'user@example.com', password: 'Senha1234' });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBe('access');
    expect(res.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('GET /tasks/:id com id nao-UUID responde 422', async () => {
    jest.spyOn(authService, 'me');
    const token = (await import('../services/token.service')).signAccessToken({
      sub: '22222222-2222-4222-8222-222222222222',
      email: 'user@example.com',
      role: 'USER',
    });

    const res = await request(app).get('/api/v1/tasks/nao-e-uuid').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe('id');
  });

  it('GET /tasks/:id delega ao service e responde 200', async () => {
    const { signAccessToken } = await import('../services/token.service');
    const token = signAccessToken({
      sub: '22222222-2222-4222-8222-222222222222',
      email: 'user@example.com',
      role: 'USER',
    });
    const id = '11111111-1111-4111-8111-111111111111';
    jest.spyOn(taskService, 'findById').mockResolvedValue({
      id,
      title: 'Tarefa',
      description: null,
      status: 'PENDING',
      priority: 'MEDIUM',
      dueDate: null,
      ownerId: '22222222-2222-4222-8222-222222222222',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app).get(`/api/v1/tasks/${id}`).set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
  });
});
