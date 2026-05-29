import { NextFunction, Request, Response } from 'express';
import {
  isFormationSubtype,
  isBuiltInPolityEntity,
  type NewReferenceEntity,
  type PolitySnapshot,
  type ReferenceAuthoritySearchKind,
  type ReferenceAuthoritySearchMatch,
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
import {
  localEntityKindMap,
  localFormationSubtypeMap,
  searchWikidataCanonicalEntities,
} from '../lib/wikidataAuthority';

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

const isReferenceAuthoritySearchKind = (value: unknown): value is ReferenceAuthoritySearchKind =>
  value === 'person';

const parseId = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseLimit = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 10;
  }

  return Math.min(Math.max(Math.trunc(parsed), 1), 20);
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

const parseFormationSubtype = (value: unknown, kind: ReferenceEntityKind) => {
  if (kind !== 'formation') {
    return { provided: false as const, value: null };
  }

  if (value === undefined) {
    return { provided: false as const };
  }

  if (value === null || value === '') {
    return { provided: true as const, value: null };
  }

  if (!isFormationSubtype(value)) {
    return { provided: true as const, invalid: true as const };
  }

  return { provided: true as const, value };
};

const parseMetadata = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
};

const findExistingReferenceEntityByIdentity = async (
  db: Awaited<ReturnType<typeof getDb>>,
  kind: ReferenceEntityKind,
  title: string,
  formationSubtype: string | null,
  excludeId?: number
) => {
  if (kind === 'formation') {
    if (formationSubtype) {
      return db.get<ReferenceEntityRow>(
        `SELECT * FROM reference_entities
         WHERE kind = ? AND lower(title) = lower(?) AND formationSubtype = ?${excludeId ? ' AND id != ?' : ''}
         LIMIT 1`,
        ...(excludeId
          ? [kind, title, formationSubtype, excludeId]
          : [kind, title, formationSubtype])
      );
    }

    return db.get<ReferenceEntityRow>(
      `SELECT * FROM reference_entities
       WHERE kind = ? AND lower(title) = lower(?) AND formationSubtype IS NULL${excludeId ? ' AND id != ?' : ''}
       LIMIT 1`,
      ...(excludeId ? [kind, title, excludeId] : [kind, title])
    );
  }

  return db.get<ReferenceEntityRow>(
    `SELECT * FROM reference_entities
     WHERE kind = ? AND lower(title) = lower(?)${excludeId ? ' AND id != ?' : ''}
     LIMIT 1`,
    ...(excludeId ? [kind, title, excludeId] : [kind, title])
  );
};

const buildReferenceAuthorityMetadata = (match: ReferenceAuthoritySearchMatch) => ({
  ...(match.metadata ?? {}),
  atlasAuthority: match.authority,
  atlasAuthorityId: match.authorityId,
  atlasKind: match.kind,
  ...(match.sourceUrl ? { atlasSourceUrl: match.sourceUrl } : {}),
  ...(match.imageUrl ? { atlasImageUrl: match.imageUrl } : {}),
  authorityId: match.authorityId,
  authorityImageUrl: match.imageUrl,
  authorityKind: match.kind,
  authoritySource: match.authority,
  authoritySourceUrl: match.sourceUrl,
  importedFrom: 'reference-authority-search',
  wikidataId: match.authorityId,
});

const findExistingReferenceEntityByAuthorityOrIdentity = async (
  db: Awaited<ReturnType<typeof getDb>>,
  match: Pick<ReferenceAuthoritySearchMatch, 'authorityId' | 'formationSubtype' | 'kind' | 'title'>
) => {
  const candidateRows = await db.all<ReferenceEntityRow[]>(
    'SELECT * FROM reference_entities WHERE kind = ? ORDER BY lower(title) ASC, createdAt ASC',
    match.kind
  );

  for (const row of candidateRows) {
    const candidate = hydrateReferenceEntity(row);
    const metadata = candidate.metadata ?? {};
    if (
      metadata.authorityId === match.authorityId ||
      metadata.wikidataId === match.authorityId ||
      metadata.atlasAuthorityId === match.authorityId
    ) {
      return candidate;
    }
  }

  const row = await findExistingReferenceEntityByIdentity(
    db,
    match.kind,
    match.title,
    match.kind === 'formation' ? match.formationSubtype ?? null : null
  );

  return row ? hydrateReferenceEntity(row) : null;
};

