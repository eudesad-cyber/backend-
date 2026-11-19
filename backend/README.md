# Backend Tasks API

API REST de tarefas construída com **Node.js + TypeScript + Express + Prisma + PostgreSQL**,
cobrindo as principais responsabilidades de um(a) desenvolvedor(a) back-end:

| Responsabilidade | Como aparece neste projeto |
| --- | --- |
| **APIs e integrações** | Endpoints REST versionados (`/api/v1`), contrato documentado em OpenAPI 3 (Swagger), respostas e erros padronizados |
| **Bancos de dados** | Modelagem relacional no Prisma (PostgreSQL), migrations versionadas, índices compostos, paginação no banco e agregações via `groupBy` |
| **Regras de negócio e segurança** | Senhas com bcrypt, JWT de acesso curto + refresh token rotativo/revogável, RBAC (`USER`/`ADMIN`), isolamento de dados por dono (anti-IDOR), Helmet, CORS, rate limit, validação com Zod, soft delete |
| **Performance, testes e deploy** | Índices, `select` explícito, transações curtas, Jest (30 testes), Docker Compose para o banco, graceful shutdown, build de produção |

---

## 1. Stack

- **Runtime:** Node.js ≥ 18.18 (testado com Node 26)
- **Linguagem:** TypeScript (strict)
- **Framework:** Express 4
- **ORM / Banco:** Prisma 5 + PostgreSQL 16
- **Autenticação:** jsonwebtoken (HS256) + bcryptjs + refresh tokens
- **Validação:** Zod (schemas em `src/schemas`)
- **Docs:** swagger-ui-express (OpenAPI 3.0.3)
- **Testes:** Jest + ts-jest + supertest

---

## 2. Estrutura do projeto

```
backend-tasks-api/
├── prisma/
│   ├── schema.prisma            # Modelagem do banco e índices
│   ├── seed.ts                  # Dados de exemplo (ADMIN + USER)
│   └── migrations/
│       ├── migration_lock.toml
│       └── 20240101000000_init/migration.sql   # Migration inicial
├── src/
│   ├── config/
│   │   ├── env.ts               # Variáveis de ambiente (validadas com Zod)
│   │   ├── prisma.ts            # Singleton do PrismaClient
│   │   └── swagger.ts           # Especificação OpenAPI / Swagger
│   ├── controllers/
│   │   ├── auth.controller.ts   # Registro, login, refresh, logout, perfil
│   │   └── task.controller.ts   # CRUD de tarefas
│   ├── middlewares/
│   │   ├── auth.middleware.ts   # Autenticação JWT e autorização (roles)
│   │   ├── error.middleware.ts  # Tratamento centralizado de erros e HTTP status
│   │   ├── rateLimit.middleware.ts
│   │   └── validate.middleware.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   └── task.routes.ts
│   ├── schemas/
│   │   ├── auth.schema.ts       # Validação de entrada (Zod)
│   │   └── task.schema.ts
│   ├── services/
│   │   ├── auth.service.ts      # Regras de negócio de autenticação
│   │   ├── task.service.ts      # Regras de negócio e consultas otimizadas
│   │   └── token.service.ts     # Assinatura/verificação de JWT e refresh tokens
│   ├── errors/AppError.ts       # Erro de aplicação com status HTTP
│   ├── utils/asyncHandler.ts    # Wrapper para controllers assíncronos
│   ├── tests/
│   │   ├── auth.service.spec.ts
│   │   ├── task.service.spec.ts # Testes unitários (Jest)
│   │   └── app.http.spec.ts     # Testes de rota/middlewares (supertest)
│   ├── app.ts                   # Instância do Express e middlewares globais
│   └── server.ts                # Inicialização do servidor HTTP
├── .env.example
├── .gitignore
├── docker-compose.yml           # PostgreSQL local
├── jest.config.js
├── package.json
├── tsconfig.json
└── README.md
```

Arquitetura em camadas (**Routes → Middlewares → Controllers → Services → Prisma**):
controllers só lidam com HTTP, services concentram regra de negócio e não conhecem `req`/`res`.
Isso é o que torna os services testáveis sem subir servidor.

---

## 3. Passo a passo (setup completo)

### Pré-requisitos

- Node.js 18.18+ e npm
- PostgreSQL 14+ **ou** Docker (para subir o banco com um comando)

