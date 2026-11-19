import { Router } from 'express';
import * as taskController from '../controllers/task.controller';
import {
  createTaskSchema,
  listTasksQuerySchema,
  taskIdParamSchema,
  updateTaskSchema,
} from '../schemas/task.schema';
import { validate } from '../middlewares/validate.middleware';
import { authenticate } from '../middlewares/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Todas as rotas de tarefas exigem autenticacao.
router.use(authenticate);

/** GET /tasks/stats — contadores para dashboard (antes de /:id). */
router.get('/stats', asyncHandler(taskController.taskStats));

/** GET /tasks — listagem paginada e filtrada. */
router.get('/', validate(listTasksQuerySchema, 'query'), asyncHandler(taskController.listTasks));

/** POST /tasks — cria tarefa. */
router.post('/', validate(createTaskSchema), asyncHandler(taskController.createTask));

/** GET /tasks/:id */
router.get('/:id', validate(taskIdParamSchema, 'params'), asyncHandler(taskController.getTask));

/** PATCH /tasks/:id — atualizacao parcial. */
router.patch(
  '/:id',
  validate(taskIdParamSchema, 'params'),
  validate(updateTaskSchema),
  asyncHandler(taskController.updateTask),
);

/** DELETE /tasks/:id — soft delete. */
router.delete('/:id', validate(taskIdParamSchema, 'params'), asyncHandler(taskController.deleteTask));

/** POST /tasks/:id/restore — restaura tarefa removida. */
router.post(
  '/:id/restore',
  validate(taskIdParamSchema, 'params'),
  asyncHandler(taskController.restoreTask),
);

export default router;
