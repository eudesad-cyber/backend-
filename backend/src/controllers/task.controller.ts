import type { Request, Response } from 'express';
import { taskService } from '../services/task.service';
import { AppError } from '../errors/AppError';
import type { CreateTaskInput, ListTasksQuery, UpdateTaskInput } from '../schemas/task.schema';

/** Garante que o middleware de autenticacao rodou (defesa em profundidade). */
function currentUser(req: Request) {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

/** POST /api/v1/tasks -> 201 */
export async function createTask(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const task = await taskService.create(user.id, req.body as CreateTaskInput);
  res.status(201).json({ success: true, data: task });
}

/** GET /api/v1/tasks?page=&limit=&status=&priority=&search=&sortBy=&order= -> 200 */
export async function listTasks(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const result = await taskService.list(user, req.query as unknown as ListTasksQuery);
  res.status(200).json({ success: true, ...result });
}

/** GET /api/v1/tasks/stats -> 200 */
export async function taskStats(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const stats = await taskService.stats(user);
  res.status(200).json({ success: true, data: stats });
}

/** GET /api/v1/tasks/:id -> 200 */
export async function getTask(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const task = await taskService.findById(user, req.params.id);
  res.status(200).json({ success: true, data: task });
}

/** PATCH /api/v1/tasks/:id -> 200 */
export async function updateTask(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const task = await taskService.update(user, req.params.id, req.body as UpdateTaskInput);
  res.status(200).json({ success: true, data: task });
}

/** DELETE /api/v1/tasks/:id -> 204 */
export async function deleteTask(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  await taskService.remove(user, req.params.id);
  res.status(204).send();
}

/** POST /api/v1/tasks/:id/restore -> 200 */
export async function restoreTask(req: Request, res: Response): Promise<void> {
  const user = currentUser(req);
  const task = await taskService.restore(user, req.params.id);
  res.status(200).json({ success: true, data: task });
}