### 3.1 Instalar dependências

```bash
cd backend-tasks-api
npm install
```

> O `postinstall` do Prisma gera o client. Se o seu npm bloqueia scripts, rode
> `npm install-scripts approve @prisma/client prisma @prisma/engines esbuild` ou
> simplesmente `npx prisma generate`.

### 3.2 Configurar variáveis de ambiente

```bash
cp .env.example .env
```

Gere um `JWT_SECRET` forte e cole no `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

`DATABASE_URL` padrão (compatível com o `docker-compose.yml`):

```
postgresql://postgres:postgres@localhost:5432/tasksdb?schema=public
```

### 3.3 Subir o banco

**Opção A — Docker (recomendado):**

```bash
docker compose up -d
docker compose ps        # espere o healthcheck ficar "healthy"
```

**Opção B — PostgreSQL já instalado:**

```bash
psql -U postgres -c "CREATE DATABASE tasksdb;"
```

**Opção C — sem instalar nada:** crie um banco gratuito no Neon/Supabase e use a
connection string deles (com `?sslmode=require` se necessário).

### 3.4 Aplicar as migrations

```bash
npm run prisma:generate      # gera o Prisma Client
npm run prisma:migrate       # aplica/cria migrations em desenvolvimento
# em produção/CI (não interativo):
npm run prisma:deploy
```

A migration inicial já vem versionada em `prisma/migrations/20240101000000_init`.
Para inspecionar as tabelas: `npm run prisma:studio`.

### 3.5 Popular dados de exemplo (opcional)

```bash
npm run db:seed
```

Cria:

| Perfil | E-mail | Senha |
| --- | --- | --- |
| ADMIN | `admin@example.com` | `Admin@12345` |
| USER | `user@example.com` | `User@12345` |

### 3.6 Rodar a API

```bash
npm run dev
```

- API: <http://localhost:3000>
- Swagger UI: <http://localhost:3000/docs>
- OpenAPI JSON: <http://localhost:3000/docs.json>
- Health check: <http://localhost:3000/health>

### 3.7 Validar que está tudo correto

```bash
npm run typecheck    # TypeScript sem erros
npm test             # 30 testes passando
npm run build        # compila para dist/
npm start            # roda o build de produção
```

### 3.8 Teste rápido com curl

```bash
# 1) registrar (ou usar o seed)
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Maria Silva","email":"maria@example.com","password":"Senha1234"}'

# 2) login -> copie o accessToken
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"User@12345"}'

# 3) criar tarefa
TOKEN="cole-o-access-token-aqui"
curl -s -X POST http://localhost:3000/api/v1/tasks \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Revisar indices do banco","priority":"HIGH"}'

# 4) listar com filtros e paginação
curl -s "http://localhost:3000/api/v1/tasks?page=1&limit=10&status=PENDING,IN_PROGRESS&search=banco" \
  -H "Authorization: Bearer $TOKEN"

# 5) atualizar / remover / restaurar / estatísticas
curl -s -X PATCH http://localhost:3000/api/v1/tasks/<ID> \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"status":"DONE"}'
curl -s -X DELETE http://localhost:3000/api/v1/tasks/<ID> -H "Authorization: Bearer $TOKEN" -i
curl -s -X POST http://localhost:3000/api/v1/tasks/<ID>/restore -H "Authorization: Bearer $TOKEN"
curl -s http://localhost:3000/api/v1/tasks/stats -H "Authorization: Bearer $TOKEN"
```

---

## 4. Endpoints

Base: `/api/v1` — contrato completo e testável em **`/docs`**.

### Auth

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| POST | `/auth/register` | público | Cria conta (role `USER`) e devolve tokens |
| POST | `/auth/login` | público | Autentica (rate limit 20/15min por IP) |
| POST | `/auth/refresh` | público | Rotaciona o refresh token |
| POST | `/auth/logout` | público | Revoga o refresh token |
| GET | `/auth/me` | autenticado | Perfil do usuário |

### Usuários (RBAC)

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/users` | ADMIN | Lista usuários |
| PATCH | `/users/:id/role` | ADMIN | Promove/rebaixa (`USER`/`ADMIN`) |

### Tarefas

