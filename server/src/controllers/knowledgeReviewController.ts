import { NextFunction, Request, Response } from 'express';
import { KnowledgeReview, UpdateKnowledgeReview } from '@enzyklopaedie/shared';
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

export const getKnowledgeReviewsByItem = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  const db = await getDb();
  const reviews = await db.all<KnowledgeReview[]>(
    'SELECT * FROM knowledge_reviews WHERE knowledgeItemId = ? ORDER BY updatedAt DESC',
    item.id
  );

  res.json(reviews);
});

export const createKnowledgeReview = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  const summary = typeof req.body.summary === 'string' && req.body.summary.trim()
    ? req.body.summary.trim()
    : null;
  const body = typeof req.body.body === 'string' && req.body.body.trim() ? req.body.body.trim() : null;
  const score = typeof req.body.score === 'number' ? req.body.score : undefined;

  if (score === undefined && !summary && !body) {
    return res.status(400).json({ message: 'A review needs a score, summary, or body' });
  }

  if (score !== undefined && (!Number.isInteger(score) || score < 1 || score > 5)) {
    return res.status(400).json({ message: 'Review score must be an integer between 1 and 5' });
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO knowledge_reviews (knowledgeItemId, score, summary, body, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    item.id,
    score ?? null,
    summary,
    body,
    now,
    now
  );

  const review: KnowledgeReview = {
    id: result.lastID as number,
    knowledgeItemId: item.id,
    score,
    summary: summary || undefined,
    body: body || undefined,
    createdAt: now,
    updatedAt: now,
  };

  await recordActivityEvent({
    type: 'review_created',
    entityType: 'knowledge_item',
    entityId: item.id,
    message: `Added a review for "${item.title}"`,
    metadata: {
      knowledgeReviewId: review.id,
      score: review.score,
    },
  });

  res.status(201).json(review);
});

export const updateKnowledgeReview = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  const reviewId = parseId(req.params.id);
  if (!reviewId) {
    return res.status(400).json({ message: 'Invalid knowledge review id' });
  }

  const updatedReview: UpdateKnowledgeReview = req.body;
  const fields: string[] = [];
  const values: Array<string | number | null> = [];

  if (updatedReview.score !== undefined) {
    if (!Number.isInteger(updatedReview.score) || updatedReview.score < 1 || updatedReview.score > 5) {
      return res.status(400).json({ message: 'Review score must be an integer between 1 and 5' });
    }
    fields.push('score = ?');
    values.push(updatedReview.score);
  }

  if (updatedReview.summary !== undefined) {
    fields.push('summary = ?');
    values.push(updatedReview.summary ? updatedReview.summary.trim() : null);
  }

  if (updatedReview.body !== undefined) {
    fields.push('body = ?');
    values.push(updatedReview.body ? updatedReview.body.trim() : null);
  }

  if (fields.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  const db = await getDb();
  const updatedAt = new Date().toISOString();
  fields.push('updatedAt = ?');
  values.push(updatedAt, reviewId, item.id);

  const result = await db.run(
    `UPDATE knowledge_reviews SET ${fields.join(', ')} WHERE id = ? AND knowledgeItemId = ?`,
    ...values
  );

  if (!result.changes) {
    return res.status(404).json({ message: 'Knowledge review not found' });
  }

  const review = await db.get<KnowledgeReview>(
    'SELECT * FROM knowledge_reviews WHERE id = ? AND knowledgeItemId = ?',
    reviewId,
    item.id
  );

  res.json(review);
});

export const deleteKnowledgeReview = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  const reviewId = parseId(req.params.id);
  if (!reviewId) {
    return res.status(400).json({ message: 'Invalid knowledge review id' });
  }

  const db = await getDb();
  const result = await db.run(
    'DELETE FROM knowledge_reviews WHERE id = ? AND knowledgeItemId = ?',
    reviewId,
    item.id
  );

  if (!result.changes) {
    return res.status(404).json({ message: 'Knowledge review not found' });
  }

  res.status(204).send();
});
