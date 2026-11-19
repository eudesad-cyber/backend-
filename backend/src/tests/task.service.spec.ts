/**
 * Testes unitarios do TaskService.
 *
 * Estrategia: o PrismaClient e substituido por um mock tipado — nenhum banco e
 * tocado, os testes rodam em milissegundos e sao deterministas. O foco esta nas
 * REGRAS DE NEGOCIO (isolamento por dono, soft delete, paginacao, 404), nao nos
 * detalhes de implementacao do ORM.
 */
import type { PrismaClient } from '@prisma/client';
import { TaskService } from '../services/task.service';
import { AppError } from '../errors/AppError';
import type { ListTasksQuery } from '../schemas/task.schema';

type Mocked<T> = { [K in keyof T]: jest.Mock };

function buildPrismaMock() {
  return {
    task: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn(),
    },
    $transaction: jest.fn(),
  };
}

const baseTask = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Tarefa de teste',
  description: null,
  status: 'PENDING' as const,
  priority: 'MEDIUM' as const,
  dueDate: null,
  ownerId: '22222222-2222-4222-8222-222222222222',
  createdAt: new Date('2024-01-01T10:00:00.000Z'),
  updatedAt: new Date('2024-01-01T10:00:00.000Z'),
};

const owner = { id: baseTask.ownerId, role: 'USER' as const };
const admin = { id: '33333333-3333-4333-8333-333333333333', role: 'ADMIN' as const };

const defaultQuery: ListTasksQuery = {
  page: 1,
  limit: 10,
  sortBy: 'createdAt',
  order: 'desc',
};

