import { NextFunction, Request, Response } from 'express';
import {
  isBuiltInPolityEntity,
  type CanonicalHistoricalEntity,
  type CanonicalHistoricalSearchMatch,
  type FormationSubtype,
  type HistoricalBasemapPolityMatchResponse,
  type NewCanonicalHistoricalEntity,
  type ReferenceEntity,
  type ReferenceEntityKind,
} from '@enzyklopaedie/shared';
import { getDb } from '../db';
import { recordActivityEvent } from '../lib/activity';
import {
  hydrateCanonicalHistoricalEntity,
  listCanonicalHistoricalEntities,
  upsertCanonicalHistoricalEntity,
} from '../lib/canonicalHistoricalEntities';
import {
  DEFAULT_HISTORICAL_BASEMAPS_CUTOFF_YEAR,
  getHistoricalBasemapLayer,
  getHistoricalBasemapManifest,
} from '../lib/historicalBasemaps';
import {
  generateUniqueReferenceEntitySlug,
  hydrateReferenceEntity,
} from '../lib/referenceEntities';
import { findPolitySnapshotMatch } from '../lib/politySnapshots';
import { listPersonSubjectMembershipsForPeople } from '../lib/personSubjectMemberships';
import {
  isCanonicalHistoricalEntityKind,
  localEntityKindMap,
  localFormationSubtypeMap,
  searchWikidataCanonicalEntities,
} from '../lib/wikidataAuthority';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<any>;

type CanonicalHistoricalEntityRow = Omit<CanonicalHistoricalEntity, 'metadata'> & {
  metadata?: string | null;
};

type ReferenceEntityRow = Omit<ReferenceEntity, 'metadata'> & {
  metadata?: string | null;
};

type CanonicalHistoricalGeometryRow = {
  canonicalHistoricalEntityId: number;
  source: 'wikimedia_commons_map';
  geojson: string;
  createdAt: string;
  updatedAt: string;
};

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

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

const parseYear = (value: unknown) => {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
};

const parseIdList = (value: unknown) => {
  const raw = Array.isArray(value) ? value.join(',') : typeof value === 'string' ? value : '';
  if (!raw.trim()) {
    return [];
  }

  return [...new Set(
    raw
      .split(',')
      .map((entry) => Number(entry.trim()))
      .filter((entry) => Number.isInteger(entry) && entry > 0)
  )];
};

const parseMetadata = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
};

const findExistingReferenceEntityByKindAndTitle = async (
  db: Awaited<ReturnType<typeof getDb>>,
  kind: ReferenceEntityKind,
  title: string,
  formationSubtype?: FormationSubtype
) => {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) return null;

  const row =
    kind === 'formation' && formationSubtype
      ? await db.get<ReferenceEntityRow>(
          `SELECT * FROM reference_entities
           WHERE kind = ? AND lower(title) = lower(?) AND formationSubtype = ?
           LIMIT 1`,
          kind,
          normalizedTitle,
          formationSubtype
        )
      : await db.get<ReferenceEntityRow>(
          `SELECT * FROM reference_entities
           WHERE kind = ? AND lower(title) = lower(?)
           LIMIT 1`,
          kind,
          normalizedTitle
        );

  return row ? hydrateReferenceEntity(row) : null;
};

const buildAtlasReferenceEntityMetadata = (canonicalEntity: CanonicalHistoricalEntity) => ({
  atlasAuthority: canonicalEntity.authority,
  atlasAuthorityId: canonicalEntity.authorityId,
  atlasKind: canonicalEntity.kind,
  ...(canonicalEntity.sourceUrl ? { atlasSourceUrl: canonicalEntity.sourceUrl } : {}),
  ...(canonicalEntity.imageUrl ? { atlasImageUrl: canonicalEntity.imageUrl } : {}),
  ...(canonicalEntity.latitude !== undefined && canonicalEntity.longitude !== undefined
    ? {
        atlasCoordinates: {
          latitude: canonicalEntity.latitude,
          longitude: canonicalEntity.longitude,
        },
      }
    : {}),
});

