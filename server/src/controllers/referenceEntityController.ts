import { NextFunction, Request, Response } from 'express';
import {
  isBuiltInPolityEntity,
  type NewReferenceEntity,
  type PolitySnapshot,
  type ReferenceEntity,
  type ReferenceEntityKind,
  type UpdateReferenceEntity,
} from '@enzyklopaedie/shared';
import { getDb } from '../db';
import { recordActivityEvent } from '../lib/activity';
import { listKnowledgeRelationsByTarget } from '../lib/knowledgeRelations';
import {
  generateUniqueReferenceEntitySlug,
  hydrateReferenceEntity,
} from '../lib/referenceEntities';
import { listPolitySnapshotsByReferenceEntity } from '../lib/politySnapshots';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

type ReferenceEntityRow = Omit<ReferenceEntity, 'metadata'> & {
  metadata?: string | null;
};

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const isReferenceEntityKind = (value: unknown): value is ReferenceEntityKind =>
  value === 'person' ||
  value === 'polity' ||
  value === 'formation';

const parseId = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseOptionalYear = (value: unknown) => {
  if (value === undefined) return { provided: false as const };
  if (value === null || value === '') return { provided: true as const, value: null };

  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return { provided: true as const, invalid: true as const };
  }

  return { provided: true as const, value: parsed };
};

export const getAllReferenceEntities = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const requestedKind = req.query.kind;

  if (requestedKind !== undefined && !isReferenceEntityKind(requestedKind)) {
    return res.status(400).json({ message: 'Invalid reference entity kind' });
  }

  const rows = requestedKind
    ? await db.all<ReferenceEntityRow[]>(
        'SELECT * FROM reference_entities WHERE kind = ? ORDER BY lower(title) ASC, createdAt ASC',
        requestedKind
      )
    : await db.all<ReferenceEntityRow[]>(
        'SELECT * FROM reference_entities ORDER BY kind ASC, lower(title) ASC, createdAt ASC'
      );

  res.json(rows.map(hydrateReferenceEntity));
});

export const getReferenceEntityById = asyncErrorHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ message: 'Invalid reference entity id' });
  }

  const db = await getDb();
  const row = await db.get<ReferenceEntityRow>('SELECT * FROM reference_entities WHERE id = ?', id);

  if (!row) {
    return res.status(404).json({ message: 'Reference entity not found' });
  }

  res.json(hydrateReferenceEntity(row));
});

export const getRelationsByReferenceEntity = asyncErrorHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ message: 'Invalid reference entity id' });
  }

  const db = await getDb();
  const row = await db.get<ReferenceEntityRow>('SELECT * FROM reference_entities WHERE id = ?', id);

  if (!row) {
    return res.status(404).json({ message: 'Reference entity not found' });
  }

  res.json(await listKnowledgeRelationsByTarget('reference_entity', id));
});

export const getPolitySnapshotsByReferenceEntity = asyncErrorHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ message: 'Invalid reference entity id' });
  }

  const db = await getDb();
  const row = await db.get<ReferenceEntityRow>('SELECT * FROM reference_entities WHERE id = ?', id);

  if (!row) {
    return res.status(404).json({ message: 'Reference entity not found' });
  }

  const entity = hydrateReferenceEntity(row);
  if (entity.kind !== 'polity') {
    return res.json([] satisfies PolitySnapshot[]);
  }

  res.json(await listPolitySnapshotsByReferenceEntity(db, id));
});

export const createReferenceEntity = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const newEntity: NewReferenceEntity = req.body;

  if (!isReferenceEntityKind(newEntity.kind)) {
    return res.status(400).json({ message: 'Invalid reference entity kind' });
  }

  const title = typeof newEntity.title === 'string' ? newEntity.title.trim() : '';
  if (!title) {
    return res.status(400).json({ message: 'Reference entity title is required' });
  }

  const startYear = parseOptionalYear(newEntity.startYear);
  const endYear = parseOptionalYear(newEntity.endYear);
  if (startYear.invalid || endYear.invalid) {
    return res.status(400).json({ message: 'Invalid reference entity year' });
  }

  const existing = await db.get<ReferenceEntityRow>(
    'SELECT * FROM reference_entities WHERE kind = ? AND lower(title) = lower(?)',
    newEntity.kind,
    title
  );
  if (existing) {
    return res.status(200).json(hydrateReferenceEntity(existing));
  }

  const slug = await generateUniqueReferenceEntitySlug(db, newEntity.kind, title);
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO reference_entities
      (kind, title, slug, summary, description, startYear, endYear, metadata, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newEntity.kind,
    title,
    slug,
    newEntity.summary?.trim() || null,
    newEntity.description?.trim() || null,
    startYear.value ?? null,
    endYear.value ?? null,
    newEntity.metadata ? JSON.stringify(newEntity.metadata) : null,
    now,
    now
  );

  const entity: ReferenceEntity = {
    id: result.lastID as number,
    kind: newEntity.kind,
    title,
    slug,
    summary: newEntity.summary?.trim() || undefined,
    description: newEntity.description?.trim() || undefined,
    startYear: startYear.value ?? undefined,
    endYear: endYear.value ?? undefined,
    metadata: newEntity.metadata,
    createdAt: now,
    updatedAt: now,
  };

  await recordActivityEvent({
    type: 'reference_entity_created',
    entityType: 'reference_entity',
    entityId: entity.id,
    message: `Created ${entity.kind} "${entity.title}"`,
    metadata: {
      kind: entity.kind,
      slug: entity.slug,
    },
  });

  res.status(201).json(entity);
});

