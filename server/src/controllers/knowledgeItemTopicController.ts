import { NextFunction, Request, Response } from 'express';
import { Topic } from '@enzyklopaedie/shared';
import { getDb } from '../db';
import { getKnowledgeItemLookup } from '../lib/knowledgeItems';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const parseId = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

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

const fetchTopicsForItem = async (knowledgeItemId: number) => {
  const db = await getDb();
  return db.all<Topic[]>(
    `SELECT t.*
     FROM knowledge_item_topics kit
     INNER JOIN topics t ON t.id = kit.topicId
     WHERE kit.knowledgeItemId = ?
     ORDER BY COALESCE(t.parentTopicId, 0) ASC, lower(t.name) ASC`,
    knowledgeItemId
  );
};

export const getTopicsByKnowledgeItem = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  res.json(await fetchTopicsForItem(item.id));
});

export const assignTopicToKnowledgeItem = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  const topicId = parseId(req.body.topicId);
  if (!topicId) {
    return res.status(400).json({ message: 'A valid topic id is required' });
  }

  const db = await getDb();
  const topic = await db.get<Topic>('SELECT * FROM topics WHERE id = ?', topicId);
  if (!topic) {
    return res.status(404).json({ message: 'Topic not found' });
  }

  const sortOrder = Number.isInteger(req.body.sortOrder) ? req.body.sortOrder : 0;
  await db.run(
    'INSERT OR IGNORE INTO knowledge_item_topics (knowledgeItemId, topicId, sortOrder) VALUES (?, ?, ?)',
    item.id,
    topicId,
    sortOrder
  );

  res.status(201).json(topic);
});

export const removeTopicFromKnowledgeItem = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  const topicId = parseId(req.params.topicId);
  if (!topicId) {
    return res.status(400).json({ message: 'Invalid topic id' });
  }

  const db = await getDb();
  const result = await db.run(
    'DELETE FROM knowledge_item_topics WHERE knowledgeItemId = ? AND topicId = ?',
    item.id,
    topicId
  );

  if (!result.changes) {
    return res.status(404).json({ message: 'Topic assignment not found' });
  }

  res.status(204).send();
});
