import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db';
import { Era, NewEra, UpdateEra } from '@enzyklopaedie/shared';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const getAllEras = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const eras = await db.all<Era[]>('SELECT * FROM eras');
  res.json(eras);
});

export const getEraById = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const era = await db.get<Era>('SELECT * FROM eras WHERE id = ?', req.params.id);
  if (era) {
    res.json(era);
  } else {
    res.status(404).json({ message: 'Era not found' });
  }
});

export const createEra = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const newEra: NewEra = req.body;
  const result = await db.run(
    'INSERT INTO eras (name, beginYear, endYear, description, civilizationId) VALUES (?, ?, ?, ?, ?)',
    newEra.name,
    newEra.beginYear,
    newEra.endYear || null,
    newEra.description || null,
    newEra.civilizationId
  );
  res.status(201).json({ id: result.lastID, ...newEra });
});

export const updateEra = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const id = req.params.id;
  const updatedEra: UpdateEra = req.body;

  const fields: string[] = [];
  const values: any[] = [];

  if (updatedEra.name !== undefined) { fields.push('name = ?'); values.push(updatedEra.name); }
  if (updatedEra.beginYear !== undefined) { fields.push('beginYear = ?'); values.push(updatedEra.beginYear); }
  if (updatedEra.endYear !== undefined) { fields.push('endYear = ?'); values.push(updatedEra.endYear); }
  if (updatedEra.description !== undefined) { fields.push('description = ?'); values.push(updatedEra.description); }
  if (updatedEra.civilizationId !== undefined) { fields.push('civilizationId = ?'); values.push(updatedEra.civilizationId); }

  if (fields.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  const query = `UPDATE eras SET ${fields.join(', ')} WHERE id = ?`;
  values.push(id);

  const result = await db.run(query, ...values);

  if (result.changes && result.changes > 0) {
    res.json({ message: 'Era updated successfully' });
  } else {
    res.status(404).json({ message: 'Era not found' });
  }
});

export const deleteEra = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const result = await db.run('DELETE FROM eras WHERE id = ?', req.params.id);
  if (result.changes && result.changes > 0) {
    res.status(204).send(); // No Content
  } else {
    res.status(404).json({ message: 'Era not found' });
  }
}); 