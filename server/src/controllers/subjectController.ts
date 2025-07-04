import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db';
import { Subject, NewSubject, UpdateSubject } from '../types';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const getAllSubjects = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const subjects = await db.all<Subject[]>('SELECT * FROM subjects');
  res.json(subjects);
});

export const getSubjectById = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const subject = await db.get<Subject>('SELECT * FROM subjects WHERE id = ?', req.params.id);
  if (subject) {
    res.json(subject);
  } else {
    res.status(404).json({ message: 'Subject not found' });
  }
});

export const createSubject = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const newSubject: NewSubject = req.body;
  const result = await db.run(
    'INSERT INTO subjects (name, parentId) VALUES (?, ?)',
    newSubject.name,
    newSubject.parentId || null
  );
  res.status(201).json({ id: result.lastID, ...newSubject });
});

export const updateSubject = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const id = req.params.id;
  const updatedSubject: UpdateSubject = req.body;

  const fields: string[] = [];
  const values: any[] = [];

  if (updatedSubject.name !== undefined) { fields.push('name = ?'); values.push(updatedSubject.name); }
  if (updatedSubject.parentId !== undefined) { fields.push('parentId = ?'); values.push(updatedSubject.parentId); }

  if (fields.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  const query = `UPDATE subjects SET ${fields.join(', ')} WHERE id = ?`;
  values.push(id);

  const result = await db.run(query, ...values);

  if (result.changes && result.changes > 0) {
    res.json({ message: 'Subject updated successfully' });
  } else {
    res.status(404).json({ message: 'Subject not found' });
  }
});

export const deleteSubject = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const result = await db.run('DELETE FROM subjects WHERE id = ?', req.params.id);
  if (result.changes && result.changes > 0) {
    res.status(204).send(); // No Content
  } else {
    res.status(404).json({ message: 'Subject not found' });
  }
}); 