describe('TaskService', () => {
  let prisma: ReturnType<typeof buildPrismaMock>;
  let service: TaskService;

  beforeEach(() => {
    prisma = buildPrismaMock();
    service = new TaskService(prisma as unknown as PrismaClient);
  });

  describe('create', () => {
    it('cria a tarefa vinculada ao usuario autenticado e aplica defaults', async () => {
      prisma.task.create.mockResolvedValue(baseTask);

      const result = await service.create(owner.id, { title: 'Tarefa de teste' });

      expect(prisma.task.create).toHaveBeenCalledWith({
        data: {
          title: 'Tarefa de teste',
          description: null,
          status: 'PENDING',
          priority: 'MEDIUM',
          dueDate: null,
          ownerId: owner.id,
        },
        select: expect.any(Object),
      });
      expect(result).toEqual(baseTask);
    });

    it('respeita status, prioridade e dueDate enviados', async () => {
      prisma.task.create.mockResolvedValue(baseTask);
      const dueDate = new Date('2024-02-01T12:00:00.000Z');

      await service.create(owner.id, {
        title: 'Com prazo',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        dueDate,
      });

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'IN_PROGRESS',
            priority: 'HIGH',
            dueDate,
          }),
        }),
      );
    });
  });

  describe('list', () => {
    beforeEach(() => {
      prisma.$transaction.mockResolvedValue([[baseTask], 1]);
    });

    it('filtra por dono, ignora removidas e calcula o meta de paginacao', async () => {
      const result = await service.list(owner, defaultQuery);

      const [findManyArgs] = prisma.task.findMany.mock.calls[0];
      expect(findManyArgs.where).toEqual({ deletedAt: null, ownerId: owner.id });
      expect(findManyArgs.skip).toBe(0);
      expect(findManyArgs.take).toBe(10);
      expect(findManyArgs.orderBy).toEqual([{ createdAt: 'desc' }, { id: 'asc' }]);

      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });
    });

    it('ADMIN nao recebe filtro de dono (ve todas as tarefas)', async () => {
      await service.list(admin, defaultQuery);

      const [findManyArgs] = prisma.task.findMany.mock.calls[0];
      expect(findManyArgs.where).toEqual({ deletedAt: null });
    });

    it('aplica filtros de status, prioridade e busca textual', async () => {
      await service.list(owner, {
        ...defaultQuery,
        status: ['PENDING', 'IN_PROGRESS'],
        priority: ['HIGH'],
        search: 'deploy',
      });

      const [findManyArgs] = prisma.task.findMany.mock.calls[0];
      expect(findManyArgs.where).toMatchObject({
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        priority: { in: ['HIGH'] },
        OR: [
          { title: { contains: 'deploy', mode: 'insensitive' } },
          { description: { contains: 'deploy', mode: 'insensitive' } },
        ],
      });
    });

    it('calcula skip/take e flags da pagina 2', async () => {
      prisma.$transaction.mockResolvedValue([[baseTask], 25]);

      const result = await service.list(owner, { ...defaultQuery, page: 2, limit: 10 });

      const [findManyArgs] = prisma.task.findMany.mock.calls[0];
      expect(findManyArgs.skip).toBe(10);
      expect(findManyArgs.take).toBe(10);
      expect(result.meta).toEqual({
        page: 2,
        limit: 10,
        total: 25,
        totalPages: 3,
        hasNextPage: true,
        hasPrevPage: true,
      });
    });
  });

  describe('findById', () => {
    it('retorna a tarefa quando pertence ao usuario', async () => {
      prisma.task.findFirst.mockResolvedValue(baseTask);

      await expect(service.findById(owner, baseTask.id)).resolves.toEqual(baseTask);
      expect(prisma.task.findFirst).toHaveBeenCalledWith({
        where: { id: baseTask.id, deletedAt: null, ownerId: owner.id },
        select: expect.any(Object),
      });
    });

    it('lanca 404 quando a tarefa nao existe ou e de outro usuario', async () => {
      prisma.task.findFirst.mockResolvedValue(null);

      await expect(service.findById(owner, baseTask.id)).rejects.toBeInstanceOf(AppError);
      await expect(service.findById(owner, baseTask.id)).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });
  });

  describe('update', () => {
    it('atualiza apenas os campos enviados e devolve o registro atualizado', async () => {
      prisma.task.updateMany.mockResolvedValue({ count: 1 });
      prisma.task.findFirst.mockResolvedValue({ ...baseTask, status: 'DONE' });

      const result = await service.update(owner, baseTask.id, { status: 'DONE' });

      expect(prisma.task.updateMany).toHaveBeenCalledWith({
        where: { id: baseTask.id, deletedAt: null, ownerId: owner.id },
        data: { status: 'DONE' },
      });
      expect(result.status).toBe('DONE');
    });

    it('lanca 404 quando nada foi atualizado (tarefa inexistente ou de outro dono)', async () => {
      prisma.task.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.update(owner, baseTask.id, { title: 'Nova' })).rejects.toMatchObject({
        statusCode: 404,
      });
      expect(prisma.task.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('remove (soft delete)', () => {
    it('marca deletedAt em vez de apagar a linha', async () => {
      prisma.task.updateMany.mockResolvedValue({ count: 1 });

      await service.remove(owner, baseTask.id);

      const [args] = prisma.task.updateMany.mock.calls[0];
      expect(args.where).toEqual({ id: baseTask.id, deletedAt: null, ownerId: owner.id });
      expect(args.data.deletedAt).toBeInstanceOf(Date);
    });

    it('lanca 404 ao remover tarefa ja removida/inexistente', async () => {
      prisma.task.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.remove(owner, baseTask.id)).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('stats', () => {
    it('agrega por status e conta atrasadas', async () => {
      prisma.task.groupBy.mockResolvedValue([
        { status: 'PENDING', _count: { _all: 3 } },
        { status: 'DONE', _count: { _all: 2 } },
      ]);
      prisma.task.count.mockResolvedValue(1);

      const result = await service.stats(owner);

      expect(result).toEqual({
        total: 5,
        byStatus: { PENDING: 3, IN_PROGRESS: 0, DONE: 2 },
        overdue: 1,
      });
      expect(prisma.task.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null, ownerId: owner.id } }),
      );
    });
  });
});
