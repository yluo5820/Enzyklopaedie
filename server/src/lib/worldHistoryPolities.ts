import type {
  NewWorldHistoryPolity,
  NewWorldHistoryPolitySnapshot,
  PolitySnapshot,
  WorldHistoryPolity,
  WorldHistoryPolitySnapshot,
} from '@enzyklopaedie/shared';
import type sqlite3 from 'sqlite3';
import type { Database } from 'sqlite';

type DbConnection = Database<sqlite3.Database, sqlite3.Statement>;

type WorldHistoryPolityRow = Omit<WorldHistoryPolity, 'metadata'> & {
  metadata?: string | null;
};

type WorldHistoryPolitySnapshotRow = Omit<WorldHistoryPolitySnapshot, 'geometry' | 'metadata'> & {
  geometry: string;
  metadata?: string | null;
};

const parseJsonObject = (value?: string | null) => {
  if (!value) return undefined;

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return undefined;
  }
};

export const hydrateWorldHistoryPolity = (
  row: WorldHistoryPolityRow
): WorldHistoryPolity => ({
  ...row,
  referenceEntityId: row.referenceEntityId ?? undefined,
  summary: row.summary ?? undefined,
  description: row.description ?? undefined,
  startYear: row.startYear ?? undefined,
  endYear: row.endYear ?? undefined,
  authority: row.authority ?? undefined,
  authorityId: row.authorityId ?? undefined,
  imageUrl: row.imageUrl ?? undefined,
  sourceUrl: row.sourceUrl ?? undefined,
  metadata: parseJsonObject(row.metadata),
});

export const hydrateWorldHistoryPolitySnapshot = (
  row: WorldHistoryPolitySnapshotRow
): WorldHistoryPolitySnapshot => ({
  ...row,
  referenceEntityId: row.referenceEntityId ?? undefined,
  sourceFeatureId: row.sourceFeatureId ?? undefined,
  parentLabel: row.parentLabel ?? undefined,
  subjectLabel: row.subjectLabel ?? undefined,
  borderPrecision: row.borderPrecision ?? undefined,
  geometry: parseJsonObject(row.geometry) ?? {},
  metadata: parseJsonObject(row.metadata),
});

export const toLegacyPolitySnapshot = (
  snapshot: WorldHistoryPolitySnapshot,
  referenceEntityId: number
): PolitySnapshot => ({
  id: snapshot.id,
  referenceEntityId,
  snapshotYear: snapshot.snapshotYear,
  source: snapshot.source,
  titleAtSnapshot: snapshot.titleAtSnapshot,
  parentLabel: snapshot.parentLabel,
  subjectLabel: snapshot.subjectLabel,
  borderPrecision: snapshot.borderPrecision,
  geometry: snapshot.geometry,
  metadata: snapshot.metadata,
  createdAt: snapshot.createdAt,
  updatedAt: snapshot.updatedAt,
});

