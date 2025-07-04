import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db';
import { Civilization, NewCivilization, UpdateCivilization } from '@enzyklopaedie/shared';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const getAllCivilizations = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const civilizations = await db.all<Civilization[]>('SELECT * FROM civilizations');
  res.json(civilizations);
});

export const getCivilizationById = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const civilization = await db.get<Civilization>('SELECT * FROM civilizations WHERE id = ?', req.params.id);
  if (civilization) {
    res.json(civilization);
  } else {
    res.status(404).json({ message: 'Civilization not found' });
  }
});

export const createCivilization = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const newCivilization: NewCivilization = req.body;
  const result = await db.run(
    'INSERT INTO civilizations (name, nationIds, description, parentId) VALUES (?, ?, ?, ?)',
    newCivilization.name,
    JSON.stringify(newCivilization.nationIds),
    newCivilization.description || null,
    newCivilization.parentId
  );
  res.status(201).json({ id: result.lastID, ...newCivilization });
});

export const updateCivilization = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const id = req.params.id;
  const updatedCivilization: UpdateCivilization = req.body;

  const fields: string[] = [];
  const values: any[] = [];

  if (updatedCivilization.name !== undefined) { fields.push('name = ?'); values.push(updatedCivilization.name); }
  if (updatedCivilization.nationIds !== undefined) { fields.push('nationIds = ?'); values.push(JSON.stringify(updatedCivilization.nationIds)); }
  if (updatedCivilization.description !== undefined) { fields.push('description = ?'); values.push(updatedCivilization.description); }
  if (updatedCivilization.parentId !== undefined) { fields.push('parentId = ?'); values.push(updatedCivilization.parentId); }

  if (fields.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  const query = `UPDATE civilizations SET ${fields.join(', ')} WHERE id = ?`;
  values.push(id);

  const result = await db.run(query, ...values);

  if (result.changes && result.changes > 0) {
    res.json({ message: 'Civilization updated successfully' });
  } else {
    res.status(404).json({ message: 'Civilization not found' });
  }
});

export const deleteCivilization = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const result = await db.run('DELETE FROM civilizations WHERE id = ?', req.params.id);
  if (result.changes && result.changes > 0) {
    res.status(204).send(); // No Content
  } else {
    res.status(404).json({ message: 'Civilization not found' });
  }
}); 