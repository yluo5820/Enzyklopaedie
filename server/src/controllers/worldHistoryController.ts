import { NextFunction, Request, Response } from 'express';
import type {
  CanonicalHistoricalEntity,
  CanonicalHistoricalEntityKind,
  CanonicalHistoricalSearchMatch,
  HistoricalBasemapPolityMatchResponse,
  NewCanonicalHistoricalEntity,
  ReferenceEntity,
  ReferenceEntityKind,
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

type WikidataSearchPayload = {
  search?: Array<{
    concepturi?: string;
    description?: string;
    id?: string;
    label?: string;
  }>;
};

type WikidataClaim = {
  mainsnak?: {
    datavalue?: {
      value?: any;
    };
  };
};

type WikidataEntityPayload = {
  entities?: Record<
    string,
    {
      claims?: Record<string, WikidataClaim[]>;
      descriptions?: Record<string, { value?: string }>;
      id: string;
      labels?: Record<string, { value?: string }>;
    }
  >;
};

const asyncErrorHandler = (fn: AsyncRoute) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const canonicalKinds = [
  'person',
  'ruler',
  'battle',
  'nation',
  'civilization',
  'era',
  'place',
  'region',
] as const satisfies CanonicalHistoricalEntityKind[];

const isCanonicalHistoricalEntityKind = (value: unknown): value is CanonicalHistoricalEntityKind =>
  typeof value === 'string' && canonicalKinds.includes(value as CanonicalHistoricalEntityKind);

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

const parseMetadata = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
};

const quoteTerm = (value: string) => JSON.stringify(value.trim());

const getClaimValues = (
  claims: Record<string, WikidataClaim[]> | undefined,
  property: string
) => (claims?.[property] ?? []).map((claim) => claim.mainsnak?.datavalue?.value).filter(Boolean);

const getEntityIds = (
  claims: Record<string, WikidataClaim[]> | undefined,
  property: string
) =>
  getClaimValues(claims, property)
    .map((value) => value?.id)
    .filter((value): value is string => typeof value === 'string');

const getCoordinate = (claims: Record<string, WikidataClaim[]> | undefined) => {
  const coordinate = getClaimValues(claims, 'P625')[0];
  if (
    coordinate &&
    typeof coordinate.latitude === 'number' &&
    typeof coordinate.longitude === 'number'
  ) {
    return {
      latitude: coordinate.latitude,
      longitude: coordinate.longitude,
    };
  }

  return undefined;
};