| Método | Rota | Acesso | Descrição |
| --- | --- | --- | --- |
| GET | `/tasks` | autenticado | Lista paginada + filtros (`page`, `limit`, `status`, `priority`, `search`, `sortBy`, `order`) |
| POST | `/tasks` | autenticado | Cria tarefa |
| GET | `/tasks/stats` | autenticado | Totais por status + atrasadas |
| GET | `/tasks/:id` | dono ou ADMIN | Busca por id |
| PATCH | `/tasks/:id` | dono ou ADMIN | Atualização parcial |
| DELETE | `/tasks/:id` | dono ou ADMIN | Soft delete (204) |
| POST | `/tasks/:id/restore` | dono ou ADMIN | Restaura tarefa removida |

**Regra de visibilidade:** `USER` só enxerga/altera as próprias tarefas; `ADMIN` enxerga todas.

### Formato das respostas

```jsonc
// sucesso
{ "success": true, "data": { /* ... */ } }

// sucesso paginado
{ "success": true, "data": [ /* ... */ ], "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5, "hasNextPage": true, "hasPrevPage": false } }

// erro
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Tarefa nao encontrada" } }

// erro de validação (422)
{ "success": false, "error": { "code": "UNPROCESSABLE_ENTITY", "message": "Dados invalidos",
  "details": [ { "field": "title", "message": "Titulo muito curto", "code": "too_small" } ] } }
```

### Status HTTP usados

`200` ok · `201` criado · `204` sem conteúdo · `400` JSON malformado · `401` sem token/token inválido ·
`403` sem permissão · `404` inexistente · `409` duplicidade (email) · `413` payload grande ·
`422` validação · `429` rate limit · `500` erro interno.

---

## 5. Modelagem do banco

```
users (1) ──< tasks            (FK ownerId, ON DELETE CASCADE)
users (1) ──< refresh_tokens   (FK userId,  ON DELETE CASCADE)
```

- **`users`**: `id` (uuid), `name`, `email` (unique), `passwordHash` (bcrypt), `role` (`USER`/`ADMIN`), `isActive`, timestamps.
- **`tasks`**: `id` (uuid), `title`, `description`, `status` (`PENDING`/`IN_PROGRESS`/`DONE`), `priority` (`LOW`/`MEDIUM`/`HIGH`), `dueDate`, `ownerId`, `deletedAt` (soft delete), timestamps.
- **`refresh_tokens`**: apenas o **hash sha256** do token, `expiresAt`, `revokedAt`, `userAgent`, `ip`.

### Por que esses índices

| Índice | Cobre |
| --- | --- |
| `tasks(ownerId, status, createdAt)` | listagem filtrada por status + ordenação, sem sort em memória |
| `tasks(ownerId, createdAt)` | listagem padrão (mais recentes primeiro) |
| `refresh_tokens(tokenHash)` (unique) | lookup O(1) no refresh |
| `refresh_tokens(expiresAt)` | limpeza de tokens expirados |

Consultas eficientes: `select` explícito (sem `SELECT *`), `skip/take` no banco,
`count` em paralelo via `$transaction`, agregação com `groupBy` (não em JS) e
`updateMany` com filtro de dono (1 query, sem read-modify-write).

---

## 6. Segurança — decisões e o porquê

1. **Senhas:** bcrypt com custo configurável (`BCRYPT_SALT_ROUNDS`, 10 por padrão). Nunca retornadas pela API.
2. **Access token curto (1h)** + **refresh token opaco (7 dias)** rotativo: se um refresh for reutilizado, é rejeitado.
3. **RBAC:** `authorize('ADMIN')` nos endpoints administrativos. O `role` **não** é aceito no registro (evita elevação de privilégio).
4. **Anti-IDOR:** toda query de tarefa inclui `ownerId` (ou escopo ADMIN).
5. **Anti-enumeração:** login errado e email inexistente retornam a mesma mensagem/status; o hash é comparado mesmo sem usuário.
6. **Rate limit** global e mais rígido em `/auth/login` e `/auth/register`.
7. **Helmet + CORS restringível** (`CORS_ORIGIN`), body limit de 100kb.
8. **Config validada no boot:** a aplicação não sobe com `JWT_SECRET` fraco ou `DATABASE_URL` ausente.
9. **Erros não vazam internals:** stack só fora de produção; em 500 o cliente recebe mensagem genérica.

