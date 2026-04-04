import { Request, Response } from 'express';
import { resetDatabase } from '../db';

const ensureDevelopmentMode = (res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    res.status(403).json({ message: 'Development reset is disabled in production.' });
    return false;
  }

  return true;
};

export const resetDevelopmentData = async (_req: Request, res: Response) => {
  if (!ensureDevelopmentMode(res)) return;

  try {
    const result = await resetDatabase();
    return res.json({
      ...result,
      message:
        'Development data cleared. Only Ontology and Unknown Author were re-seeded.',
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Failed to reset development data.' });
  }
};
