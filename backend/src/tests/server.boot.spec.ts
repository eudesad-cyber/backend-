/**
 * O que este teste protege:
 *  - a API sobe mesmo com o banco fora do ar (antes o processo morria com P1001
 *    e o terminal parecia "nao fazer nada");
 *  - /health responde 200 nessa situacao;
 *  - a tela do Swagger em /docs/ e servida com 200 (sem CSP bloqueando o inline).
 */
import type { Application } from 'express';
import request from 'supertest';
import { createApp } from '../app';

describe('Inicializacao e rotas de infraestrutura', () => {
  let app: Application;

  beforeAll(() => {
    app = createApp();
  });

  it('GET /health responde 200 mesmo sem banco conectado', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /docs/ entrega o Swagger UI (HTML)', async () => {
    const res = await request(app).get('/docs/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
    // Sem CSP restritiva: o Swagger usa script/style inline.
    expect(res.headers['content-security-policy']).toBeUndefined();
  });

  it('GET /docs.json entrega a especificacao OpenAPI', async () => {
    const res = await request(app).get('/docs.json');
    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe('3.0.3');
  });

  it('rotas protegidas respondem 401 (JSON) antes de tocar no banco', async () => {
    const res = await request(app).get('/api/v1/tasks');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});