const syncReferenceEntityAtlasMetadata = async (
  db: Awaited<ReturnType<typeof getDb>>,
  entity: ReferenceEntity,
  canonicalEntity: CanonicalHistoricalEntity
) => {
  const mergedMetadata = {
    ...(entity.metadata ?? {}),
    ...buildAtlasReferenceEntityMetadata(canonicalEntity),
  };

  const currentMetadataJson = JSON.stringify(entity.metadata ?? null);
  const mergedMetadataJson = JSON.stringify(mergedMetadata);
  if (currentMetadataJson === mergedMetadataJson) {
    return entity;
  }

  const updatedAt = new Date().toISOString();
  await db.run(
    `UPDATE reference_entities
     SET metadata = ?, updatedAt = ?
     WHERE id = ?`,
    mergedMetadataJson,
    updatedAt,
    entity.id
  );

  return {
    ...entity,
    metadata: mergedMetadata,
    updatedAt,
  };
};

const isVisibleInYear = (entity: CanonicalHistoricalEntity, year: number | null) => {
  if (year === null) return true;
  if (entity.startYear !== undefined && entity.endYear !== undefined) {
    return year >= entity.startYear && year <= entity.endYear;
  }
  if (entity.startYear !== undefined) {
    return year >= entity.startYear;
  }
  if (entity.endYear !== undefined) {
    return year <= entity.endYear;
  }
  return true;
};

export const getCanonicalHistoricalEntities = asyncErrorHandler(async (req: Request, res: Response) => {
  const requestedKind = req.query.kind;
  const year = parseYear(req.query.year);

  if (
    requestedKind !== undefined &&
    requestedKind !== 'all' &&
    !isCanonicalHistoricalEntityKind(requestedKind)
  ) {
    return res.status(400).json({ message: 'Invalid atlas entity kind' });
  }

  const db = await getDb();
  const entities = await listCanonicalHistoricalEntities(db);

  const filtered = entities.filter((entity) => {
    if (requestedKind && requestedKind !== 'all' && entity.kind !== requestedKind) {
      return false;
    }

    return isVisibleInYear(entity, year);
  });

  res.json(filtered);
});

export const getWorldHistoryPersonSubjectMemberships = asyncErrorHandler(
  async (req: Request, res: Response) => {
    const personEntityIds = parseIdList(req.query.personEntityIds);
    if (personEntityIds.length === 0) {
      return res.json([]);
    }

    const db = await getDb();
    const memberships = await listPersonSubjectMembershipsForPeople(db, personEntityIds);
    res.json(memberships);
  }
);

export const getHistoricalBasemapManifestResponse = asyncErrorHandler(
  async (req: Request, res: Response) => {
    const cutoffYear = parseYear(req.query.cutoffYear) ?? DEFAULT_HISTORICAL_BASEMAPS_CUTOFF_YEAR;
    const manifest = await getHistoricalBasemapManifest(cutoffYear);

    if (!manifest.datasetPresent) {
      return res.status(404).json({
        message:
          'Historical basemaps were not found. Clone the dataset into data/historical-basemaps or set HISTORICAL_BASEMAPS_PATH.',
      });
    }

    res.json(manifest);
  }
);

export const getHistoricalBasemapLayerResponse = asyncErrorHandler(
  async (req: Request, res: Response) => {
    const requestedYear = parseYear(req.query.year);
    if (requestedYear === null) {
      return res.status(400).json({ message: 'A numeric year is required.' });
    }

    const cutoffYear = parseYear(req.query.cutoffYear) ?? DEFAULT_HISTORICAL_BASEMAPS_CUTOFF_YEAR;
    const layer = await getHistoricalBasemapLayer(requestedYear, cutoffYear);

    if (!layer) {
      return res.status(404).json({
        message:
          'Historical basemaps were not found. Clone the dataset into data/historical-basemaps or set HISTORICAL_BASEMAPS_PATH.',
      });
    }

    res.json(layer);
  }
);

