import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db';
import { Book, NewBook, UpdateBook } from '@enzyklopaedie/shared';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const getAllBooks =  asyncErrorHandler(async (req: Request, res: Response) => {
    const db = await getDb();
    const books = await db.all<Book[]>('SELECT * FROM books');
    res.json(books);
});

export const getBookById = asyncErrorHandler(async (req: Request, res: Response) => {
    const db = await getDb();
    const book = await db.get<Book>('SELECT * FROM books WHERE id = ?', req.params.id);
    if (book) {
      res.json(book);
    } else {
      res.status(404).json({ message: 'Book not found' });
    }
});

export const createBook = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const newBook: NewBook = req.body;
  const result = await db.run(
    'INSERT INTO books (title, authorId, subjectIds, year, pages, isRead, rating, coverImageUrl, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    newBook.title,
      newBook.authorId,
      JSON.stringify(newBook.subjectIds),
      newBook.year,
      newBook.pages || null,
      newBook.isRead ? 1 : 0,
      newBook.rating || null,
      newBook.coverImageUrl || null,
      newBook.description || null
    );
    res.status(201).json({ id: result.lastID, ...newBook });
});

export const updateBook = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const id = req.params.id;
  const updatedBook: UpdateBook = req.body;

    const fields: string[] = [];
    const values: any[] = [];

    if (updatedBook.title !== undefined) { fields.push('title = ?'); values.push(updatedBook.title); }
    if (updatedBook.authorId !== undefined) { fields.push('authorId = ?'); values.push(updatedBook.authorId); }
    if (updatedBook.subjectIds !== undefined) { fields.push('subjectIds = ?'); values.push(JSON.stringify(updatedBook.subjectIds)); }
    if (updatedBook.year !== undefined) { fields.push('year = ?'); values.push(updatedBook.year); }
    if (updatedBook.pages !== undefined) { fields.push('pages = ?'); values.push(updatedBook.pages); }
    if (updatedBook.isRead !== undefined) { fields.push('isRead = ?'); values.push(updatedBook.isRead ? 1 : 0); }
    if (updatedBook.rating !== undefined) { fields.push('rating = ?'); values.push(updatedBook.rating); }
    if (updatedBook.coverImageUrl !== undefined) { fields.push('coverImageUrl = ?'); values.push(updatedBook.coverImageUrl); }
    if (updatedBook.description !== undefined) { fields.push('description = ?'); values.push(updatedBook.description); }

    if (fields.length === 0) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    const query = `UPDATE books SET ${fields.join(', ')} WHERE id = ?`;
    values.push(id);

    const result = await db.run(query, ...values);

    if (result.changes && result.changes > 0) {
      res.json({ message: 'Book updated successfully' });
    } else {
      res.status(404).json({ message: 'Book not found' });
    }
});


export const deleteBook = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const result = await db.run('DELETE FROM books WHERE id = ?', req.params.id);
  if (result.changes && result.changes > 0) {
    res.status(204).send(); // No Content
  } else {
    res.status(404).json({ message: 'Book not found' });
  }
});