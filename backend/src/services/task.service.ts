/**
 * Regras de negocio e consultas de tarefas.
 *
 * Decisoes de performance e seguranca:
 *  - Todo filtro inclui `ownerId` (a menos que o solicitante seja ADMIN), entao um
 *    usuario nunca le nem altera tarefa de outro (evita IDOR).
 *  - Listagem usa `Promise.all([findMany, count])` dentro de uma transacao curta
 *    (consistencia entre pagina e total) com `skip/take` e indices compostos.
 *  - `select` explicito: nao trafega colunas desnecessarias.
 *  - Soft delete (`deletedAt`): o dado permanece para auditoria.
 *  - Updates usam `updateMany` com filtro de dono: 1 query, sem read-modify-write.
 */
import type { Prisma, PrismaClient, Role } from '@prisma/client';
import { prisma as defaultPrisma } from '../config/prisma';
import { AppError } from '../errors/AppError';
import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from '../schemas/task.schema';

export interface RequestingUser {
  id: string;
  role: Role;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export const taskSelect = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  dueDate: true,
  ownerId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type TaskPublic = Prisma.TaskGetPayload<{ select: typeof taskSelect }>;

export class TaskService {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  /** Cria uma tarefa para o usuario autenticado. */
  async create(ownerId: string, input: CreateTaskInput): Promise<TaskPublic> {
    return this.db.task.create({
      data: {
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? 'PENDING',
        priority: input.priority ?? 'MEDIUM',
        dueDate: input.dueDate ?? null,
        ownerId,
      },
      select: taskSelect,
    });
  }

  /** Lista paginada com filtros. ADMIN ve todas; USER ve apenas as proprias. */
  async list(user: RequestingUser, query: ListTasksQuery): Promise<Paginated<TaskPublic>> {
    const where: Prisma.TaskWhereInput = {
      deletedAt: null,
      ...(user.role === 'ADMIN' ? {} : { ownerId: user.id }),
      ...(query.status ? { status: { in: query.status } } : {}),
      ...(query.priority ? { priority: { in: query.priority } } : {}),
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const skip = (query.page - 1) * query.limit;
    const orderBy = { [query.sortBy]: query.order } as Prisma.TaskOrderByWithRelationInput;

    const [data, total] = await this.db.$transaction([
      this.db.task.findMany({
        where,
        select: taskSelect,
        orderBy: [orderBy, { id: 'asc' }], // desempate estavel para paginacao
        skip,
        take: query.limit,
      }),
      this.db.task.count({ where }),
    ]);

    const totalPages = Math.ceil(total / query.limit) || 1;

    return {
      data,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages,
        hasNextPage: query.page < totalPages,
        hasPrevPage: query.page > 1,
      },
    };
  }

  /** Busca por id respeitando o dono (ADMIN acessa qualquer tarefa). */
  async findById(user: RequestingUser, id: string): Promise<TaskPublic> {
    const task = await this.db.task.findFirst({
      where: { id, deletedAt: null, ...this.scope(user) },
      select: taskSelect,
    });
    if (!task) throw AppError.notFound('Tarefa nao encontrada');
    return task;
  }

  /** Atualiza apenas campos enviados, sem sobrescrever o resto. */
  async update(user: RequestingUser, id: string, input: UpdateTaskInput): Promise<TaskPublic> {
    const data: Prisma.TaskUpdateManyMutationInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.status !== undefined) data.status = input.status;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.dueDate !== undefined) data.dueDate = input.dueDate;

    const { count } = await this.db.task.updateMany({
      where: { id, deletedAt: null, ...this.scope(user) },
      data,
    });

    if (count === 0) throw AppError.notFound('Tarefa nao encontrada');
    return this.findById(user, id);
  }

  /** Soft delete: marca deletedAt (idempotente do ponto de vista do cliente). */
  async remove(user: RequestingUser, id: string): Promise<void> {
    const { count } = await this.db.task.updateMany({
      where: { id, deletedAt: null, ...this.scope(user) },
      data: { deletedAt: new Date() },
    });
    if (count === 0) throw AppError.notFound('Tarefa nao encontrada');
  }

  /** Restaura uma tarefa removida (soft delete) — ADMIN ou dono. */
  async restore(user: RequestingUser, id: string): Promise<TaskPublic> {
    const { count } = await this.db.task.updateMany({
      where: { id, deletedAt: { not: null }, ...this.scope(user) },
      data: { deletedAt: null },
    });
    if (count === 0) throw AppError.notFound('Tarefa removida nao encontrada');
    return this.findById(user, id);
  }

  /** Estatisticas agregadas (dashboard). Agregacao feita no banco, nao em JS. */
  async stats(user: RequestingUser) {
    const grouped = await this.db.task.groupBy({
      by: ['status'],
      where: { deletedAt: null, ...this.scope(user) },
      _count: { _all: true },
    });

    const total = grouped.reduce((sum, row) => sum + row._count._all, 0);
    const byStatus = { PENDING: 0, IN_PROGRESS: 0, DONE: 0 } as Record<string, number>;
    for (const row of grouped) byStatus[row.status] = row._count._all;

    const overdue = await this.db.task.count({
      where: {
        deletedAt: null,
        status: { not: 'DONE' },
        dueDate: { lt: new Date() },
        ...this.scope(user),
      },
    });

    return { total, byStatus, overdue };
  }

  private scope(user: RequestingUser): Prisma.TaskWhereInput {
    return user.role === 'ADMIN' ? {} : { ownerId: user.id };
  }
}

export const taskService = new TaskService();
