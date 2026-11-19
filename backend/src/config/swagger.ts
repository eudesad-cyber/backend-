/**
 * Especificacao OpenAPI 3.0 da API.
 *
 * Servida em /docs (Swagger UI) e em /docs.json (JSON puro, para importar em
 * Insomnia/Postman ou gerar clients).
 */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Backend Tasks API',
    version: '1.0.0',
    description: [
      'API REST de tarefas com autenticacao JWT, autorizacao por roles (USER/ADMIN),',
      'validacao com Zod, Prisma + PostgreSQL e tratamento centralizado de erros.',
      '',
      '**Como testar:** chame `POST /api/v1/auth/login` (ou `/register`), copie o',
      '`accessToken` e clique em **Authorize**, colando o valor. O prefixo `Bearer` e',
      'adicionado automaticamente.',
    ].join('\n'),
    license: { name: 'MIT' },
  },
  servers: [{ url: '/api/v1', description: 'API v1' }],
  tags: [
    { name: 'Auth', description: 'Registro, login, refresh e logout' },
    { name: 'Users', description: 'Gestao de usuarios (ADMIN)' },
    { name: 'Tasks', description: 'CRUD de tarefas do usuario autenticado' },
    { name: 'Health', description: 'Disponibilidade' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'NOT_FOUND' },
              message: { type: 'string', example: 'Tarefa nao encontrada' },
              details: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          name: { type: 'string', example: 'Usuario Demo' },
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          role: { type: 'string', enum: ['USER', 'ADMIN'] },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AuthResult: {
        type: 'object',
        properties: {
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
          expiresIn: { type: 'string', example: '1h' },
          user: { $ref: '#/components/schemas/User' },
        },
      },
      RegisterRequest: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 120, example: 'Maria Silva' },
          email: { type: 'string', format: 'email', example: 'maria@example.com' },
          password: {
            type: 'string',
            minLength: 8,
            example: 'Senha1234',
            description: 'Min. 8 caracteres, ao menos 1 letra e 1 numero.',
          },
        },
      },
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'user@example.com' },
          password: { type: 'string', example: 'User@12345' },
        },
      },
      RefreshRequest: {
        type: 'object',
        required: ['refreshToken'],
        properties: { refreshToken: { type: 'string' } },
      },
      Task: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          title: { type: 'string', example: 'Escrever testes do service' },
          description: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'DONE'] },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          dueDate: { type: 'string', format: 'date-time', nullable: true },
          ownerId: { type: 'string', format: 'uuid' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      TaskInput: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', minLength: 3, maxLength: 160, example: 'Revisar PR #42' },
          description: { type: 'string', nullable: true, example: 'Focar em SQL e indices.' },
          status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'DONE'] },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          dueDate: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      TaskUpdateInput: {
        type: 'object',
        description: 'Pelo menos um campo deve ser enviado.',
        properties: {
          title: { type: 'string', minLength: 3, maxLength: 160 },
          description: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['PENDING', 'IN_PROGRESS', 'DONE'] },
          priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'] },
          dueDate: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      PaginationMeta: {
        type: 'object',
        properties: {
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 10 },
          total: { type: 'integer', example: 42 },
          totalPages: { type: 'integer', example: 5 },
          hasNextPage: { type: 'boolean' },
          hasPrevPage: { type: 'boolean' },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: 'Token ausente, invalido ou expirado',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Forbidden: {
        description: 'Sem permissao para a acao',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      NotFound: {
        description: 'Recurso nao encontrado',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
      Unprocessable: {
        description: 'Dados invalidos (validacao)',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        security: [],
        responses: { '200': { description: 'API no ar' } },
      },
    },
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Cria uma conta',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RegisterRequest' } },
          },
        },
        responses: {
          '201': {
            description: 'Conta criada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/AuthResult' } },
                },
              },
            },
          },
          '409': { description: 'Email ja cadastrado' },
          '422': { $ref: '#/components/responses/Unprocessable' },
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Autentica e obtem tokens',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          '200': {
            description: 'Autenticado',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/AuthResult' } },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '429': { description: 'Muitas tentativas' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotaciona o refresh token',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshRequest' } } },
        },
        responses: {
          '200': { description: 'Novo par de tokens' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Revoga o refresh token',
        security: [],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/RefreshRequest' } } },
        },
        responses: { '204': { description: 'Sessao encerrada' } },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Perfil do usuario autenticado',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Perfil' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/users': {
      get: {
        tags: ['Users'],
        summary: 'Lista usuarios (ADMIN)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Lista de usuarios' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/users/{id}/role': {
      patch: {
        tags: ['Users'],
        summary: 'Altera o papel do usuario (ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['role'],
                properties: { role: { type: 'string', enum: ['USER', 'ADMIN'] } },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Papel atualizado' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/tasks': {
      get: {
        tags: ['Tasks'],
        summary: 'Lista tarefas (paginado)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } },
          {
            name: 'status',
            in: 'query',
            description: 'Um ou mais status separados por virgula',
            schema: { type: 'string', example: 'PENDING,IN_PROGRESS' },
          },
          {
            name: 'priority',
            in: 'query',
            description: 'Uma ou mais prioridades separadas por virgula',
            schema: { type: 'string', example: 'HIGH' },
          },
          { name: 'search', in: 'query', schema: { type: 'string' }, description: 'Busca em titulo/descricao' },
          {
            name: 'sortBy',
            in: 'query',
            schema: { type: 'string', enum: ['createdAt', 'updatedAt', 'dueDate', 'priority', 'title'], default: 'createdAt' },
          },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
        ],
        responses: {
          '200': {
            description: 'Pagina de tarefas',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
                    meta: { $ref: '#/components/schemas/PaginationMeta' },
                  },
                },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '422': { $ref: '#/components/responses/Unprocessable' },
        },
      },
      post: {
        tags: ['Tasks'],
        summary: 'Cria uma tarefa',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskInput' } } },
        },
        responses: {
          '201': { description: 'Criada' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '422': { $ref: '#/components/responses/Unprocessable' },
        },
      },
    },
    '/tasks/stats': {
      get: {
        tags: ['Tasks'],
        summary: 'Estatisticas de tarefas',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Totais por status e atrasadas' } },
      },
    },
    '/tasks/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      get: {
        tags: ['Tasks'],
        summary: 'Busca tarefa por id',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Tarefa' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      patch: {
        tags: ['Tasks'],
        summary: 'Atualiza parcialmente',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/TaskUpdateInput' } } },
        },
        responses: {
          '200': { description: 'Atualizada' },
          '404': { $ref: '#/components/responses/NotFound' },
          '422': { $ref: '#/components/responses/Unprocessable' },
        },
      },
      delete: {
        tags: ['Tasks'],
        summary: 'Remove (soft delete)',
        security: [{ bearerAuth: [] }],
        responses: {
          '204': { description: 'Removida' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/tasks/{id}/restore': {
      post: {
        tags: ['Tasks'],
        summary: 'Restaura tarefa removida',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Restaurada' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
  },
} as const;

export default openApiSpec;
