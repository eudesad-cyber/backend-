# Back-end Tasks API — tarefas de desenvolvimento

Quadro pronto para importar no Trello/Jira. Cada item = uma branch = um PR pequeno.
Legenda de estimativa: **P** (pequeno, ≤ 1 dia), **M** (médio, 1–2 dias), **G** (grande, 3+ dias).

## Épico 1 — Fundação do projeto

| # | Tarefa | Est. | Critério de pronto (DoD) |
| --- | --- | --- | --- |
| 1.1 | Estrutura de pastas + `package.json` + `tsconfig` strict | P | `npm run typecheck` sem erros |
| 1.2 | Config de ambiente validada (`src/config/env.ts`) | P | API não sobe com `.env` inválido |
| 1.3 | `app.ts` + `server.ts` + `/health` | P | `GET /health` → 200; graceful shutdown |
| 1.4 | Jest + ts-jest configurados | P | `npm test` roda (mesmo sem testes) |

## Épico 2 — Banco de dados

| # | Tarefa | Est. | DoD |
| --- | --- | --- | --- |
| 2.1 | Modelagem `User`, `Task`, `RefreshToken` no `schema.prisma` | M | `prisma validate` ok |
| 2.2 | Migration inicial versionada | P | `prisma migrate deploy` aplica do zero |
| 2.3 | Índices compostos e justificativa documentada | P | `tasks(ownerId, status, createdAt)` criado |
| 2.4 | Seed de desenvolvimento (ADMIN + USER + tarefas) | P | `npm run db:seed` idempotente |
| 2.5 | Docker Compose do PostgreSQL | P | `docker compose up -d` → healthy |

## Épico 3 — Autenticação e autorização

| # | Tarefa | Est. | DoD |
| --- | --- | --- | --- |
| 3.1 | Registro com hash bcrypt | M | Senha nunca persistida em texto; 409 em email duplicado |
| 3.2 | Login + emissão de access token (JWT HS256) | M | 401 sem revelar se o email existe |
| 3.3 | Middleware `authenticate` | P | 401 sem/expirado/inválido |
| 3.4 | Middleware `authorize(...roles)` (RBAC) | P | `USER` em rota ADMIN → 403 |
| 3.5 | Refresh token opaco, hasheado, rotativo | G | Reuso de token revogado → 401 |
| 3.6 | Logout (revogação) | P | `204` e token inutilizável |
| 3.7 | Rate limit em login/registro | P | 21ª tentativa → 429 |

## Épico 4 — CRUD de tarefas

| # | Tarefa | Est. | DoD |
| --- | --- | --- | --- |
| 4.1 | `TaskService.create` + validação Zod | M | Defaults aplicados; 422 em payload inválido |
| 4.2 | `TaskService.list` com paginação e filtros | M | `meta` correto; ADMIN vê tudo, USER só o próprio |
| 4.3 | `findById` / `update` (parcial) / `remove` (soft delete) | M | 404 quando de outro dono (anti-IDOR) |
| 4.4 | `restore` de tarefa removida | P | Volta a aparecer na listagem |
| 4.5 | `stats` (groupBy + atrasadas) | P | Agregação no banco |
| 4.6 | Rotas + validação de params/query | P | `:id` inválido → 422 |

## Épico 5 — Qualidade e documentação

| # | Tarefa | Est. | DoD |
| --- | --- | --- | --- |
| 5.1 | Error middleware centralizado (Prisma/Zod/HTTP) | M | Cada família de erro → status correto |
| 5.2 | Testes unitários do `TaskService` | M | ≥ 90% dos caminhos do service |
| 5.3 | Testes do `AuthService` | M | Inclui casos de segurança (enumeração, revogação) |
| 5.4 | Testes HTTP com supertest | M | Health, 404, 401, 422, login |
| 5.5 | Swagger / OpenAPI 3 em `/docs` | M | Todos os endpoints documentados |
| 5.6 | README com setup passo a passo | P | Um novo dev sobe do zero seguindo só o README |

## Épico 6 — Deploy e operação

| # | Tarefa | Est. | DoD |
| --- | --- | --- | --- |
| 6.1 | Build de produção + `npm start` | P | `dist/` roda |
| 6.2 | Dockerfile multi-stage | M | Imagem < 300MB e sobe |
| 6.3 | Pipeline CI (typecheck → test → build) | M | PR vermelho se falhar |
| 6.4 | `prisma migrate deploy` no ambiente | P | Release command configurado |
| 6.5 | Checklist de segurança de produção | P | Itens do README §6 marcados |

## Definition of Done (padrão do projeto)

- Código com TypeScript strict, sem `any` novo
- Testes do que mudou passando (`npm test`)
- Respostas HTTP e formato de erro conforme o contrato
- Swagger atualizado quando o contrato muda
- PR pequeno, com descrição do "porquê", revisado por outra pessoa
- Nenhum segredo commitado (`.env` no `.gitignore`)
