import { NextFunction, Request, Response } from 'express';
import { NewSubject, Subject, UpdateSubject, slugifyName } from '@enzyklopaedie/shared';
import { getDb } from '../db';
import { recordActivityEvent } from '../lib/activity';
import {
  getOntologySubject,
  getSubjectSummaryById,
  listKnowledgeItemsForSubject,
  listSubjectSummaries,
} from '../lib/subjects';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;
type SubjectRow = Omit<Subject, 'parentSubjectId'> & { parentTopicId?: number | null };

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const parseId = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const generateUniqueSubjectSlug = async (name: string, excludeSubjectId?: number) => {
  const db = await getDb();
  const baseSlug = slugifyName(name);
  let slug = baseSlug || 'subject';
  let suffix = 2;

  while (
    await db.get(
      excludeSubjectId
        ? 'SELECT id FROM topics WHERE slug = ? AND id != ?'
        : 'SELECT id FROM topics WHERE slug = ?',
      ...(excludeSubjectId ? [slug, excludeSubjectId] : [slug])
    )
  ) {
    slug = `${baseSlug || 'subject'}-${suffix}`;
    suffix += 1;
  }

  return slug;
};

const getDescendantIds = async (subjectId: number) => {
  const subjects = await listSubjectSummaries();
  const children = new Map<number | null, number[]>();

  for (const subject of subjects) {
    const key = subject.parentSubjectId ?? null;
    const branch = children.get(key) ?? [];
    branch.push(subject.id);
    children.set(key, branch);
  }

  const descendants = new Set<number>();
  const stack = [...(children.get(subjectId) ?? [])];

  while (stack.length > 0) {
    const currentId = stack.pop();
    if (!currentId || descendants.has(currentId)) continue;
    descendants.add(currentId);
    stack.push(...(children.get(currentId) ?? []));
  }

  return descendants;
};

export const getAllSubjects = asyncErrorHandler(async (_req: Request, res: Response) => {
  res.json(await listSubjectSummaries());
});

export const getSubjectById = asyncErrorHandler(async (req: Request, res: Response) => {
  const subjectId = parseId(req.params.id);
  if (!subjectId) {
    return res.status(400).json({ message: 'Invalid subject id' });
  }

  const subject = await getSubjectSummaryById(subjectId);
  if (!subject) {
    return res.status(404).json({ message: 'Subject not found' });
  }

  res.json(subject);
});

export const getKnowledgeItemsBySubject = asyncErrorHandler(async (req: Request, res: Response) => {
  const subjectId = parseId(req.params.id);
  if (!subjectId) {
    return res.status(400).json({ message: 'Invalid subject id' });
  }

  const subject = await getSubjectSummaryById(subjectId);
  if (!subject) {
    return res.status(404).json({ message: 'Subject not found' });
  }

  res.json(await listKnowledgeItemsForSubject(subjectId));
});

export const createSubject = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const newSubject: NewSubject = req.body;
  const name = typeof newSubject.name === 'string' ? newSubject.name.trim() : '';

  if (!name) {
    return res.status(400).json({ message: 'Subject name is required' });
  }

  const requestedParentSubjectId = newSubject.parentSubjectId ? parseId(newSubject.parentSubjectId) : null;
  if (newSubject.parentSubjectId !== undefined && !requestedParentSubjectId) {
    return res.status(400).json({ message: 'Invalid parent subject id' });
  }

  const isOntologyRoot = name.toLowerCase() === 'ontology';
  if (isOntologyRoot && requestedParentSubjectId) {
    return res.status(400).json({ message: 'Ontology must remain the root subject' });
  }

  let parentSubjectId = requestedParentSubjectId;

  if (!parentSubjectId && !isOntologyRoot) {
    const ontologySubject = await getOntologySubject();
    parentSubjectId = ontologySubject?.id ?? null;
  }

  if (parentSubjectId) {
    const parent = await db.get('SELECT id FROM topics WHERE id = ?', parentSubjectId);
    if (!parent) {
      return res.status(404).json({ message: 'Parent subject not found' });
    }
  }

  const existingSubject = await db.get<SubjectRow>(
    'SELECT * FROM topics WHERE lower(name) = lower(?)',
    name
  );
  if (existingSubject) {
    return res.status(200).json(await getSubjectSummaryById(existingSubject.id));
  }

  const slug = await generateUniqueSubjectSlug(name);
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO topics (name, slug, description, parentTopicId, color, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    name,
    slug,
    newSubject.description?.trim() || null,
    parentSubjectId,
    newSubject.color?.trim() || null,
    now,
    now
  );

  const subject: Subject = {
    id: result.lastID as number,
    name,
    slug,
    description: newSubject.description?.trim() || undefined,
    parentSubjectId: parentSubjectId || undefined,
    color: newSubject.color?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };

  await recordActivityEvent({
    type: 'subject_created',
    entityType: 'subject',
    entityId: subject.id,
    message: `Created subject "${subject.name}"`,
    metadata: {
      slug: subject.slug,
      parentSubjectId: subject.parentSubjectId,
    },
  });

  res.status(201).json(subject);
});

