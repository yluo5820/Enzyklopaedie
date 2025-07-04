import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db';
import { Lecture, NewLecture, UpdateLecture } from '@enzyklopaedie/shared';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const getAllLectures = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const lectures = await db.all<Lecture[]>('SELECT * FROM lectures');
  res.json(lectures);
});

export const getLectureById = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const lecture = await db.get<Lecture>('SELECT * FROM lectures WHERE id = ?', req.params.id);
  if (lecture) {
    res.json(lecture);
  } else {
    res.status(404).json({ message: 'Lecture not found' });
  }
});

export const createLecture = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const newLecture: NewLecture = req.body;
  const result = await db.run(
    'INSERT INTO lectures (title, speakerId, subjectIds, year, duration, link) VALUES (?, ?, ?, ?, ?, ?)',
    newLecture.title,
    newLecture.speakerId,
    JSON.stringify(newLecture.subjectIds),
    newLecture.year,
    newLecture.duration || null,
    newLecture.link || null
  );
  res.status(201).json({ id: result.lastID, ...newLecture });
});

export const updateLecture = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const id = req.params.id;
  const updatedLecture: UpdateLecture = req.body;

  const fields: string[] = [];
  const values: any[] = [];

  if (updatedLecture.title !== undefined) { fields.push('title = ?'); values.push(updatedLecture.title); }
  if (updatedLecture.speakerId !== undefined) { fields.push('speakerId = ?'); values.push(updatedLecture.speakerId); }
  if (updatedLecture.subjectIds !== undefined) { fields.push('subjectIds = ?'); values.push(JSON.stringify(updatedLecture.subjectIds)); }
  if (updatedLecture.year !== undefined) { fields.push('year = ?'); values.push(updatedLecture.year); }
  if (updatedLecture.duration !== undefined) { fields.push('duration = ?'); values.push(updatedLecture.duration); }
  if (updatedLecture.link !== undefined) { fields.push('link = ?'); values.push(updatedLecture.link); }

  if (fields.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  const query = `UPDATE lectures SET ${fields.join(', ')} WHERE id = ?`;
  values.push(id);

  const result = await db.run(query, ...values);

  if (result.changes && result.changes > 0) {
    res.json({ message: 'Lecture updated successfully' });
  } else {
    res.status(404).json({ message: 'Lecture not found' });
  }
});

export const deleteLecture = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const result = await db.run('DELETE FROM lectures WHERE id = ?', req.params.id);
  if (result.changes && result.changes > 0) {
    res.status(204).send(); // No Content
  } else {
    res.status(404).json({ message: 'Lecture not found' });
  }
}); 