### Checklist antes de ir para produção

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` com ≥ 32 bytes aleatórios (idealmente em secret manager)
- [ ] `CORS_ORIGIN` com o domínio do front-end (nunca `*`)
- [ ] HTTPS no proxy/ingress e `trust proxy` ajustado
- [ ] `npm run prisma:deploy` no pipeline (nunca `migrate dev` em prod)
- [ ] Backups do banco e logs estruturados

---

## 7. Testes

```bash
npm test              # roda a suíte
npm run test:watch    # modo watch
npm run test:cov      # com cobertura
```

Cobertura atual (30 testes, sem banco — Prisma mockado):

- `task.service.spec.ts` — criação com defaults, filtro por dono, escopo ADMIN, filtros/busca, paginação, 404, update parcial, soft delete, restore, stats.
- `auth.service.spec.ts` — hash de senha, email duplicado (409), login ok/senha errada/email inexistente/conta desativada, rotação e revogação de refresh token.
- `app.http.spec.ts` — `/health`, `/docs.json`, 404 padronizado, 422 de validação, 401 sem token, login 200, isolamento de rota.

---

## 8. Deploy

**Build e execução:**

```bash
npm ci
npm run build
npm run prisma:deploy
NODE_ENV=production node dist/src/server.js
```

- **Render / Railway / Fly.io:** build `npm ci && npm run build`, start `node dist/src/server.js`, variáveis do `.env.example`, e `prisma migrate deploy` como pre-deploy/release command.
- **Docker (exemplo de Dockerfile):**

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package*.json ./
EXPOSE 3000
CMD ["node", "dist/src/server.js"]
```

- **CI (GitHub Actions), esboço:** `npm ci` → `npm run typecheck` → `npm test` → `npm run build` → `prisma migrate deploy` no ambiente de staging → deploy.

---

## 9. Roteiro de trabalho (Trello / Jira) e Git

Sugestão de quebra em tarefas pequenas (cada uma cabe em 1 PR):

1. Setup do projeto (TypeScript, ESLint, Jest, estrutura de pastas)
2. Modelagem Prisma + migration inicial
3. Config de ambiente validada + app/server + health check
4. Autenticação: registro/login + hash de senha
5. Middlewares de autenticação e autorização (RBAC)
6. CRUD de tarefas (service + controller + rotas + validação)
7. Paginação, filtros e índices
8. Refresh token rotativo + logout
9. Tratamento centralizado de erros
10. Swagger + README
11. Testes unitários e de rota
12. Docker Compose + pipeline de CI + deploy

Convenção de branches/commits:

```bash
git init
git add .
git commit -m "chore: setup do projeto"

git checkout -b feat/auth-jwt          # feat | fix | docs | test | refactor | chore
# ... commits pequenos e descritivos ...
git push -u origin feat/auth-jwt       # abra PR, peça code review, faça squash merge
```

Checklist de code review: cobertura de testes do que mudou, nenhum `any` novo,
nenhum segredo no código, respostas HTTP corretas, migrations reversíveis.

---

## 10. Critérios de aprovação — como este projeto atende

| Critério | Evidência |
| --- | --- |
| **Completeness** | CRUD completo, autenticação/autorização, refresh/logout, validação, erros HTTP corretos, Swagger, README |
| **Code Quality** | TypeScript strict, camadas separadas, services sem dependência de HTTP, comentários explicando decisões, `asyncHandler`, sem `any` |
| **Database Design** | 3 tabelas normalizadas, FKs com `onDelete: Cascade`, índices compostos justificados, migration versionada, soft delete |

---

## 11. Troubleshooting

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| `[env] Configuracao invalida` ao iniciar | `.env` ausente ou `JWT_SECRET` < 32 chars | `cp .env.example .env` e gere o segredo |
| `Can't reach database server` | Postgres não subiu / URL errada | `docker compose up -d` e confira `DATABASE_URL` |
| `P1001` / `too many clients` | hot-reload abrindo pools | já tratado pelo singleton em `config/prisma.ts` |
| `PrismaClientInitializationError` | client não gerado | `npx prisma generate` |
| `401` com token recém-gerado | token expirado (1h) | use `/auth/refresh` |
| `429` no login | rate limit (20 tentativas/15min) | aguarde a janela ou ajuste em dev |

---

Licença: MIT.