export const updateReferenceEntity = asyncErrorHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ message: 'Invalid reference entity id' });
  }

  const db = await getDb();
  const existingRow = await db.get<ReferenceEntityRow>(
    'SELECT * FROM reference_entities WHERE id = ?',
    id
  );
  if (!existingRow) {
    return res.status(404).json({ message: 'Reference entity not found' });
  }

  const existing = hydrateReferenceEntity(existingRow);
  const updatedEntity: UpdateReferenceEntity = req.body;
  const isLockedBuiltInPolity = isBuiltInPolityEntity(existing);

  if (isLockedBuiltInPolity) {
    const requestedTitle =
      typeof updatedEntity.title === 'string' ? updatedEntity.title.trim() : existing.title;
    const requestedKind = updatedEntity.kind ?? existing.kind;
    const requestedStartYear =
      updatedEntity.startYear === undefined ? existing.startYear : updatedEntity.startYear ?? undefined;
    const requestedEndYear =
      updatedEntity.endYear === undefined ? existing.endYear : updatedEntity.endYear ?? undefined;

    if (
      requestedKind !== existing.kind ||
      requestedTitle !== existing.title ||
      requestedStartYear !== existing.startYear ||
      requestedEndYear !== existing.endYear
    ) {
      return res.status(400).json({
        message: 'Built-in polities keep their identity and timeline from the historical atlas.',
      });
    }
  }

  const fields: string[] = [];
  const values: Array<string | number | null> = [];
  const startYear = parseOptionalYear(updatedEntity.startYear);
  const endYear = parseOptionalYear(updatedEntity.endYear);

  if (startYear.invalid || endYear.invalid) {
    return res.status(400).json({ message: 'Invalid reference entity year' });
  }

  let nextKind = existing.kind;
  if (updatedEntity.kind !== undefined) {
    if (!isReferenceEntityKind(updatedEntity.kind)) {
      return res.status(400).json({ message: 'Invalid reference entity kind' });
    }
    nextKind = updatedEntity.kind;
    fields.push('kind = ?');
    values.push(nextKind);
  }

  let nextTitle = existing.title;
  if (updatedEntity.title !== undefined) {
    const title = updatedEntity.title.trim();
    if (!title) {
      return res.status(400).json({ message: 'Reference entity title is required' });
    }
    nextTitle = title;
    fields.push('title = ?');
    values.push(nextTitle);
  }

  if (updatedEntity.summary !== undefined) {
    fields.push('summary = ?');
    values.push(updatedEntity.summary ? updatedEntity.summary.trim() : null);
  }

  if (updatedEntity.description !== undefined) {
    fields.push('description = ?');
    values.push(updatedEntity.description ? updatedEntity.description.trim() : null);
  }

  if (startYear.provided) {
    fields.push('startYear = ?');
    values.push(startYear.value ?? null);
  }

  if (endYear.provided) {
    fields.push('endYear = ?');
    values.push(endYear.value ?? null);
  }

  if (updatedEntity.metadata !== undefined) {
    fields.push('metadata = ?');
    values.push(updatedEntity.metadata ? JSON.stringify(updatedEntity.metadata) : null);
  }

  if (nextKind !== existing.kind || nextTitle !== existing.title) {
    const slug = await generateUniqueReferenceEntitySlug(db, nextKind, nextTitle, id);
    fields.push('slug = ?');
    values.push(slug);
  }

  if (fields.length === 0) {
    return res.status(400).json({ message: 'No fields to update' });
  }

  const updatedAt = new Date().toISOString();
  fields.push('updatedAt = ?');
  values.push(updatedAt, id);

  await db.run(
    `UPDATE reference_entities SET ${fields.join(', ')} WHERE id = ?`,
    ...values
  );

  const row = await db.get<ReferenceEntityRow>('SELECT * FROM reference_entities WHERE id = ?', id);
  if (!row) {
    return res.status(404).json({ message: 'Reference entity not found' });
  }

  const entity = hydrateReferenceEntity(row);

  await recordActivityEvent({
    type: 'reference_entity_updated',
    entityType: 'reference_entity',
    entityId: entity.id,
    message: `Updated ${entity.kind} "${entity.title}"`,
    metadata: {
      kind: entity.kind,
      slug: entity.slug,
    },
  });

  res.json(entity);
});

export const deleteReferenceEntity = asyncErrorHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ message: 'Invalid reference entity id' });
  }

  const db = await getDb();
  const existingRow = await db.get<ReferenceEntityRow>(
    'SELECT * FROM reference_entities WHERE id = ?',
    id
  );

  if (!existingRow) {
    return res.status(404).json({ message: 'Reference entity not found' });
  }

  const existing = hydrateReferenceEntity(existingRow);
  if (isBuiltInPolityEntity(existing)) {
    return res.status(400).json({
      message: 'Built-in polities come from the historical atlas importer and cannot be removed.',
    });
  }

  await db.run(
    `DELETE FROM knowledge_relations
     WHERE (fromEntityType = 'reference_entity' AND fromEntityId = ?)
        OR (toEntityType = 'reference_entity' AND toEntityId = ?)`,
    id,
    id
  );
  await db.run(
    `DELETE FROM formation_memberships
     WHERE formationEntityId = ? OR polityEntityId = ?`,
    id,
    id
  );
  await db.run('DELETE FROM polity_snapshots WHERE referenceEntityId = ?', id);
  const result = await db.run('DELETE FROM reference_entities WHERE id = ?', id);

  if (!result.changes) {
    return res.status(404).json({ message: 'Reference entity not found' });
  }

  res.status(204).send();
});
