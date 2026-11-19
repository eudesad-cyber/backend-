import express, { type Application, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { corsOrigins, isProd } from './config/env';
import openApiSpec from './config/swagger';
import authRoutes from './routes/auth.routes';
import taskRoutes from './routes/task.routes';
import { errorMiddleware } from './middlewares/error.middleware';
import { globalRateLimiter } from './middlewares/rateLimit.middleware';
import { AppError } from './errors/AppError';

/**
 * Cria a aplicacao Express (sem `listen`), o que permite testar via supertest
 * sem abrir porta.
 */
export function createApp(): Application {
  const app = express();

  // Nao anunciar o framework.
  app.disable('x-powered-by');
  // Necessario para `req.ip` correto atras de proxy (rate limit / auditoria).
  app.set('trust proxy', 1);

  // --- Middlewares globais (ordem importa) ---------------------------------
  app.use(helmet());
  app.use(
    cors({
      origin: corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 86400,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(globalRateLimiter);

  // Request id simples para correlacionar logs.
  app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] ?? `req_${Date.now().toString(36)}`;
    res.setHeader('X-Request-Id', String(requestId));
    next();
  });

  // --- Documentacao ---------------------------------------------------------
  app.get('/docs.json', (_req: Request, res: Response) => res.json(openApiSpec));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, { customSiteTitle: 'Backend Tasks API' }));

  // --- Rotas ---------------------------------------------------------------
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1/tasks', taskRoutes);

  // 404 explicito para rotas inexistentes.
  app.use((req, _res, next) => {
    next(AppError.notFound(`Rota nao encontrada: ${req.method} ${req.originalUrl}`));
  });

  // Error handler SEMPRE por ultimo.
  app.use(errorMiddleware);

  if (isProd) {
    // Nao logar stack em producao (o middleware ja esconde do cliente).
    console.info('[app] executando em modo production');
  }

  return app;
}
