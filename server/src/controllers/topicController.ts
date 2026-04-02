import { NextFunction, Request, Response } from 'express';
import { NewTopic, Topic, UpdateTopic, slugifyTopicName } from '@enzyklopaedie/shared';
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

const generateUniqueTopicSlug = async (name: string, excludeTopicId?: number) => {
  const db = await getDb();
  const baseSlug = slugifyTopicName(name);
  let slug = baseSlug || 'topic';
  let suffix = 2;

  while (
    await db.get(
      excludeTopicId
        ? 'SELECT id FROM topics WHERE slug = ? AND id != ?'
        : 'SELECT id FROM topics WHERE slug = ?',
      ...(excludeTopicId ? [slug, excludeTopicId] : [slug])
    )
  ) {
    slug = `${baseSlug || 'topic'}-${suffix}`;
    suffix += 1;
  }

  return slug;
};

const getDescendantIds = async (topicId: number) => {
  const topics = await listTopicSummaries();
  const children = new Map<number | null, number[]>();

  for (const topic of topics) {
    const key = topic.parentTopicId ?? null;
    const branch = children.get(key) ?? [];
    branch.push(topic.id);
    children.set(key, branch);
  }

  const descendants = new Set<number>();
  const stack = [...(children.get(topicId) ?? [])];

  while (stack.length > 0) {
    const currentId = stack.pop();
    if (!currentId || descendants.has(currentId)) continue;
    descendants.add(currentId);
    stack.push(...(children.get(currentId) ?? []));
  }

  return descendants;
};

export const getAllTopics = asyncErrorHandler(async (_req: Request, res: Response) => {
  res.json(await listTopicSummaries());
});

export const getTopicById = asyncErrorHandler(async (req: Request, res: Response) => {
  const topicId = parseId(req.params.id);
  if (!topicId) {
    return res.status(400).json({ message: 'Invalid subject id' });
  }

  const topic = await getTopicSummaryById(topicId);
  if (!topic) {
    return res.status(404).json({ message: 'Subject not found' });
  }

  res.json(topic);
});

export const getKnowledgeItemsByTopic = asyncErrorHandler(async (req: Request, res: Response) => {
  const topicId = parseId(req.params.id);
  if (!topicId) {
    return res.status(400).json({ message: 'Invalid subject id' });
  }

  const topic = await getTopicSummaryById(topicId);
  if (!topic) {
    return res.status(404).json({ message: 'Subject not found' });
  }

  res.json(await listKnowledgeItemsForTopic(topicId));
});

export const createTopic = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const newTopic: NewTopic = req.body;
  const name = typeof newTopic.name === 'string' ? newTopic.name.trim() : '';

  if (!name) {
    return res.status(400).json({ message: 'Subject name is required' });
  }

  const requestedParentTopicId = newTopic.parentTopicId ? parseId(newTopic.parentTopicId) : null;
  if (newTopic.parentTopicId !== undefined && !requestedParentTopicId) {
    return res.status(400).json({ message: 'Invalid parent subject id' });
  }

  const isOntologyRoot = name.toLowerCase() === 'ontology';
  if (isOntologyRoot && requestedParentTopicId) {
    return res.status(400).json({ message: 'Ontology must remain the root subject' });
  }

  let parentTopicId = requestedParentTopicId;

  if (!parentTopicId && !isOntologyRoot) {
    const ontologyTopic = await getOntologyTopic();
    parentTopicId = ontologyTopic?.id ?? null;
  }

  if (parentTopicId) {
    const parent = await db.get('SELECT id FROM topics WHERE id = ?', parentTopicId);
    if (!parent) {
      return res.status(404).json({ message: 'Parent subject not found' });
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
    type: 'subject_created',
    entityType: 'subject',
    entityId: topic.id,
    message: `Created subject "${topic.name}"`,
    metadata: {
      slug: topic.slug,
      parentTopicId: topic.parentTopicId,
    },
  });

  res.status(201).json(topic);
});

