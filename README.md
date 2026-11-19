# Projeto Digital College — Backend (API de tarefas)

Express + TypeScript + Prisma + PostgreSQL, com autenticacao JWT, autorizacao por roles, Swagger e testes.
O codigo da API fica em `backend/`; os comandos abaixo rodam a partir desta raiz.

---

## Como rodar (a partir da raiz do repositorio)

O projeto tem duas camadas: a **raiz** (orquestracao) e a pasta **backend/** (a API).
Sempre rode os comandos **na raiz**, onde esta o `package.json` com os scripts:

```bash
# 1) instalar dependencias (a raiz chama a instalacao do backend)
npm install

# 2) subir o Postgres
npm run db:up            # docker compose, usa backend/docker-compose.yml

# 3) criar o .env do backend
cp backend/.env.example backend/.env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # cole em JWT_SECRET

# 4) gerar client, aplicar migrations e popular dados
npm run setup

# 5) rodar a API em modo desenvolvimento
npm run dev              # http://localhost:3000  |  Swagger: /docs/
```

| Comando (na raiz) | O que faz |
| --- | --- |
| `npm run dev` | `tsx watch` no `backend/src/server.ts` |
| `npm run build` / `npm start` | compila com `tsc` e roda o `dist` |
| `npm test` | Jest (34 testes) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:up` / `npm run db:down` | sobe/derruba o Postgres do `docker-compose.yml` |
| `npm run setup` | `prisma generate` + `migrate` + `seed` |

> **Por que a raiz precisa de scripts:** rodar `npm run dev` na raiz de um projeto sem
> `scripts` no `package.json` gera `npm error Missing script: "dev"` — o npm nao "entra" na
> pasta `backend/` sozinho. Os scripts acima usam `npm --prefix backend`, que executa o
> comando dentro do backend sem voce precisar trocar de pasta.

> **Banco fora do ar:** se o Postgres nao estiver rodando, a API **continua no ar** e responde
> `503 DATABASE_UNAVAILABLE` nas rotas que usam o banco; `/health` e `/docs/` seguem
> funcionando. O log mostra a instrucao (`docker compose up -d`).

> **Entrypoint:** o arquivo que sobe a API e `backend/src/server.ts`. Um `server.js` solto na
> raiz ou no backend nao e usado por nada (e ja foi removido deste repositorio).
