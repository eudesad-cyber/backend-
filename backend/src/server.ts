import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';

/**
 * Inicializacao do servidor HTTP com:
 *  - checagem do banco antes de aceitar trafego (fail fast);
 *  - graceful shutdown (fecha HTTP e conexoes do Prisma);
 *  - handlers de erro nao tratado.
 */
async function bootstrap(): Promise<void> {
  await prisma.$connect();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.info(`[server] API ouvindo em http://localhost:${env.PORT}`);
    console.info(`[server] Swagger em http://localhost:${env.PORT}/docs`);
    console.info(`[server] ambiente: ${env.NODE_ENV}`);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.info(`[server] recebido ${signal}, encerrando...`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
    // Fallback: nao ficar pendurado para sempre.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('unhandledRejection', (reason) => {
    console.error('[server] unhandledRejection', reason);
  });
  process.on('uncaughtException', (error) => {
    console.error('[server] uncaughtException', error);
    void shutdown('uncaughtException');
  });
}

bootstrap().catch((error) => {
  console.error('[server] falha ao iniciar', error);
  process.exit(1);
});