export const upsertWorldHistoryPolity = async (
  db: DbConnection,
  polity: NewWorldHistoryPolity
) => {
  const existing = await db.get<WorldHistoryPolityRow>(
    `SELECT * FROM world_history_polities
     WHERE source = ? AND sourceKey = ?`,
    polity.source,
    polity.sourceKey
  );
  const now = new Date().toISOString();

  if (existing) {
    await db.run(
      `UPDATE world_history_polities
       SET referenceEntityId = ?,
           title = ?,
           summary = ?,
           description = ?,
           startYear = ?,
           endYear = ?,
           authority = ?,
           authorityId = ?,
           imageUrl = ?,
           sourceUrl = ?,
           metadata = ?,
           updatedAt = ?
       WHERE id = ?`,
      polity.referenceEntityId ?? null,
      polity.title,
      polity.summary ?? null,
      polity.description ?? null,
      polity.startYear ?? null,
      polity.endYear ?? null,
      polity.authority ?? null,
      polity.authorityId ?? null,
      polity.imageUrl ?? null,
      polity.sourceUrl ?? null,
      polity.metadata ? JSON.stringify(polity.metadata) : null,
      now,
      existing.id
    );

    return hydrateWorldHistoryPolity({
      ...existing,
      ...polity,
      metadata: polity.metadata ? JSON.stringify(polity.metadata) : null,
      updatedAt: now,
    });
  }

  const result = await db.run(
    `INSERT INTO world_history_polities
      (referenceEntityId, source, sourceKey, title, summary, description, startYear, endYear,
       authority, authorityId, imageUrl, sourceUrl, metadata, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    polity.referenceEntityId ?? null,
    polity.source,
    polity.sourceKey,
    polity.title,
    polity.summary ?? null,
    polity.description ?? null,
    polity.startYear ?? null,
    polity.endYear ?? null,
    polity.authority ?? null,
    polity.authorityId ?? null,
    polity.imageUrl ?? null,
    polity.sourceUrl ?? null,
    polity.metadata ? JSON.stringify(polity.metadata) : null,
    now,
    now
  );

  return {
    ...polity,
    id: result.lastID as number,
    createdAt: now,
    updatedAt: now,
  } satisfies WorldHistoryPolity;
};

export const updateWorldHistoryPolityRange = async (
  db: DbConnection,
  id: number,
  startYear: number,
  endYear: number,
  summary: string,
  metadata: Record<string, unknown>
) => {
  const updatedAt = new Date().toISOString();
  await db.run(
    `UPDATE world_history_polities
     SET startYear = ?,
         endYear = ?,
         summary = COALESCE(summary, ?),
         metadata = ?,
         updatedAt = ?
     WHERE id = ?`,
    startYear,
    endYear,
    summary,
    JSON.stringify(metadata),
    updatedAt,
    id
  );
};

export const upsertWorldHistoryPolitySnapshot = async (
  db: DbConnection,
  snapshot: NewWorldHistoryPolitySnapshot
) => {
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO world_history_polity_snapshots
      (worldHistoryPolityId, referenceEntityId, snapshotYear, source, sourceFeatureId,
       titleAtSnapshot, parentLabel, subjectLabel, borderPrecision, geometry, metadata, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(worldHistoryPolityId, snapshotYear, source) DO UPDATE SET
       referenceEntityId = excluded.referenceEntityId,
       sourceFeatureId = excluded.sourceFeatureId,
       titleAtSnapshot = excluded.titleAtSnapshot,
       parentLabel = excluded.parentLabel,
       subjectLabel = excluded.subjectLabel,
       borderPrecision = excluded.borderPrecision,
       geometry = excluded.geometry,
       metadata = excluded.metadata,
       updatedAt = excluded.updatedAt`,
    snapshot.worldHistoryPolityId,
    snapshot.referenceEntityId ?? null,
    snapshot.snapshotYear,
    snapshot.source,
    snapshot.sourceFeatureId ?? null,
    snapshot.titleAtSnapshot,
    snapshot.parentLabel ?? null,
    snapshot.subjectLabel ?? null,
    snapshot.borderPrecision ?? null,
    JSON.stringify(snapshot.geometry),
    snapshot.metadata ? JSON.stringify(snapshot.metadata) : null,
    now,
    now
  );
};

export const listWorldHistoryPolitySnapshotsByReferenceEntity = async (
  db: DbConnection,
  referenceEntityId: number
) => {
  const rows = await db.all<WorldHistoryPolitySnapshotRow[]>(
    `SELECT * FROM world_history_polity_snapshots
     WHERE referenceEntityId = ?
     ORDER BY snapshotYear ASC, createdAt ASC`,
    referenceEntityId
  );

  return rows.map(hydrateWorldHistoryPolitySnapshot);
};

export const listWorldHistoryPolitySnapshotsByFeature = async (
  db: DbConnection,
  source: WorldHistoryPolitySnapshot['source'],
  snapshotYear: number
) => {
  const rows = await db.all<WorldHistoryPolitySnapshotRow[]>(
    `SELECT * FROM world_history_polity_snapshots
     WHERE source = ? AND snapshotYear = ?
     ORDER BY referenceEntityId ASC, worldHistoryPolityId ASC`,
    source,
    snapshotYear
  );

  return rows.map(hydrateWorldHistoryPolitySnapshot);
};
