import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './config/prisma';
import express from 'express'
import cors from 'cors'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import banco from './banco.js'
 
const app = express()
const PORTA = 3000
 
  const token = jwt.sign({ id: pessoa.id }, SEGREDO, { expiresIn: '7d' })
 
  res.json({ token: token })
})
// Segredo usado para assinar os tokens. Em um projeto de verdade, ele fica
// em uma variável de ambiente e nunca é escrito no código.
const SEGREDO = 'segredo-do-instaclone'
/**
 * Inicializacao do servidor HTTP com:
 *  - aviso claro (em vez de crash silencioso) quando o banco esta fora do ar;
 *  - graceful shutdown (fecha HTTP e conexoes do Prisma);
 *  - handlers de erro nao tratado.
 *
 * Nota: nao chamamos prisma.$connect() aqui. O Prisma conecta na primeira
 * query; se o banco estiver fora, o erro aparece no log com a instrucao do
 * que fazer, e o processo NAO morre (antes ele encerrava com exit code 1 e o
 * terminal parecia "nao fazer nada").
 */
async function bootstrap(): Promise<void> {
  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.info(`[server] API ouvindo em http://localhost:${env.PORT}`);
    console.info(`[server] Swagger em http://localhost:${env.PORT}/docs`);
    console.info(`[server] ambiente: ${env.NODE_ENV}`);
  });

  // Checagem de banco em segundo plano: informa, mas nao derruba o servidor.
  prisma
    .$queryRaw`SELECT 1`
    .then(() => console.info('[server] banco de dados: conectado'))
    .catch((erro: unknown) => {
      const codigo = (erro as { errorCode?: string }).errorCode;
      console.error(
        `[server] ATENCAO: banco inacessivel${codigo ? ` (${codigo})` : ''}. ` +
          'O servidor esta no ar, mas as rotas que usam o banco vao responder 503.',
      );
      console.error(
        '[server] Como resolver: suba o Postgres com "docker compose up -d" ' +
          '(pasta backend) ou ajuste DATABASE_URL no arquivo .env.',
      );
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
  process.on('unhandledRejection', (motivo) => console.error('[server] unhandledRejection', motivo));
  process.on('uncaughtException', (erro) => {
    console.error('[server] uncaughtException', erro);
    void shutdown('uncaughtException');
  });
}

bootstrap().catch((erro) => {
  console.error('[server] falha ao iniciar', erro);
  process.exit(1);
});
