import { NextFunction, Request, Response } from 'express';
import { getDb } from '../db';
import { getKnowledgeItemLookup } from '../lib/knowledgeItems';
import { getTopicById, listTopicsByKnowledgeItem } from '../lib/topics';

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

export const getTopicsByKnowledgeItem = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  res.json(await listTopicsByKnowledgeItem(item.id));
});

export const assignTopicToKnowledgeItem = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  const topicId = parseId(req.body.topicId);
  if (!topicId) {
    return res.status(400).json({ message: 'A valid topic id is required' });
  }

  const topic = await getTopicById(topicId);
  if (!topic) {
    return res.status(404).json({ message: 'Topic not found' });
  }

  const db = await getDb();
  await db.run(
    `INSERT OR IGNORE INTO knowledge_item_study_topics
      (knowledgeItemId, studyTopicId, sortOrder)
     VALUES (?, ?, 0)`,
    item.id,
    topicId
  );

  res.status(201).json(topic);
});

export const removeTopicFromKnowledgeItem = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  const topicId = parseId(req.params.topicId);
  if (!topicId) {
    return res.status(400).json({ message: 'A valid topic id is required' });
  }

  const db = await getDb();
  const result = await db.run(
    'DELETE FROM knowledge_item_study_topics WHERE knowledgeItemId = ? AND studyTopicId = ?',
    item.id,
    topicId
  );

  if (!result.changes) {
    return res.status(404).json({ message: 'Topic assignment not found' });
  }

  res.status(204).send();
});