const syncReferenceEntityAuthorityData = async (
  db: Awaited<ReturnType<typeof getDb>>,
  entity: ReferenceEntity,
  match: ReferenceAuthoritySearchMatch
) => {
  const metadata = {
    ...(entity.metadata ?? {}),
    ...buildReferenceAuthorityMetadata(match),
  };
  const summary = entity.summary ?? match.summary;
  const description = entity.description ?? match.description;
  const startYear = entity.startYear ?? match.startYear;
  const endYear = entity.endYear ?? match.endYear;
  const updatedAt = new Date().toISOString();

  await db.run(
    `UPDATE reference_entities
     SET summary = ?, description = ?, startYear = ?, endYear = ?, metadata = ?, updatedAt = ?
     WHERE id = ?`,
    summary ?? null,
    description ?? null,
    startYear ?? null,
    endYear ?? null,
    JSON.stringify(metadata),
    updatedAt,
    entity.id
  );

  return {
    ...entity,
    summary,
    description,
    startYear,
    endYear,
    metadata,
    updatedAt,
  } satisfies ReferenceEntity;
};

const getReferenceAuthoritySearchMatches = async (
  db: Awaited<ReturnType<typeof getDb>>,
  query: string,
  kind: ReferenceAuthoritySearchKind,
  limit: number
) => {
  const canonicalMatches = await searchWikidataCanonicalEntities({
    includeWikipediaSummary: true,
    kind: 'person',
    limit: Math.min(limit * 2, 20),
    query,
  });
  const matches: ReferenceAuthoritySearchMatch[] = [];

  for (const canonicalMatch of canonicalMatches) {
    const localKind = localEntityKindMap[canonicalMatch.kind];
    if (localKind !== kind) {
      continue;
    }

    const match: ReferenceAuthoritySearchMatch = {
      authority: canonicalMatch.authority,
      authorityId: canonicalMatch.authorityId,
      kind: localKind,
      formationSubtype: localFormationSubtypeMap[canonicalMatch.kind],
      title: canonicalMatch.title,
      summary: canonicalMatch.summary,
      description: canonicalMatch.description,
      startYear: canonicalMatch.startYear,
      endYear: canonicalMatch.endYear,
      imageUrl: canonicalMatch.imageUrl,
      sourceUrl: canonicalMatch.sourceUrl,
      metadata: {
        ...(canonicalMatch.metadata ?? {}),
        canonicalAtlasKind: canonicalMatch.kind,
      },
    };

    const existing = await findExistingReferenceEntityByAuthorityOrIdentity(db, match);
    matches.push({
      ...match,
      existingReferenceEntityId: existing?.id,
      existingReferenceEntitySlug: existing?.slug,
    });

    if (matches.length >= limit) {
      break;
    }
  }

  return matches;
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

export const searchReferenceEntityAuthority = asyncErrorHandler(async (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const requestedKind = req.query.kind;

  if (!query) {
    return res.status(400).json({ message: 'A search query is required.' });
  }

  if (requestedKind !== undefined && !isReferenceAuthoritySearchKind(requestedKind)) {
    return res.status(400).json({
      message: 'Reference authority search is currently limited to people.',
    });
  }

  const db = await getDb();
  const kind = requestedKind === undefined ? 'person' : requestedKind;
  const limit = parseLimit(req.query.limit);

  try {
    res.json(await getReferenceAuthoritySearchMatches(db, query, kind, limit));
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 502;
    const message = error instanceof Error ? error.message : 'Failed to search Wikidata.';
    res.status(status).json({ message });
  }
});

export const importReferenceEntityAuthority = asyncErrorHandler(async (req: Request, res: Response) => {
  const payload = req.body as Partial<ReferenceAuthoritySearchMatch>;

  if (payload.authority !== 'wikidata') {
    return res.status(400).json({ message: 'A supported authority is required.' });
  }

  if (!isReferenceEntityKind(payload.kind)) {
    return res.status(400).json({ message: 'A valid reference entity kind is required.' });
  }

  if (payload.kind !== 'person') {
    return res.status(400).json({
      message: 'Reference authority import is currently limited to people.',
    });
  }

  const authorityId = typeof payload.authorityId === 'string' ? payload.authorityId.trim() : '';
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  if (!authorityId || !title) {
    return res.status(400).json({ message: 'Authority id and title are required.' });
  }

  const match: ReferenceAuthoritySearchMatch = {
    authority: 'wikidata',
    authorityId,
    kind: payload.kind,
    title,
    summary: typeof payload.summary === 'string' ? payload.summary.trim() || undefined : undefined,
    description:
      typeof payload.description === 'string' ? payload.description.trim() || undefined : undefined,
    startYear: Number.isInteger(payload.startYear) ? payload.startYear : undefined,
    endYear: Number.isInteger(payload.endYear) ? payload.endYear : undefined,
    imageUrl: typeof payload.imageUrl === 'string' ? payload.imageUrl.trim() || undefined : undefined,
    sourceUrl: typeof payload.sourceUrl === 'string' ? payload.sourceUrl.trim() || undefined : undefined,
    metadata: parseMetadata(payload.metadata),
  };

  const db = await getDb();
  const existing = await findExistingReferenceEntityByAuthorityOrIdentity(db, match);
  if (existing) {
    const referenceEntity = await syncReferenceEntityAuthorityData(db, existing, match);
    return res.json({
      created: false,
      referenceEntity,
    });
  }

  const slug = await generateUniqueReferenceEntitySlug(db, match.kind, match.title);
  const now = new Date().toISOString();
  const metadata = buildReferenceAuthorityMetadata(match);
  const result = await db.run(
    `INSERT INTO reference_entities
      (kind, formationSubtype, title, slug, summary, description, startYear, endYear, metadata, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    match.kind,
    match.kind === 'formation' ? match.formationSubtype ?? null : null,
    match.title,
    slug,
    match.summary ?? null,
    match.description ?? null,
    match.startYear ?? null,
    match.endYear ?? null,
    JSON.stringify(metadata),
    now,
    now
  );

  const referenceEntity: ReferenceEntity = {
    id: result.lastID as number,
    kind: match.kind,
    formationSubtype: match.kind === 'formation' ? match.formationSubtype : undefined,
    title: match.title,
    slug,
    summary: match.summary,
    description: match.description,
    startYear: match.startYear,
    endYear: match.endYear,
    metadata,
    createdAt: now,
    updatedAt: now,
  };

  await recordActivityEvent({
    type: 'reference_entity_created',
    entityType: 'reference_entity',
    entityId: referenceEntity.id,
    message: `Imported ${referenceEntity.kind} "${referenceEntity.title}" from Wikidata`,
    metadata: {
      authority: match.authority,
      authorityId: match.authorityId,
      kind: referenceEntity.kind,
      slug: referenceEntity.slug,
    },
  });

  res.status(201).json({
    created: true,
    referenceEntity,
  });
});

export const createReferenceEntity = asyncErrorHandler(async (req: Request, res: Response) => {
  const db = await getDb();
  const newEntity: NewReferenceEntity = req.body;

  if (!isReferenceEntityKind(newEntity.kind)) {
    return res.status(400).json({ message: 'Invalid reference entity kind' });
  }

  if (newEntity.kind === 'polity') {
    return res.status(400).json({
      message: 'Polities are map-backed records seeded by the world history importer.',
    });
  }

  const title = typeof newEntity.title === 'string' ? newEntity.title.trim() : '';
  if (!title) {
    return res.status(400).json({ message: 'Reference entity title is required' });
  }

  const startYear = parseOptionalYear(newEntity.startYear);
  const endYear = parseOptionalYear(newEntity.endYear);
  const formationSubtype = parseFormationSubtype(newEntity.formationSubtype, newEntity.kind);
  if (formationSubtype.invalid) {
    return res.status(400).json({ message: 'Invalid formation subtype' });
  }
  if (startYear.invalid || endYear.invalid) {
    return res.status(400).json({ message: 'Invalid reference entity year' });
  }

  const existing = await findExistingReferenceEntityByIdentity(
    db,
    newEntity.kind,
    title,
    formationSubtype.value ?? null
  );
  if (existing) {
    return res.status(200).json(hydrateReferenceEntity(existing));
  }

  const slug = await generateUniqueReferenceEntitySlug(db, newEntity.kind, title);
  const now = new Date().toISOString();
  const result = await db.run(
    `INSERT INTO reference_entities
      (kind, formationSubtype, title, slug, summary, description, startYear, endYear, metadata, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newEntity.kind,
    formationSubtype.value ?? null,
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
    formationSubtype: formationSubtype.value ?? undefined,
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
      formationSubtype: entity.formationSubtype,
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
  if (existing.kind === 'polity') {
    return res.status(400).json({
      message: 'Polities are read-only map-backed records seeded by the world history importer.',
    });
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
    if (updatedEntity.kind === 'polity') {
      return res.status(400).json({
        message: 'Polities are map-backed records seeded by the world history importer.',
      });
    }
    nextKind = updatedEntity.kind;
    fields.push('kind = ?');
    values.push(nextKind);
  }

  const formationSubtype = parseFormationSubtype(updatedEntity.formationSubtype, nextKind);
  if (formationSubtype.invalid) {
    return res.status(400).json({ message: 'Invalid formation subtype' });
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

  if (nextKind === 'formation') {
    if (formationSubtype.provided) {
      fields.push('formationSubtype = ?');
      values.push(formationSubtype.value ?? null);
    }
  } else if (existing.formationSubtype !== undefined) {
    fields.push('formationSubtype = ?');
    values.push(null);
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

  const nextFormationSubtype =
    nextKind === 'formation'
      ? (formationSubtype.provided
          ? formationSubtype.value ?? null
          : existing.formationSubtype ?? null)
      : null;

  const conflictingEntity = await findExistingReferenceEntityByIdentity(
    db,
    nextKind,
    nextTitle,
    nextFormationSubtype,
    id
  );
  if (conflictingEntity) {
    return res.status(409).json({ message: 'A reference entity with this identity already exists' });
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
      formationSubtype: entity.formationSubtype,
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
