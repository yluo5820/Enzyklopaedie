import type { CanonicalHistoricalEntity, NewCanonicalHistoricalEntity } from '@enzyklopaedie/shared';
import type sqlite3 from 'sqlite3';
import type { Database } from 'sqlite';

type CanonicalHistoricalEntityRow = Omit<CanonicalHistoricalEntity, 'metadata'> & {
  metadata?: string | null;
};

export const parseCanonicalHistoricalMetadata = (value?: string | null) => {
  if (!value) return undefined;

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return undefined;
  }
};

export const hydrateCanonicalHistoricalEntity = (
  row: CanonicalHistoricalEntityRow
): CanonicalHistoricalEntity => ({
  ...row,
  metadata: parseCanonicalHistoricalMetadata(row.metadata),
});

export const listCanonicalHistoricalEntities = async (
  db: Database<sqlite3.Database, sqlite3.Statement>
) => {
  const rows = await db.all<CanonicalHistoricalEntityRow[]>(
    `SELECT * FROM canonical_historical_entities
     ORDER BY COALESCE(startYear, endYear, 999999) ASC, lower(title) ASC, createdAt ASC`
  );

  return rows.map(hydrateCanonicalHistoricalEntity);
};

export const upsertCanonicalHistoricalEntity = async (
  db: Database<sqlite3.Database, sqlite3.Statement>,
  entity: NewCanonicalHistoricalEntity
) => {
  const existing = await db.get<CanonicalHistoricalEntityRow>(
    `SELECT * FROM canonical_historical_entities
     WHERE authority = ? AND authorityId = ?`,
    entity.authority,
    entity.authorityId
  );

  const now = new Date().toISOString();

  if (existing) {
    await db.run(
      `UPDATE canonical_historical_entities
       SET kind = ?,
           referenceEntityId = ?,
           title = ?,
           summary = ?,
           description = ?,
           startYear = ?,
           endYear = ?,
           latitude = ?,
           longitude = ?,
           imageUrl = ?,
           sourceUrl = ?,
           metadata = ?,
           updatedAt = ?
       WHERE id = ?`,
      entity.kind,
      entity.referenceEntityId ?? null,
      entity.title,
      entity.summary ?? null,
      entity.description ?? null,
      entity.startYear ?? null,
      entity.endYear ?? null,
      entity.latitude ?? null,
      entity.longitude ?? null,
      entity.imageUrl ?? null,
      entity.sourceUrl ?? null,
      entity.metadata ? JSON.stringify(entity.metadata) : null,
      now,
      existing.id
    );

    return {
      ...hydrateCanonicalHistoricalEntity({
        ...existing,
        ...entity,
        metadata: entity.metadata ? JSON.stringify(entity.metadata) : null,
        updatedAt: now,
      }),
      id: existing.id,
      createdAt: existing.createdAt,
    };
  }

  const result = await db.run(
    `INSERT INTO canonical_historical_entities
      (authority, authorityId, kind, title, summary, description, startYear, endYear, latitude, longitude,
       imageUrl, sourceUrl, metadata, referenceEntityId, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    entity.authority,
    entity.authorityId,
    entity.kind,
    entity.title,
    entity.summary ?? null,
    entity.description ?? null,
    entity.startYear ?? null,
    entity.endYear ?? null,
    entity.latitude ?? null,
    entity.longitude ?? null,
    entity.imageUrl ?? null,
    entity.sourceUrl ?? null,
    entity.metadata ? JSON.stringify(entity.metadata) : null,
    entity.referenceEntityId ?? null,
    now,
    now
  );

  return {
    ...entity,
    id: result.lastID as number,
    createdAt: now,
    updatedAt: now,
  } as CanonicalHistoricalEntity;
};
