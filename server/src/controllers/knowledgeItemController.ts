import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db';
import { KnowledgeItem, NewKnowledgeItem, UpdateKnowledgeItem } from '@enzyklopaedie/shared';
import { recordActivityEvent } from '../lib/activity';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

type KnowledgeItemRow = Omit<KnowledgeItem, 'metadata'> & {
  metadata?: string | null;
};

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const parseMetadata = (value?: string | null) => {
  if (!value) return undefined;

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch (error) {
    return undefined;
  }
};

const hydrateKnowledgeItem = (row: KnowledgeItemRow): KnowledgeItem => ({
  ...row,
  metadata: parseMetadata(row.metadata),
});

export const getAllKnowledgeItems = asyncErrorHandler(async (_req: Request, res: Response) => {
  const db = await getDb();
  const rows = await db.all<KnowledgeItemRow[]>('SELECT * FROM knowledge_items ORDER BY updatedAt DESC');
  res.json(rows.map(hydrateKnowledgeItem));
});

export const getKnowledgeItemById = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const row = await db.get<KnowledgeItemRow>('SELECT * FROM knowledge_items WHERE id = ?', req.params.id);

  if (!row) {
    return res.status(404).json({ message: 'Knowledge item not found' });
  }

  res.json(hydrateKnowledgeItem(row));
});

export const createKnowledgeItem = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const newKnowledgeItem: NewKnowledgeItem = req.body;
  const now = new Date().toISOString();

  const result = await db.run(
    `INSERT INTO knowledge_items
      (kind, title, creator, sourceName, sourceUrl, summary, description, publishedYear, startedOn, completedOn, status, rating, coverImageUrl, metadata, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newKnowledgeItem.kind,
    newKnowledgeItem.title,
    newKnowledgeItem.creator || null,
    newKnowledgeItem.sourceName || null,
    newKnowledgeItem.sourceUrl || null,
    newKnowledgeItem.summary || null,
    newKnowledgeItem.description || null,
    newKnowledgeItem.publishedYear || null,
    newKnowledgeItem.startedOn || null,
    newKnowledgeItem.completedOn || null,
    newKnowledgeItem.status || 'inbox',
    newKnowledgeItem.rating || null,
    newKnowledgeItem.coverImageUrl || null,
    newKnowledgeItem.metadata ? JSON.stringify(newKnowledgeItem.metadata) : null,
    now,
    now
  );

  const createdKnowledgeItem: KnowledgeItem = {
    id: result.lastID as number,
    ...newKnowledgeItem,
    status: newKnowledgeItem.status || 'inbox',
    createdAt: now,
    updatedAt: now,
  };

  await recordActivityEvent({
    type: 'knowledge_item_created',
    entityType: 'knowledge_item',
    entityId: createdKnowledgeItem.id,
    message: `Added ${createdKnowledgeItem.kind} "${createdKnowledgeItem.title}"`,
    metadata: {
      kind: createdKnowledgeItem.kind,
      status: createdKnowledgeItem.status,
    },
  });

  res.status(201).json(createdKnowledgeItem);
});

export const updateKnowledgeItem = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const id = Number(req.params.id);
  const updatedKnowledgeItem: UpdateKnowledgeItem = req.body;

  const fields: string[] = [];
  const values: any[] = [];

  if (updatedKnowledgeItem.kind !== undefined) { fields.push('kind = ?'); values.push(updatedKnowledgeItem.kind); }
  if (updatedKnowledgeItem.title !== undefined) { fields.push('title = ?'); values.push(updatedKnowledgeItem.title); }
  if (updatedKnowledgeItem.creator !== undefined) { fields.push('creator = ?'); values.push(updatedKnowledgeItem.creator || null); }
  if (updatedKnowledgeItem.sourceName !== undefined) { fields.push('sourceName = ?'); values.push(updatedKnowledgeItem.sourceName || null); }
  if (updatedKnowledgeItem.sourceUrl !== undefined) { fields.push('sourceUrl = ?'); values.push(updatedKnowledgeItem.sourceUrl || null); }
  if (updatedKnowledgeItem.summary !== undefined) { fields.push('summary = ?'); values.push(updatedKnowledgeItem.summary || null); }
  if (updatedKnowledgeItem.description !== undefined) { fields.push('description = ?'); values.push(updatedKnowledgeItem.description || null); }
  if (updatedKnowledgeItem.publishedYear !== undefined) { fields.push('publishedYear = ?'); values.push(updatedKnowledgeItem.publishedYear || null); }
  if (updatedKnowledgeItem.startedOn !== undefined) { fields.push('startedOn = ?'); values.push(updatedKnowledgeItem.startedOn || null); }
  if (updatedKnowledgeItem.completedOn !== undefined) { fields.push('completedOn = ?'); values.push(updatedKnowledgeItem.completedOn || null); }
  if (updatedKnowledgeItem.status !== undefined) { fields.push('status = ?'); values.push(updatedKnowledgeItem.status); }
  if (updatedKnowledgeItem.rating !== undefined) { fields.push('rating = ?'); values.push(updatedKnowledgeItem.rating || null); }
  if (updatedKnowledgeItem.coverImageUrl !== undefined) { fields.push('coverImageUrl = ?'); values.push(updatedKnowledgeItem.coverImageUrl || null); }
  if (updatedKnowledgeItem.metadata !== undefined) { fields.push('metadata = ?'); values.push(updatedKnowledgeItem.metadata ? JSON.stringify(updatedKnowledgeItem.metadata) : null); }

  if (fields.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  const updatedAt = new Date().toISOString();
  fields.push('updatedAt = ?');
  values.push(updatedAt);
  values.push(id);

  const query = `UPDATE knowledge_items SET ${fields.join(', ')} WHERE id = ?`;
  const result = await db.run(query, ...values);

  if (!result.changes) {
    return res.status(404).json({ message: 'Knowledge item not found' });
  }

  const row = await db.get<KnowledgeItemRow>('SELECT * FROM knowledge_items WHERE id = ?', id);
  if (!row) {
    return res.status(404).json({ message: 'Knowledge item not found' });
  }

  const hydrated = hydrateKnowledgeItem(row);

  await recordActivityEvent({
    type: 'knowledge_item_updated',
    entityType: 'knowledge_item',
    entityId: hydrated.id,
    message: `Updated ${hydrated.kind} "${hydrated.title}"`,
    metadata: {
      status: hydrated.status,
    },
  });

  res.json(hydrated);
});

export const deleteKnowledgeItem = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const result = await db.run('DELETE FROM knowledge_items WHERE id = ?', req.params.id);

  if (result.changes && result.changes > 0) {
    res.status(204).send();
  } else {
    res.status(404).json({ message: 'Knowledge item not found' });
  }
});
