import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db';
import { Note, NewNote, UpdateNote } from '../types';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const getAllNotes = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const notes = await db.all<Note[]>('SELECT * FROM notes');
  res.json(notes);
});

export const getNoteById = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const note = await db.get<Note>('SELECT * FROM notes WHERE id = ?', req.params.id);
  if (note) {
    res.json(note);
  } else {
    res.status(404).json({ message: 'Note not found' });
  }
});

export const getNotesByParent = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const { parentId, parentType } = req.query;
  const notes = await db.all<Note[]>(
    'SELECT * FROM notes WHERE parentId = ? AND parentType = ?',
    parentId,
    parentType
  );
  res.json(notes);
});

export const createNote = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const newNote: NewNote = req.body;
  const timestamp = new Date().toISOString();
  const result = await db.run(
    'INSERT INTO notes (parentId, parentType, content, timestamp) VALUES (?, ?, ?, ?)',
    newNote.parentId,
    newNote.parentType,
    newNote.content,
    timestamp
  );
  res.status(201).json({ id: result.lastID, ...newNote, timestamp });
});

export const updateNote = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const id = req.params.id;
  const updatedNote: UpdateNote = req.body;

  const fields: string[] = [];
  const values: any[] = [];

  if (updatedNote.parentId !== undefined) { fields.push('parentId = ?'); values.push(updatedNote.parentId); }
  if (updatedNote.parentType !== undefined) { fields.push('parentType = ?'); values.push(updatedNote.parentType); }
  if (updatedNote.content !== undefined) { fields.push('content = ?'); values.push(updatedNote.content); }
  if (updatedNote.timestamp !== undefined) { fields.push('timestamp = ?'); values.push(updatedNote.timestamp); }

  if (fields.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  const query = `UPDATE notes SET ${fields.join(', ')} WHERE id = ?`;
  values.push(id);

  const result = await db.run(query, ...values);

  if (result.changes && result.changes > 0) {
    res.json({ message: 'Note updated successfully' });
  } else {
    res.status(404).json({ message: 'Note not found' });
  }
});

export const deleteNote = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const result = await db.run('DELETE FROM notes WHERE id = ?', req.params.id);
  if (result.changes && result.changes > 0) {
    res.status(204).send(); // No Content
  } else {
    res.status(404).json({ message: 'Note not found' });
  }
}); 