import { NextFunction, Request, Response } from 'express';
import { NewTopic, Topic, slugifyTopicName } from '@enzyklopaedie/shared';
import { getDb } from '../db';
import { recordActivityEvent } from '../lib/activity';
import { getOntologyTopic, getTopicSummaryById, listKnowledgeItemsForTopic, listTopicSummaries } from '../lib/topics';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const parseId = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const generateUniqueTopicSlug = async (name: string) => {
  const db = await getDb();
  const baseSlug = slugifyTopicName(name);
  let slug = baseSlug || 'topic';
  let suffix = 2;

  while (await db.get('SELECT id FROM topics WHERE slug = ?', slug)) {
    slug = `${baseSlug || 'topic'}-${suffix}`;
    suffix += 1;
  }

  return slug;
};

export const getAllTopics = asyncErrorHandler(async (_req: Request, res: Response) => {
  res.json(await listTopicSummaries());
});

export const getTopicById = asyncErrorHandler(async (req: Request, res: Response) => {
  const topicId = parseId(req.params.id);
  if (!topicId) {
    return res.status(400).json({ message: 'Invalid topic id' });
  }

  const topic = await getTopicSummaryById(topicId);
  if (!topic) {
    return res.status(404).json({ message: 'Topic not found' });
  }

  res.json(topic);
});

export const getKnowledgeItemsByTopic = asyncErrorHandler(async (req: Request, res: Response) => {
  const topicId = parseId(req.params.id);
  if (!topicId) {
    return res.status(400).json({ message: 'Invalid topic id' });
  }

  const topic = await getTopicSummaryById(topicId);
  if (!topic) {
    return res.status(404).json({ message: 'Topic not found' });
  }

  res.json(await listKnowledgeItemsForTopic(topicId));
});

export const createTopic = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const newTopic: NewTopic = req.body;
  const name = typeof newTopic.name === 'string' ? newTopic.name.trim() : '';

  if (!name) {
    return res.status(400).json({ message: 'Topic name is required' });
  }

  const requestedParentTopicId = newTopic.parentTopicId ? parseId(newTopic.parentTopicId) : null;
  if (newTopic.parentTopicId !== undefined && !requestedParentTopicId) {
    return res.status(400).json({ message: 'Invalid parent topic id' });
  }

  const isOntologyRoot = name.toLowerCase() === 'ontology';
  if (isOntologyRoot && requestedParentTopicId) {
    return res.status(400).json({ message: 'Ontology must remain the root topic' });
  }

  let parentTopicId = requestedParentTopicId;

  if (!parentTopicId && !isOntologyRoot) {
    const ontologyTopic = await getOntologyTopic();
    parentTopicId = ontologyTopic?.id ?? null;
  }

  if (parentTopicId) {
    const parent = await db.get('SELECT id FROM topics WHERE id = ?', parentTopicId);
    if (!parent) {
      return res.status(404).json({ message: 'Parent topic not found' });
    }
  }

  const existingTopic = await db.get<Topic>(
    'SELECT * FROM topics WHERE lower(name) = lower(?)',
    name
  );
  if (existingTopic) {
    return res.status(200).json(existingTopic);
  }

  const slug = await generateUniqueTopicSlug(name);
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO topics (name, slug, description, parentTopicId, color, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    name,
    slug,
    newTopic.description?.trim() || null,
    parentTopicId,
    newTopic.color?.trim() || null,
    now,
    now
  );

  const topic: Topic = {
    id: result.lastID as number,
    name,
    slug,
    description: newTopic.description?.trim() || undefined,
    parentTopicId: parentTopicId || undefined,
    color: newTopic.color?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };

  await recordActivityEvent({
    type: 'topic_created',
    entityType: 'topic',
    entityId: topic.id,
    message: `Created topic "${topic.name}"`,
    metadata: {
      slug: topic.slug,
      parentTopicId: topic.parentTopicId,
    },
  });

  res.status(201).json(topic);
});