const parseTimeYear = (value: unknown) => {
  if (!value || typeof value !== 'object' || typeof (value as { time?: unknown }).time !== 'string') {
    return undefined;
  }

  const raw = (value as { time: string }).time;
  const match = raw.match(/^([+-]\d{4,})/);
  if (!match) return undefined;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getFirstYear = (
  claims: Record<string, WikidataClaim[]> | undefined,
  properties: string[]
) => {
  for (const property of properties) {
    for (const value of getClaimValues(claims, property)) {
      const year = parseTimeYear(value);
      if (year !== undefined) {
        return year;
      }
    }
  }

  return undefined;
};

const buildCommonsImageUrl = (filename?: string) => {
  if (!filename) return undefined;
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=480`;
};

const normalizeText = (value?: string) => value?.trim().toLowerCase() ?? '';

const detectKind = (
  requestedKind: CanonicalHistoricalEntityKind | 'all',
  description: string,
  claims?: Record<string, WikidataClaim[]>
): CanonicalHistoricalEntityKind => {
  if (requestedKind !== 'all') {
    return requestedKind;
  }

  const descriptionText = normalizeText(description);
  const instanceOfIds = getEntityIds(claims, 'P31');
  const isHuman = instanceOfIds.includes('Q5');

  if (isHuman) {
    if (/\b(king|queen|emperor|empress|monarch|ruler|pharaoh|caliph|sultan|shah|tsar)\b/.test(descriptionText)) {
      return 'ruler';
    }
    return 'person';
  }

  if (instanceOfIds.includes('Q178561') || descriptionText.includes('battle')) {
    return 'battle';
  }

  if (descriptionText.includes('civilization')) {
    return 'civilization';
  }

  if (descriptionText.includes('era') || descriptionText.includes('period')) {
    return 'era';
  }

  if (
    /\b(country|state|empire|kingdom|republic|nation|dynasty|polity)\b/.test(descriptionText)
  ) {
    return 'nation';
  }

  if (/\b(region|province|territory|county|prefecture)\b/.test(descriptionText)) {
    return 'region';
  }

  if (getCoordinate(claims)) {
    return 'place';
  }

  return 'region';
};

const scoreMatch = (
  requestedKind: CanonicalHistoricalEntityKind | 'all',
  query: string,
  title: string,
  description: string,
  detectedKind: CanonicalHistoricalEntityKind,
  claims?: Record<string, WikidataClaim[]>
) => {
  const normalizedQuery = normalizeText(query);
  const normalizedTitle = normalizeText(title);
  const normalizedDescription = normalizeText(description);
  let score = 0;

  if (normalizedTitle === normalizedQuery) score += 80;
  else if (normalizedTitle.startsWith(normalizedQuery)) score += 50;
  else if (normalizedTitle.includes(normalizedQuery)) score += 25;

  if (requestedKind !== 'all' && detectedKind === requestedKind) {
    score += 40;
  }

  if (requestedKind === 'person' && getEntityIds(claims, 'P31').includes('Q5')) {
    score += 15;
  }

  if (requestedKind === 'battle' && normalizedDescription.includes('battle')) {
    score += 15;
  }

  if (normalizedDescription.includes(normalizedQuery)) {
    score += 10;
  }

  return score;
};

const buildSearchQuery = (query: string, kind: CanonicalHistoricalEntityKind | 'all') => {
  const trimmed = query.trim();
  if (kind === 'all') {
    return trimmed;
  }

  if (kind === 'battle') {
    return `${trimmed} battle`;
  }

  if (kind === 'ruler') {
    return `${trimmed} ruler`;
  }

  if (kind === 'era') {
    return `${trimmed} historical period`;
  }

  if (kind === 'civilization') {
    return `${trimmed} civilization`;
  }

  if (kind === 'nation') {
    return `${trimmed} state`;
  }

  if (kind === 'region') {
    return `${trimmed} region`;
  }

  return trimmed;
};

const getStringClaim = (
  claims: Record<string, WikidataClaim[]> | undefined,
  property: string
) => {
  const value = getClaimValues(claims, property)[0];
  return typeof value === 'string' ? value : undefined;
};

const localEntityKindMap: Partial<Record<CanonicalHistoricalEntityKind, ReferenceEntityKind>> = {
  civilization: 'formation',
  era: 'formation',
  nation: 'polity',
  person: 'person',
  place: 'polity',
  region: 'polity',
  ruler: 'person',
};

const findExistingReferenceEntityByKindAndTitle = async (
  db: Awaited<ReturnType<typeof getDb>>,
  kind: ReferenceEntityKind,
  title: string
) => {
  const normalizedTitle = title.trim();
  if (!normalizedTitle) return null;

  const row = await db.get<ReferenceEntityRow>(
    `SELECT * FROM reference_entities
     WHERE kind = ? AND lower(title) = lower(?)
     LIMIT 1`,
    kind,
    normalizedTitle
  );

  return row ? hydrateReferenceEntity(row) : null;
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
  const searchParams = new URLSearchParams({
    action: 'wbsearchentities',
    format: 'json',
    language: 'en',
    type: 'item',
    limit: String(limit),
    search: buildSearchQuery(query, kind),
  });

  const searchResponse = await fetch(`https://www.wikidata.org/w/api.php?${searchParams.toString()}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Enzyklopaedie/1.0',
    },
  });

  if (!searchResponse.ok) {
    return res.status(searchResponse.status).json({ message: 'Wikidata search failed.' });
  }

  const searchPayload = (await searchResponse.json()) as WikidataSearchPayload;
  const searchResults = searchPayload.search ?? [];
  const ids = searchResults
    .map((result) => result.id)
    .filter((value): value is string => typeof value === 'string');

  if (ids.length === 0) {
    return res.json([]);
  }

  const entityParams = new URLSearchParams({
    action: 'wbgetentities',
    format: 'json',
    languages: 'en',
    ids: ids.join('|'),
    props: 'labels|descriptions|claims',
  });

  const entityResponse = await fetch(`https://www.wikidata.org/w/api.php?${entityParams.toString()}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Enzyklopaedie/1.0',
    },
  });

  if (!entityResponse.ok) {
    return res.status(entityResponse.status).json({ message: 'Wikidata entity lookup failed.' });
  }

  const entityPayload = (await entityResponse.json()) as WikidataEntityPayload;

  const matches = searchResults
    .map((result) => {
      if (!result.id) return null;

      const entity = entityPayload.entities?.[result.id];
      const claims = entity?.claims;
      const title = entity?.labels?.en?.value ?? result.label ?? result.id;
      const description = entity?.descriptions?.en?.value ?? result.description ?? undefined;
      const coordinates = getCoordinate(claims);
      const detectedKind = detectKind(kind, description ?? '', claims);
      const imageFilename = getClaimValues(claims, 'P18')[0];
      const geoshapeTitle = getStringClaim(claims, 'P3896');

      const match: CanonicalHistoricalSearchMatch & { score: number } = {
        authority: 'wikidata',
        authorityId: result.id,
        kind: detectedKind,
        title,
        summary: description,
        description,
        startYear: getFirstYear(claims, ['P580', 'P571', 'P569', 'P585']),
        endYear: getFirstYear(claims, ['P582', 'P576', 'P570']),
        latitude: coordinates?.latitude,
        longitude: coordinates?.longitude,
        imageUrl: typeof imageFilename === 'string' ? buildCommonsImageUrl(imageFilename) : undefined,
        sourceUrl: result.concepturi || `https://www.wikidata.org/wiki/${result.id}`,
        metadata: {
          description,
          geoshapeTitle,
          hasGeoshape: Boolean(geoshapeTitle),
          wikidataId: result.id,
        },
        score: scoreMatch(kind, query, title, description ?? '', detectedKind, claims),
      };

      return match;
    })
    .filter((match): match is CanonicalHistoricalSearchMatch & { score: number } => Boolean(match))
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, limit)
    .map(({ score: _score, ...match }) => match);

  res.json(matches);
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
  const referenceEntityLinkCandidate =
    targetKind ? await findExistingReferenceEntityByKindAndTitle(db, targetKind, title) : null;
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
      return res.json({
        atlasEntity: canonicalEntity,
        referenceEntity: hydrateReferenceEntity(existingRow),
      });
    }
  }

  const targetKind = localEntityKindMap[canonicalEntity.kind];
  if (!targetKind) {
    return res.status(400).json({ message: 'This atlas entity kind cannot be promoted yet.' });
  }

  const existingByTitle = await findExistingReferenceEntityByKindAndTitle(
    db,
    targetKind,
    canonicalEntity.title
  );
  if (existingByTitle) {
    await db.run(
      `UPDATE canonical_historical_entities
       SET referenceEntityId = ?, updatedAt = ?
       WHERE id = ?`,
      existingByTitle.id,
      new Date().toISOString(),
      canonicalEntity.id
    );

    return res.json({
      atlasEntity: {
        ...canonicalEntity,
        referenceEntityId: existingByTitle.id,
      },
      referenceEntity: existingByTitle,
    });
  }

  const slug = await generateUniqueReferenceEntitySlug(db, targetKind, canonicalEntity.title);
  const now = new Date().toISOString();

  const result = await db.run(
    `INSERT INTO reference_entities
      (kind, title, slug, summary, description, startYear, endYear, metadata, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    targetKind,
    canonicalEntity.title,
    slug,
    canonicalEntity.summary ?? null,
    canonicalEntity.description ?? null,
    canonicalEntity.startYear ?? null,
    canonicalEntity.endYear ?? null,
    JSON.stringify({
      ...(canonicalEntity.metadata ?? {}),
      atlasAuthority: canonicalEntity.authority,
      atlasAuthorityId: canonicalEntity.authorityId,
      atlasKind: canonicalEntity.kind,
      atlasSourceUrl: canonicalEntity.sourceUrl,
      atlasImageUrl: canonicalEntity.imageUrl,
      atlasCoordinates:
        canonicalEntity.latitude !== undefined && canonicalEntity.longitude !== undefined
          ? {
              latitude: canonicalEntity.latitude,
              longitude: canonicalEntity.longitude,
            }
          : undefined,
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
    title: canonicalEntity.title,
    slug,
    summary: canonicalEntity.summary,
    description: canonicalEntity.description,
    startYear: canonicalEntity.startYear,
    endYear: canonicalEntity.endYear,
    metadata: {
      ...(canonicalEntity.metadata ?? {}),
      atlasAuthority: canonicalEntity.authority,
      atlasAuthorityId: canonicalEntity.authorityId,
      atlasKind: canonicalEntity.kind,
      atlasSourceUrl: canonicalEntity.sourceUrl,
      atlasImageUrl: canonicalEntity.imageUrl,
      atlasCoordinates:
        canonicalEntity.latitude !== undefined && canonicalEntity.longitude !== undefined
          ? {
              latitude: canonicalEntity.latitude,
              longitude: canonicalEntity.longitude,
            }
          : undefined,
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
