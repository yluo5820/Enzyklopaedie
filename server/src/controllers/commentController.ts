import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db';
import { Comment, NewComment, UpdateComment } from '@enzyklopaedie/shared';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const getAllComments = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const comments = await db.all<Comment[]>('SELECT * FROM comments');
  res.json(comments);
});

export const getCommentById = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const comment = await db.get<Comment>('SELECT * FROM comments WHERE id = ?', req.params.id);
  if (comment) {
    res.json(comment);
  } else {
    res.status(404).json({ message: 'Comment not found' });
  }
});

export const getCommentsByParent = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const { parentId, parentType } = req.query;
  const comments = await db.all<Comment[]>(
    'SELECT * FROM comments WHERE parentId = ? AND parentType = ?',
    parentId,
    parentType
  );
  res.json(comments);
});

export const createComment = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const newComment: NewComment = req.body;
  const timestamp = new Date().toISOString();
  const result = await db.run(
    'INSERT INTO comments (parentId, parentType, content, timestamp) VALUES (?, ?, ?, ?)',
    newComment.parentId,
    newComment.parentType,
    newComment.content,
    timestamp
  );
  res.status(201).json({ id: result.lastID, ...newComment, timestamp });
});

export const updateComment = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const id = req.params.id;
  const updatedComment: UpdateComment = req.body;

  const fields: string[] = [];
  const values: any[] = [];

  if (updatedComment.parentId !== undefined) { fields.push('parentId = ?'); values.push(updatedComment.parentId); }
  if (updatedComment.parentType !== undefined) { fields.push('parentType = ?'); values.push(updatedComment.parentType); }
  if (updatedComment.content !== undefined) { fields.push('content = ?'); values.push(updatedComment.content); }
  if (updatedComment.timestamp !== undefined) { fields.push('timestamp = ?'); values.push(updatedComment.timestamp); }

  if (fields.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  const query = `UPDATE comments SET ${fields.join(', ')} WHERE id = ?`;
  values.push(id);

  const result = await db.run(query, ...values);

  if (result.changes && result.changes > 0) {
    res.json({ message: 'Comment updated successfully' });
  } else {
    res.status(404).json({ message: 'Comment not found' });
  }
});

export const deleteComment = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const result = await db.run('DELETE FROM comments WHERE id = ?', req.params.id);
  if (result.changes && result.changes > 0) {
    res.status(204).send(); // No Content
  } else {
    res.status(404).json({ message: 'Comment not found' });
  }
}); 