export const getHistoricalBasemapPolityMatchResponse = asyncErrorHandler(
  async (req: Request, res: Response) => {
    const snapshotYear = parseYear(req.query.year);
    const sourceFeatureId = typeof req.query.featureId === 'string' ? req.query.featureId.trim() : '';

    if (snapshotYear === null) {
      return res.status(400).json({ message: 'A numeric year is required.' });
    }

    if (!sourceFeatureId) {
      return res.status(400).json({ message: 'A basemap feature id is required.' });
    }

    const db = await getDb();
    const match = await findPolitySnapshotMatch(
      db,
      'historical-basemaps',
      snapshotYear,
      sourceFeatureId
    );

    res.json((match ?? null) as HistoricalBasemapPolityMatchResponse | null);
  }
);

export const searchCanonicalHistoricalEntities = asyncErrorHandler(async (req: Request, res: Response) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const requestedKind = req.query.kind;

  if (!query) {
    return res.status(400).json({ message: 'A search query is required.' });
  }

  if (
    requestedKind !== undefined &&
    requestedKind !== 'all' &&
    !isCanonicalHistoricalEntityKind(requestedKind)
  ) {
    return res.status(400).json({ message: 'Invalid atlas entity kind' });
  }

  const kind = requestedKind === undefined ? 'all' : requestedKind;
  const limit = parseLimit(req.query.limit);
  try {
    const matches = await searchWikidataCanonicalEntities({
      kind,
      limit,
      query,
    });
    res.json(matches);
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 502;
    const message = error instanceof Error ? error.message : 'Wikidata search failed.';
    res.status(status).json({ message });
  }
});

export const createCanonicalHistoricalEntity = asyncErrorHandler(async (req: Request, res: Response) => {
  const payload = req.body as Partial<NewCanonicalHistoricalEntity>;

  if (payload.authority !== 'wikidata') {
    return res.status(400).json({ message: 'A supported authority is required.' });
  }

  if (!isCanonicalHistoricalEntityKind(payload.kind)) {
    return res.status(400).json({ message: 'A valid atlas entity kind is required.' });
  }

  const authorityId = typeof payload.authorityId === 'string' ? payload.authorityId.trim() : '';
  const title = typeof payload.title === 'string' ? payload.title.trim() : '';
  if (!authorityId || !title) {
    return res.status(400).json({ message: 'Authority id and title are required.' });
  }

  const db = await getDb();
  const targetKind = localEntityKindMap[payload.kind];
  const targetFormationSubtype = localFormationSubtypeMap[payload.kind];
  const referenceEntityLinkCandidate =
    targetKind
      ? await findExistingReferenceEntityByKindAndTitle(
          db,
          targetKind,
          title,
          targetFormationSubtype
        )
      : null;
  const entity = await upsertCanonicalHistoricalEntity(db, {
    authority: 'wikidata',
    authorityId,
    kind: payload.kind,
    referenceEntityId: payload.referenceEntityId ?? referenceEntityLinkCandidate?.id,
    title,
    summary: typeof payload.summary === 'string' ? payload.summary.trim() || undefined : undefined,
    description:
      typeof payload.description === 'string' ? payload.description.trim() || undefined : undefined,
    startYear: Number.isInteger(payload.startYear) ? payload.startYear : undefined,
    endYear: Number.isInteger(payload.endYear) ? payload.endYear : undefined,
    latitude: typeof payload.latitude === 'number' ? payload.latitude : undefined,
    longitude: typeof payload.longitude === 'number' ? payload.longitude : undefined,
    imageUrl: typeof payload.imageUrl === 'string' ? payload.imageUrl : undefined,
    sourceUrl: typeof payload.sourceUrl === 'string' ? payload.sourceUrl : undefined,
    metadata: parseMetadata(payload.metadata),
  });

  res.status(201).json(entity);
});