export const updateSubject = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const subjectId = parseId(req.params.id);
  if (!subjectId) {
    return res.status(400).json({ message: 'Invalid subject id' });
  }

  const existingSubject = await db.get<SubjectRow>('SELECT * FROM topics WHERE id = ?', subjectId);
  if (!existingSubject) {
    return res.status(404).json({ message: 'Subject not found' });
  }

  const updates: UpdateSubject = req.body ?? {};
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    const name = typeof updates.name === 'string' ? updates.name.trim() : '';
    if (!name) {
      return res.status(400).json({ message: 'Subject name is required' });
    }

    if (existingSubject.slug === 'ontology' && name.toLowerCase() !== 'ontology') {
      return res.status(400).json({ message: 'Ontology must remain the root subject' });
    }

    const duplicate = await db.get<SubjectRow>(
      'SELECT * FROM topics WHERE lower(name) = lower(?) AND id != ?',
      name,
      subjectId
    );
    if (duplicate) {
      return res.status(409).json({ message: 'A subject with that name already exists' });
    }

    const slug =
      existingSubject.slug === 'ontology' && name.toLowerCase() === 'ontology'
        ? 'ontology'
        : await generateUniqueSubjectSlug(name, subjectId);

    fields.push('name = ?', 'slug = ?');
    values.push(name, slug);
  }

  if (updates.description !== undefined) {
    const description =
      typeof updates.description === 'string' ? updates.description.trim() || null : null;
    fields.push('description = ?');
    values.push(description);
  }

  if (updates.parentSubjectId !== undefined) {
    const isOntology = existingSubject.slug === 'ontology';
    if (isOntology) {
      return res.status(400).json({ message: 'Ontology must remain the root subject' });
    }

    const requestedParentSubjectId =
      updates.parentSubjectId === null ? null : parseId(updates.parentSubjectId);

    if (updates.parentSubjectId !== null && !requestedParentSubjectId) {
      return res.status(400).json({ message: 'Invalid parent subject id' });
    }

    const ontologySubject = await getOntologySubject();
    const parentSubjectId = requestedParentSubjectId ?? ontologySubject?.id ?? null;

    if (!parentSubjectId) {
      return res.status(400).json({ message: 'A valid parent subject is required' });
    }

    if (parentSubjectId === subjectId) {
      return res.status(400).json({ message: 'A subject cannot become its own parent' });
    }

    const descendants = await getDescendantIds(subjectId);
    if (descendants.has(parentSubjectId)) {
      return res.status(400).json({ message: 'A subject cannot move under one of its descendants' });
    }

    const parent = await db.get<SubjectRow>('SELECT * FROM topics WHERE id = ?', parentSubjectId);
    if (!parent) {
      return res.status(404).json({ message: 'Parent subject not found' });
    }

    fields.push('parentTopicId = ?');
    values.push(parentSubjectId);
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
    subjectId
  );

  res.json(await getSubjectSummaryById(subjectId));
});

export const deleteSubject = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const subjectId = parseId(req.params.id);
  if (!subjectId) {
    return res.status(400).json({ message: 'Invalid subject id' });
  }

  const existingSubject = await db.get<SubjectRow>('SELECT * FROM topics WHERE id = ?', subjectId);
  if (!existingSubject) {
    return res.status(404).json({ message: 'Subject not found' });
  }

  if (existingSubject.slug === 'ontology') {
    return res.status(400).json({ message: 'Ontology must remain the root subject' });
  }

  const childSubject = await db.get('SELECT id FROM topics WHERE parentTopicId = ? LIMIT 1', subjectId);
  if (childSubject) {
    return res.status(409).json({ message: 'Remove child subjects before deleting this branch' });
  }

  const containedTopic = await db.get('SELECT id FROM study_topics WHERE subjectId = ? LIMIT 1', subjectId);
  if (containedTopic) {
    return res.status(409).json({ message: 'Remove or move this subject’s topics before deleting it' });
  }

  await db.run(
    `DELETE FROM knowledge_relations
     WHERE (fromEntityType = 'subject' AND fromEntityId = ?)
        OR (toEntityType = 'subject' AND toEntityId = ?)`,
    subjectId,
    subjectId
  );
  await db.run('DELETE FROM topics WHERE id = ?', subjectId);

  res.status(204).send();
});
