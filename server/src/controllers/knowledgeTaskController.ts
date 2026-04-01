import { NextFunction, Request, Response } from 'express';
import { KnowledgeTask, KnowledgeTaskStatus, UpdateKnowledgeTask } from '@enzyklopaedie/shared';
import { getDb } from '../db';
import { recordActivityEvent } from '../lib/activity';
import { getKnowledgeItemLookup } from '../lib/knowledgeItems';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const parseId = (value: string) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const isKnowledgeTaskStatus = (value: unknown): value is KnowledgeTaskStatus =>
  value === 'todo' || value === 'doing' || value === 'done' || value === 'archived';

const getKnowledgeItemFromParams = async (req: Request, res: Response) => {
  const knowledgeItemId = parseId(req.params.knowledgeItemId);
  if (!knowledgeItemId) {
    res.status(400).json({ message: 'Invalid knowledge item id' });
    return null;
  }

  const item = await getKnowledgeItemLookup(knowledgeItemId);
  if (!item) {
    res.status(404).json({ message: 'Knowledge item not found' });
    return null;
  }

  return item;
};

export const getKnowledgeTasksByItem = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  const db = await getDb();
  const tasks = await db.all<KnowledgeTask[]>(
    'SELECT * FROM knowledge_tasks WHERE knowledgeItemId = ? ORDER BY sortOrder ASC, updatedAt DESC',
    item.id
  );

  res.json(tasks);
});

export const createKnowledgeTask = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  if (!title) {
    return res.status(400).json({ message: 'Task title is required' });
  }

  const requestedStatus = req.body.status;
  if (requestedStatus !== undefined && !isKnowledgeTaskStatus(requestedStatus)) {
    return res.status(400).json({ message: 'Invalid task status' });
  }

  const status = (requestedStatus || 'todo') as KnowledgeTaskStatus;
  const now = new Date().toISOString();
  const completedAt = status === 'done' ? now : null;
  const details = typeof req.body.details === 'string' && req.body.details.trim()
    ? req.body.details.trim()
    : null;
  const dueAt = typeof req.body.dueAt === 'string' && req.body.dueAt ? req.body.dueAt : null;
  const scheduledFor =
    typeof req.body.scheduledFor === 'string' && req.body.scheduledFor ? req.body.scheduledFor : null;
  const sortOrder = Number.isInteger(req.body.sortOrder) ? req.body.sortOrder : 0;

  const db = await getDb();
  const result = await db.run(
    `INSERT INTO knowledge_tasks
      (knowledgeItemId, title, details, status, dueAt, scheduledFor, completedAt, sortOrder, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    item.id,
    title,
    details,
    status,
    dueAt,
    scheduledFor,
    completedAt,
    sortOrder,
    now,
    now
  );

  const task: KnowledgeTask = {
    id: result.lastID as number,
    knowledgeItemId: item.id,
    title,
    details: details || undefined,
    status,
    dueAt: dueAt || undefined,
    scheduledFor: scheduledFor || undefined,
    completedAt: completedAt || undefined,
    sortOrder,
    createdAt: now,
    updatedAt: now,
  };

  await recordActivityEvent({
    type: 'task_created',
    entityType: 'knowledge_item',
    entityId: item.id,
    message: `Added task "${task.title}" to "${item.title}"`,
    metadata: {
      knowledgeTaskId: task.id,
      status: task.status,
    },
  });

  if (task.status === 'done') {
    await recordActivityEvent({
      type: 'task_completed',
      entityType: 'knowledge_item',
      entityId: item.id,
      message: `Completed task "${task.title}" for "${item.title}"`,
      metadata: {
        knowledgeTaskId: task.id,
      },
    });
  }

  res.status(201).json(task);
});

export const updateKnowledgeTask = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  const taskId = parseId(req.params.id);
  if (!taskId) {
    return res.status(400).json({ message: 'Invalid knowledge task id' });
  }

  const db = await getDb();
  const existingTask = await db.get<KnowledgeTask>(
    'SELECT * FROM knowledge_tasks WHERE id = ? AND knowledgeItemId = ?',
    taskId,
    item.id
  );

  if (!existingTask) {
    return res.status(404).json({ message: 'Knowledge task not found' });
  }

  const updatedTask: UpdateKnowledgeTask = req.body;
  const fields: string[] = [];
  const values: Array<string | number | null> = [];

  if (updatedTask.title !== undefined) {
    const title = updatedTask.title.trim();
    if (!title) {
      return res.status(400).json({ message: 'Task title is required' });
    }
    fields.push('title = ?');
    values.push(title);
  }

  if (updatedTask.details !== undefined) {
    fields.push('details = ?');
    values.push(updatedTask.details ? updatedTask.details.trim() : null);
  }

  let nextStatus = existingTask.status;
  if (updatedTask.status !== undefined) {
    if (!isKnowledgeTaskStatus(updatedTask.status)) {
      return res.status(400).json({ message: 'Invalid task status' });
    }
    nextStatus = updatedTask.status;
    fields.push('status = ?');
    values.push(nextStatus);
  }

  if (updatedTask.dueAt !== undefined) {
    fields.push('dueAt = ?');
    values.push(updatedTask.dueAt || null);
  }

  if (updatedTask.scheduledFor !== undefined) {
    fields.push('scheduledFor = ?');
    values.push(updatedTask.scheduledFor || null);
  }

  if (updatedTask.sortOrder !== undefined) {
    fields.push('sortOrder = ?');
    values.push(updatedTask.sortOrder);
  }

  let completedAtValue: string | null | undefined;
  if (updatedTask.completedAt !== undefined) {
    completedAtValue = updatedTask.completedAt || null;
  } else if (existingTask.status !== 'done' && nextStatus === 'done') {
    completedAtValue = new Date().toISOString();
  } else if (existingTask.status === 'done' && nextStatus !== 'done') {
    completedAtValue = null;
  }

  if (completedAtValue !== undefined) {
    fields.push('completedAt = ?');
    values.push(completedAtValue);
  }

  if (fields.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  const updatedAt = new Date().toISOString();
  fields.push('updatedAt = ?');
  values.push(updatedAt, taskId, item.id);

  const result = await db.run(
    `UPDATE knowledge_tasks SET ${fields.join(', ')} WHERE id = ? AND knowledgeItemId = ?`,
    ...values
  );

  if (!result.changes) {
    return res.status(404).json({ message: 'Knowledge task not found' });
  }

  const task = await db.get<KnowledgeTask>(
    'SELECT * FROM knowledge_tasks WHERE id = ? AND knowledgeItemId = ?',
    taskId,
    item.id
  );

  if (existingTask.status !== 'done' && task?.status === 'done') {
    await recordActivityEvent({
      type: 'task_completed',
      entityType: 'knowledge_item',
      entityId: item.id,
      message: `Completed task "${task.title}" for "${item.title}"`,
      metadata: {
        knowledgeTaskId: task.id,
      },
    });
  }

  res.json(task);
});

export const deleteKnowledgeTask = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  const taskId = parseId(req.params.id);
  if (!taskId) {
    return res.status(400).json({ message: 'Invalid knowledge task id' });
  }

  const db = await getDb();
  const result = await db.run(
    'DELETE FROM knowledge_tasks WHERE id = ? AND knowledgeItemId = ?',
    taskId,
    item.id
  );

  if (!result.changes) {
    return res.status(404).json({ message: 'Knowledge task not found' });
  }

  res.status(204).send();
});