export const getCanonicalHistoricalEntityGeometry = asyncErrorHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ message: 'Invalid atlas entity id' });
  }

  const db = await getDb();
  const row = await db.get<CanonicalHistoricalEntityRow>(
    'SELECT * FROM canonical_historical_entities WHERE id = ?',
    id
  );

  if (!row) {
    return res.status(404).json({ message: 'Atlas entity not found' });
  }

  const entity = hydrateCanonicalHistoricalEntity(row);
  const geoshapeTitle =
    typeof entity.metadata?.geoshapeTitle === 'string' ? entity.metadata.geoshapeTitle : undefined;

  const cachedGeometryRow = await db.get<CanonicalHistoricalGeometryRow>(
    `SELECT * FROM canonical_historical_entity_geometries
     WHERE canonicalHistoricalEntityId = ?`,
    entity.id
  );

  if (cachedGeometryRow) {
    res.json({
      entityId: entity.id,
      title: entity.title,
      source: cachedGeometryRow.source,
      cached: true,
      cachedAt: cachedGeometryRow.updatedAt,
      geojson: JSON.parse(cachedGeometryRow.geojson) as Record<string, unknown>,
    });
    return;
  }

  if (!geoshapeTitle) {
    return res.status(404).json({ message: 'No boundary geometry is available for this atlas entity yet.' });
  }

  const shapeUrl = `https://commons.wikimedia.org/w/index.php?title=${encodeURIComponent(
    geoshapeTitle
  )}&action=raw`;

  const upstreamResponse = await fetch(shapeUrl, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Enzyklopaedie/1.0',
    },
  });

  if (!upstreamResponse.ok) {
    return res.status(upstreamResponse.status).json({
      message: 'Failed to fetch boundary geometry from Wikimedia Commons.',
    });
  }

  const payload = await upstreamResponse.json() as {
    data?: Record<string, unknown>;
    type?: string;
  } | Record<string, unknown>;

  const geojson =
    payload && typeof payload === 'object' && 'data' in payload && payload.data && typeof payload.data === 'object'
      ? payload.data
      : payload;

  if (!geojson || typeof geojson !== 'object') {
    return res.status(502).json({ message: 'Wikimedia Commons returned invalid boundary geometry.' });
  }

  const now = new Date().toISOString();
  await db.run(
    `INSERT OR REPLACE INTO canonical_historical_entity_geometries
      (canonicalHistoricalEntityId, source, geojson, createdAt, updatedAt)
     VALUES (?, ?, ?, COALESCE((SELECT createdAt FROM canonical_historical_entity_geometries WHERE canonicalHistoricalEntityId = ?), ?), ?)`,
    entity.id,
    'wikimedia_commons_map',
    JSON.stringify(geojson),
    entity.id,
    now,
    now
  );

  res.json({
    entityId: entity.id,
    title: entity.title,
    source: 'wikimedia_commons_map',
    cached: false,
    cachedAt: now,
    geojson,
  });
});

