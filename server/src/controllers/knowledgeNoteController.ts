import { NextFunction, Request, Response } from 'express';
import { KnowledgeNote, UpdateKnowledgeNote } from '@enzyklopaedie/shared';
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

export const getKnowledgeNotesByItem = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  const db = await getDb();
  const notes = await db.all<KnowledgeNote[]>(
    'SELECT * FROM knowledge_notes WHERE knowledgeItemId = ? ORDER BY updatedAt DESC',
    item.id
  );

  res.json(notes);
});

export const createKnowledgeNote = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  if (!content) {
    return res.status(400).json({ message: 'Note content is required' });
  }

  const db = await getDb();
  const now = new Date().toISOString();
  const result = await db.run(
    'INSERT INTO knowledge_notes (knowledgeItemId, content, createdAt, updatedAt) VALUES (?, ?, ?, ?)',
    item.id,
    content,
    now,
    now
  );

  const note: KnowledgeNote = {
    id: result.lastID as number,
    knowledgeItemId: item.id,
    content,
    createdAt: now,
    updatedAt: now,
  };

  await recordActivityEvent({
    type: 'note_created',
    entityType: 'knowledge_item',
    entityId: item.id,
    message: `Added a note to "${item.title}"`,
    metadata: {
      knowledgeNoteId: note.id,
    },
  });

  res.status(201).json(note);
});

export const updateKnowledgeNote = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  const noteId = parseId(req.params.id);
  if (!noteId) {
    return res.status(400).json({ message: 'Invalid knowledge note id' });
  }

  const updatedNote: UpdateKnowledgeNote = req.body;
  const fields: string[] = [];
  const values: Array<string | number | null> = [];

  if (updatedNote.content !== undefined) {
    const content = updatedNote.content.trim();
    if (!content) {
      return res.status(400).json({ message: 'Note content is required' });
    }
    fields.push('content = ?');
    values.push(content);
  }

  if (fields.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  const db = await getDb();
  const updatedAt = new Date().toISOString();
  fields.push('updatedAt = ?');
  values.push(updatedAt, noteId, item.id);

  const result = await db.run(
    `UPDATE knowledge_notes SET ${fields.join(', ')} WHERE id = ? AND knowledgeItemId = ?`,
    ...values
  );

  if (!result.changes) {
    return res.status(404).json({ message: 'Knowledge note not found' });
  }

  const note = await db.get<KnowledgeNote>(
    'SELECT * FROM knowledge_notes WHERE id = ? AND knowledgeItemId = ?',
    noteId,
    item.id
  );

  res.json(note);
});

export const deleteKnowledgeNote = asyncErrorHandler(async (req: Request, res: Response) => {
  const item = await getKnowledgeItemFromParams(req, res);
  if (!item) return;

  const noteId = parseId(req.params.id);
  if (!noteId) {
    return res.status(400).json({ message: 'Invalid knowledge note id' });
  }

  const db = await getDb();
  const result = await db.run(
    'DELETE FROM knowledge_notes WHERE id = ? AND knowledgeItemId = ?',
    noteId,
    item.id
  );

  if (!result.changes) {
    return res.status(404).json({ message: 'Knowledge note not found' });
  }

  res.status(204).send();
});
