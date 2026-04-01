import { Request, Response, NextFunction } from 'express';
import { getDb } from '../db';
import { ActivityEvent } from '@enzyklopaedie/shared';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

type ActivityEventRow = Omit<ActivityEvent, 'metadata'> & {
  metadata?: string | null;
};

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const parseMetadata = (value?: string | null) => {
  if (!value) return undefined;

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch (error) {
    return undefined;
  }
};

const hydrateActivityEvent = (row: ActivityEventRow): ActivityEvent => ({
  ...row,
  metadata: parseMetadata(row.metadata),
});

export const getAllActivityEvents = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const requestedLimit = Number(req.query.limit);
  const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 100)
    : 25;

  const rows = await db.all<ActivityEventRow[]>(
    'SELECT * FROM activity_events ORDER BY occurredAt DESC LIMIT ?',
    limit
  );

  res.json(rows.map(hydrateActivityEvent));
});