export const promoteCanonicalHistoricalEntity = asyncErrorHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ message: 'Invalid atlas entity id' });
  }

  const db = await getDb();
  const canonicalRow = await db.get<CanonicalHistoricalEntityRow>(
    'SELECT * FROM canonical_historical_entities WHERE id = ?',
    id
  );

  if (!canonicalRow) {
    return res.status(404).json({ message: 'Atlas entity not found' });
  }

  const canonicalEntity = hydrateCanonicalHistoricalEntity(canonicalRow);

  if (canonicalEntity.referenceEntityId) {
    const existingRow = await db.get<ReferenceEntityRow>(
      'SELECT * FROM reference_entities WHERE id = ?',
      canonicalEntity.referenceEntityId
    );

    if (existingRow) {
      const existingEntity = await syncReferenceEntityAtlasMetadata(
        db,
        hydrateReferenceEntity(existingRow),
        canonicalEntity
      );
      return res.json({
        atlasEntity: canonicalEntity,
        referenceEntity: existingEntity,
      });
    }
  }

  const targetKind = localEntityKindMap[canonicalEntity.kind];
  const targetFormationSubtype = localFormationSubtypeMap[canonicalEntity.kind];
  if (!targetKind) {
    return res.status(400).json({ message: 'This atlas entity kind cannot be promoted yet.' });
  }

  const existingByTitle = await findExistingReferenceEntityByKindAndTitle(
    db,
    targetKind,
    canonicalEntity.title,
    targetFormationSubtype
  );
  if (existingByTitle) {
    if (targetKind === 'polity' && !isBuiltInPolityEntity(existingByTitle)) {
      return res.status(400).json({
        message: 'Polities can only be linked when they already exist in the map-backed atlas.',
      });
    }

    const updatedExistingEntity = await syncReferenceEntityAtlasMetadata(db, existingByTitle, canonicalEntity);
    const now = new Date().toISOString();
    await db.run(
      `UPDATE canonical_historical_entities
       SET referenceEntityId = ?, updatedAt = ?
       WHERE id = ?`,
      updatedExistingEntity.id,
      now,
      canonicalEntity.id
    );

    return res.json({
      atlasEntity: {
        ...canonicalEntity,
        referenceEntityId: updatedExistingEntity.id,
        updatedAt: now,
      },
      referenceEntity: updatedExistingEntity,
    });
  }

  if (targetKind === 'polity') {
    return res.status(400).json({
      message: 'Polities are seeded from historical basemaps before they can be linked to Wikidata.',
    });
  }

  const slug = await generateUniqueReferenceEntitySlug(db, targetKind, canonicalEntity.title);
  const now = new Date().toISOString();

  const result = await db.run(
    `INSERT INTO reference_entities
      (kind, formationSubtype, title, slug, summary, description, startYear, endYear, metadata, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    targetKind,
    targetFormationSubtype ?? null,
    canonicalEntity.title,
    slug,
    canonicalEntity.summary ?? null,
    canonicalEntity.description ?? null,
    canonicalEntity.startYear ?? null,
    canonicalEntity.endYear ?? null,
    JSON.stringify({
      ...(canonicalEntity.metadata ?? {}),
      ...buildAtlasReferenceEntityMetadata(canonicalEntity),
    }),
    now,
    now
  );

  const referenceEntityId = result.lastID as number;

  await db.run(
    `UPDATE canonical_historical_entities
     SET referenceEntityId = ?, updatedAt = ?
     WHERE id = ?`,
    referenceEntityId,
    now,
    canonicalEntity.id
  );

  const referenceEntity: ReferenceEntity = {
    id: referenceEntityId,
    kind: targetKind,
    formationSubtype: targetFormationSubtype,
    title: canonicalEntity.title,
    slug,
    summary: canonicalEntity.summary,
    description: canonicalEntity.description,
    startYear: canonicalEntity.startYear,
    endYear: canonicalEntity.endYear,
    metadata: {
      ...(canonicalEntity.metadata ?? {}),
      ...buildAtlasReferenceEntityMetadata(canonicalEntity),
    },
    createdAt: now,
    updatedAt: now,
  };

  await recordActivityEvent({
    type: 'reference_entity_created',
    entityType: 'reference_entity',
    entityId: referenceEntity.id,
    message: `Created ${referenceEntity.kind} "${referenceEntity.title}" from the world history atlas`,
      metadata: {
        kind: referenceEntity.kind,
        formationSubtype: referenceEntity.formationSubtype,
        slug: referenceEntity.slug,
        atlasAuthority: canonicalEntity.authority,
        atlasAuthorityId: canonicalEntity.authorityId,
    },
  });

  res.json({
    atlasEntity: {
      ...canonicalEntity,
      referenceEntityId,
      updatedAt: now,
    },
    referenceEntity,
  });
});

export const deleteCanonicalHistoricalEntity = asyncErrorHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ message: 'Invalid atlas entity id' });
  }

  const db = await getDb();
  const existing = await db.get<CanonicalHistoricalEntityRow>(
    'SELECT * FROM canonical_historical_entities WHERE id = ?',
    id
  );

  if (!existing) {
    return res.status(404).json({ message: 'Atlas entity not found' });
  }

  await db.run('DELETE FROM canonical_historical_entities WHERE id = ?', id);
  res.status(204).send();
});

export const getCanonicalHistoricalEntityById = asyncErrorHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  if (!id) {
    return res.status(400).json({ message: 'Invalid atlas entity id' });
  }

  const db = await getDb();
  const row = await db.get<CanonicalHistoricalEntityRow>(
    'SELECT * FROM canonical_historical_entities WHERE id = ?',
    id
  );

  if (!row) {
    return res.status(404).json({ message: 'Atlas entity not found' });
  }

  res.json(hydrateCanonicalHistoricalEntity(row));
});
