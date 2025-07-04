import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db';
import { Nation, NewNation, UpdateNation } from '@enzyklopaedie/shared';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const getAllNations = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const nations = await db.all<Nation[]>('SELECT * FROM nations');
  res.json(nations);
});

export const getNationById = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const nation = await db.get<Nation>('SELECT * FROM nations WHERE id = ?', req.params.id);
  if (nation) {
    res.json(nation);
  } else {
    res.status(404).json({ message: 'Nation not found' });
  }
});

export const createNation = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const newNation: NewNation = req.body;
  const result = await db.run(
    'INSERT INTO nations (name, beginYear, endYear, description, imageUrl, link, authorIds, civilizationId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    newNation.name,
    newNation.beginYear,
    newNation.endYear || null,
    newNation.description || null,
    newNation.imageUrl || null,
    newNation.link || null,
    JSON.stringify(newNation.authorIds),
    newNation.civilizationId
  );
  res.status(201).json({ id: result.lastID, ...newNation });
});

export const updateNation = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const id = req.params.id;
  const updatedNation: UpdateNation = req.body;

  const fields: string[] = [];
  const values: any[] = [];

  if (updatedNation.name !== undefined) { fields.push('name = ?'); values.push(updatedNation.name); }
  if (updatedNation.beginYear !== undefined) { fields.push('beginYear = ?'); values.push(updatedNation.beginYear); }
  if (updatedNation.endYear !== undefined) { fields.push('endYear = ?'); values.push(updatedNation.endYear); }
  if (updatedNation.description !== undefined) { fields.push('description = ?'); values.push(updatedNation.description); }
  if (updatedNation.imageUrl !== undefined) { fields.push('imageUrl = ?'); values.push(updatedNation.imageUrl); }
  if (updatedNation.link !== undefined) { fields.push('link = ?'); values.push(updatedNation.link); }
  if (updatedNation.authorIds !== undefined) { fields.push('authorIds = ?'); values.push(JSON.stringify(updatedNation.authorIds)); }
  if (updatedNation.civilizationId !== undefined) { fields.push('civilizationId = ?'); values.push(updatedNation.civilizationId); }

  if (fields.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  const query = `UPDATE nations SET ${fields.join(', ')} WHERE id = ?`;
  values.push(id);

  const result = await db.run(query, ...values);

  if (result.changes && result.changes > 0) {
    res.json({ message: 'Nation updated successfully' });
  } else {
    res.status(404).json({ message: 'Nation not found' });
  }
});

export const deleteNation = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const result = await db.run('DELETE FROM nations WHERE id = ?', req.params.id);
  if (result.changes && result.changes > 0) {
    res.status(204).send(); // No Content
  } else {
    res.status(404).json({ message: 'Nation not found' });
  }
}); 