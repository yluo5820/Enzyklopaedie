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

const knowledgeItemStatuses = new Set(['inbox', 'queued', 'active', 'completed', 'archived']);

const normalizeKnowledgeItemKind = (value: unknown): KnowledgeItem['kind'] | null => {
  if (value === 'book' || value === 'article' || value === 'essay') return 'book';
  if (
    value === 'lecture' ||
    value === 'video' ||
    value === 'podcast' ||
    value === 'course' ||
    value === 'artifact'
  ) {
    return 'lecture';
  }

  return null;
};

const normalizeOptionalText = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const normalizeOptionalNumber = (value: unknown) => {
  if (value === undefined || value === null || value === '') return undefined;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
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
  const kind = normalizeKnowledgeItemKind(newKnowledgeItem.kind);
  const title = normalizeOptionalText(newKnowledgeItem.title);

  if (!kind) {
    return res.status(400).json({ message: 'Invalid item kind' });
  }

  if (!title) {
    return res.status(400).json({ message: 'Item title is required' });
  }

  if (
    newKnowledgeItem.status !== undefined &&
    !knowledgeItemStatuses.has(newKnowledgeItem.status)
  ) {
    return res.status(400).json({ message: 'Invalid item status' });
  }

  if (
    newKnowledgeItem.metadata !== undefined &&
    (typeof newKnowledgeItem.metadata !== 'object' ||
      newKnowledgeItem.metadata === null ||
      Array.isArray(newKnowledgeItem.metadata))
  ) {
    return res.status(400).json({ message: 'Item metadata must be an object' });
  }

  const result = await db.run(
    `INSERT INTO knowledge_items
      (kind, title, creator, sourceName, sourceUrl, summary, description, publishedYear, startedOn, completedOn, status, rating, coverImageUrl, metadata, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    kind,
    title,
    normalizeOptionalText(newKnowledgeItem.creator) || null,
    normalizeOptionalText(newKnowledgeItem.sourceName) || null,
    normalizeOptionalText(newKnowledgeItem.sourceUrl) || null,
    normalizeOptionalText(newKnowledgeItem.summary) || null,
    normalizeOptionalText(newKnowledgeItem.description) || null,
    normalizeOptionalNumber(newKnowledgeItem.publishedYear) ?? null,
    normalizeOptionalText(newKnowledgeItem.startedOn) || null,
    normalizeOptionalText(newKnowledgeItem.completedOn) || null,
    newKnowledgeItem.status || 'inbox',
    normalizeOptionalNumber(newKnowledgeItem.rating) ?? null,
    normalizeOptionalText(newKnowledgeItem.coverImageUrl) || null,
    newKnowledgeItem.metadata ? JSON.stringify(newKnowledgeItem.metadata) : null,
    now,
    now
  );

  const createdKnowledgeItem: KnowledgeItem = {
    id: result.lastID as number,
    ...newKnowledgeItem,
    kind,
    title,
    creator: normalizeOptionalText(newKnowledgeItem.creator),
    sourceName: normalizeOptionalText(newKnowledgeItem.sourceName),
    sourceUrl: normalizeOptionalText(newKnowledgeItem.sourceUrl),
    summary: normalizeOptionalText(newKnowledgeItem.summary),
    description: normalizeOptionalText(newKnowledgeItem.description),
    publishedYear: normalizeOptionalNumber(newKnowledgeItem.publishedYear),
    startedOn: normalizeOptionalText(newKnowledgeItem.startedOn),
    completedOn: normalizeOptionalText(newKnowledgeItem.completedOn),
    rating: normalizeOptionalNumber(newKnowledgeItem.rating),
    coverImageUrl: normalizeOptionalText(newKnowledgeItem.coverImageUrl),
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

  if (updatedKnowledgeItem.kind !== undefined) {
    const normalizedKind = normalizeKnowledgeItemKind(updatedKnowledgeItem.kind);
    if (!normalizedKind) {
      return res.status(400).json({ message: 'Invalid item kind' });
    }

    fields.push('kind = ?');
    values.push(normalizedKind);
  }

  if (updatedKnowledgeItem.title !== undefined) {
    const title = normalizeOptionalText(updatedKnowledgeItem.title);
    if (!title) {
      return res.status(400).json({ message: 'Item title is required' });
    }

    fields.push('title = ?');
    values.push(title);
  }

  if (updatedKnowledgeItem.creator !== undefined) {
    fields.push('creator = ?');
    values.push(normalizeOptionalText(updatedKnowledgeItem.creator) || null);
  }

  if (updatedKnowledgeItem.sourceName !== undefined) {
    fields.push('sourceName = ?');
    values.push(normalizeOptionalText(updatedKnowledgeItem.sourceName) || null);
  }

  if (updatedKnowledgeItem.sourceUrl !== undefined) {
    fields.push('sourceUrl = ?');
    values.push(normalizeOptionalText(updatedKnowledgeItem.sourceUrl) || null);
  }

  if (updatedKnowledgeItem.summary !== undefined) {
    fields.push('summary = ?');
    values.push(normalizeOptionalText(updatedKnowledgeItem.summary) || null);
  }

  if (updatedKnowledgeItem.description !== undefined) {
    fields.push('description = ?');
    values.push(normalizeOptionalText(updatedKnowledgeItem.description) || null);
  }

  if (updatedKnowledgeItem.publishedYear !== undefined) {
    fields.push('publishedYear = ?');
    values.push(normalizeOptionalNumber(updatedKnowledgeItem.publishedYear) ?? null);
  }

  if (updatedKnowledgeItem.startedOn !== undefined) {
    fields.push('startedOn = ?');
    values.push(normalizeOptionalText(updatedKnowledgeItem.startedOn) || null);
  }

  if (updatedKnowledgeItem.completedOn !== undefined) {
    fields.push('completedOn = ?');
    values.push(normalizeOptionalText(updatedKnowledgeItem.completedOn) || null);
  }

  if (updatedKnowledgeItem.status !== undefined) {
    if (!knowledgeItemStatuses.has(updatedKnowledgeItem.status)) {
      return res.status(400).json({ message: 'Invalid item status' });
    }

    fields.push('status = ?');
    values.push(updatedKnowledgeItem.status);
  }

  if (updatedKnowledgeItem.rating !== undefined) {
    fields.push('rating = ?');
    values.push(normalizeOptionalNumber(updatedKnowledgeItem.rating) ?? null);
  }

  if (updatedKnowledgeItem.coverImageUrl !== undefined) {
    fields.push('coverImageUrl = ?');
    values.push(normalizeOptionalText(updatedKnowledgeItem.coverImageUrl) || null);
  }

  if (updatedKnowledgeItem.metadata !== undefined) {
    if (
      updatedKnowledgeItem.metadata !== null &&
      (typeof updatedKnowledgeItem.metadata !== 'object' || Array.isArray(updatedKnowledgeItem.metadata))
    ) {
      return res.status(400).json({ message: 'Item metadata must be an object' });
    }

    fields.push('metadata = ?');
    values.push(updatedKnowledgeItem.metadata ? JSON.stringify(updatedKnowledgeItem.metadata) : null);
  }

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
