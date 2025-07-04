import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db';
import { Author, NewAuthor, UpdateAuthor } from '@enzyklopaedie/shared';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const getAllAuthors = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const authors = await db.all<Author[]>('SELECT * FROM authors');
  res.json(authors);
});

export const getAuthorById = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const author = await db.get<Author>('SELECT * FROM authors WHERE id = ?', req.params.id);
  if (author) {
    res.json(author);
  } else {
    res.status(404).json({ message: 'Author not found' });
  }
});

export const createAuthor = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const newAuthor: NewAuthor = req.body;
  const result = await db.run(
    'INSERT INTO authors (name, yearOfBirth, yearOfDeath, countryId, description, imageUrl, link, subjectIds) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    newAuthor.name,
    newAuthor.yearOfBirth,
    newAuthor.yearOfDeath || null,
    newAuthor.countryId,
    newAuthor.description || null,
    newAuthor.imageUrl || null,
    newAuthor.link || null,
    JSON.stringify(newAuthor.subjectIds)
  );
  res.status(201).json({ id: result.lastID, ...newAuthor });
});

export const updateAuthor = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const id = req.params.id;
  const updatedAuthor: UpdateAuthor = req.body;

  const fields: string[] = [];
  const values: any[] = [];

  if (updatedAuthor.name !== undefined) { fields.push('name = ?'); values.push(updatedAuthor.name); }
  if (updatedAuthor.yearOfBirth !== undefined) { fields.push('yearOfBirth = ?'); values.push(updatedAuthor.yearOfBirth); }
  if (updatedAuthor.yearOfDeath !== undefined) { fields.push('yearOfDeath = ?'); values.push(updatedAuthor.yearOfDeath); }
  if (updatedAuthor.countryId !== undefined) { fields.push('countryId = ?'); values.push(updatedAuthor.countryId); }
  if (updatedAuthor.description !== undefined) { fields.push('description = ?'); values.push(updatedAuthor.description); }
  if (updatedAuthor.imageUrl !== undefined) { fields.push('imageUrl = ?'); values.push(updatedAuthor.imageUrl); }
  if (updatedAuthor.link !== undefined) { fields.push('link = ?'); values.push(updatedAuthor.link); }
  if (updatedAuthor.subjectIds !== undefined) { fields.push('subjectIds = ?'); values.push(JSON.stringify(updatedAuthor.subjectIds)); }

  if (fields.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  const query = `UPDATE authors SET ${fields.join(', ')} WHERE id = ?`;
  values.push(id);

  const result = await db.run(query, ...values);

  if (result.changes && result.changes > 0) {
    res.json({ message: 'Author updated successfully' });
  } else {
    res.status(404).json({ message: 'Author not found' });
  }
});

export const deleteAuthor = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const result = await db.run('DELETE FROM authors WHERE id = ?', req.params.id);
  if (result.changes && result.changes > 0) {
    res.status(204).send(); // No Content
  } else {
    res.status(404).json({ message: 'Author not found' });
  }
}); 