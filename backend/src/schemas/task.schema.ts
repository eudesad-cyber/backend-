import { z } from 'zod';

export const TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'DONE'] as const;
export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH'] as const;

/** Data em ISO 8601, convertida para Date; aceita null para limpar. */
const isoDate = z
  .union([z.string().datetime({ offset: true }), z.string().datetime()])
  .transform((value) => new Date(value))
  .nullable();

export const createTaskSchema = z.object({
  title: z.string().trim().min(3, 'Titulo muito curto').max(160, 'Titulo muito longo'),
  description: z.string().trim().max(5000).optional().nullable(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueDate: isoDate.optional(),
});

export const updateTaskSchema = createTaskSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Envie ao menos um campo para atualizar',
  });

export const taskIdParamSchema = z.object({
  id: z.string().uuid('O id deve ser um UUID valido'),
});

/**
 * Query da listagem: paginacao por offset + filtros + ordenacao.
 * `status` e `priority` aceitam multiplos valores separados por virgula.
 */
export const listTasksQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    status: z
      .string()
      .transform((value) =>
        value
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
      )
      .pipe(z.array(z.enum(TASK_STATUSES)).min(1))
      .optional(),
    priority: z
      .string()
      .transform((value) =>
        value
          .split(',')
          .map((s) => s.trim().toUpperCase())
          .filter(Boolean),
      )
      .pipe(z.array(z.enum(TASK_PRIORITIES)).min(1))
      .optional(),
    search: z.string().trim().max(120).optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'dueDate', 'priority', 'title']).default('createdAt'),
    order: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict();

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