export const updateTopic = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const topicId = parseId(req.params.id);
  if (!topicId) {
    return res.status(400).json({ message: 'Invalid subject id' });
  }

  const existingTopic = await db.get<Topic>('SELECT * FROM topics WHERE id = ?', topicId);
  if (!existingTopic) {
    return res.status(404).json({ message: 'Subject not found' });
  }

  const updates: UpdateTopic = req.body ?? {};
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    const name = typeof updates.name === 'string' ? updates.name.trim() : '';
    if (!name) {
      return res.status(400).json({ message: 'Subject name is required' });
    }

    if (existingTopic.slug === 'ontology' && name.toLowerCase() !== 'ontology') {
      return res.status(400).json({ message: 'Ontology must remain the root subject' });
    }

    const duplicate = await db.get<Topic>(
      'SELECT * FROM topics WHERE lower(name) = lower(?) AND id != ?',
      name,
      topicId
    );
    if (duplicate) {
      return res.status(409).json({ message: 'A subject with that name already exists' });
    }

    const slug =
      existingTopic.slug === 'ontology' && name.toLowerCase() === 'ontology'
        ? 'ontology'
        : await generateUniqueTopicSlug(name, topicId);

    fields.push('name = ?', 'slug = ?');
    values.push(name, slug);
  }

  if (updates.description !== undefined) {
    const description =
      typeof updates.description === 'string' ? updates.description.trim() || null : null;
    fields.push('description = ?');
    values.push(description);
  }

  if (updates.parentTopicId !== undefined) {
    const isOntology = existingTopic.slug === 'ontology';
    if (isOntology) {
      return res.status(400).json({ message: 'Ontology must remain the root subject' });
    }

    const requestedParentTopicId =
      updates.parentTopicId === null ? null : parseId(updates.parentTopicId);

    if (updates.parentTopicId !== null && !requestedParentTopicId) {
      return res.status(400).json({ message: 'Invalid parent subject id' });
    }

    const ontologyTopic = await getOntologyTopic();
    const parentTopicId = requestedParentTopicId ?? ontologyTopic?.id ?? null;

    if (!parentTopicId) {
      return res.status(400).json({ message: 'A valid parent subject is required' });
    }

    if (parentTopicId === topicId) {
      return res.status(400).json({ message: 'A subject cannot become its own parent' });
    }

    const descendants = await getDescendantIds(topicId);
    if (descendants.has(parentTopicId)) {
      return res.status(400).json({ message: 'A subject cannot move under one of its descendants' });
    }

    const parent = await db.get<Topic>('SELECT * FROM topics WHERE id = ?', parentTopicId);
    if (!parent) {
      return res.status(404).json({ message: 'Parent subject not found' });
    }

    fields.push('parentTopicId = ?');
    values.push(parentTopicId);
  }

  if (updates.color !== undefined) {
    fields.push('color = ?');
    values.push(typeof updates.color === 'string' ? updates.color.trim() || null : null);
  }

  if (fields.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  const updatedAt = new Date().toISOString();
  await db.run(
    `UPDATE topics SET ${fields.join(', ')}, updatedAt = ? WHERE id = ?`,
    ...values,
    updatedAt,
    topicId
  );

  res.json(await getTopicSummaryById(topicId));
});

export const deleteTopic = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const topicId = parseId(req.params.id);
  if (!topicId) {
    return res.status(400).json({ message: 'Invalid subject id' });
  }

  const existingTopic = await db.get<Topic>('SELECT * FROM topics WHERE id = ?', topicId);
  if (!existingTopic) {
    return res.status(404).json({ message: 'Subject not found' });
  }

  if (existingTopic.slug === 'ontology') {
    return res.status(400).json({ message: 'Ontology must remain the root subject' });
  }

  const childSubject = await db.get('SELECT id FROM topics WHERE parentTopicId = ? LIMIT 1', topicId);
  if (childSubject) {
    return res.status(409).json({ message: 'Remove child subjects before deleting this branch' });
  }

  const containedTopic = await db.get('SELECT id FROM study_topics WHERE subjectId = ? LIMIT 1', topicId);
  if (containedTopic) {
    return res.status(409).json({ message: 'Remove or move this subject’s topics before deleting it' });
  }

  await db.run(
    `DELETE FROM knowledge_relations
     WHERE (fromEntityType = 'topic' AND fromEntityId = ?)
        OR (toEntityType = 'topic' AND toEntityId = ?)`,
    topicId,
    topicId
  );
  await db.run('DELETE FROM topics WHERE id = ?', topicId);

  res.status(204).send();
});
