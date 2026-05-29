import type { PolitySnapshot, ReferenceEntity } from '@enzyklopaedie/shared';
import type sqlite3 from 'sqlite3';
import type { Database } from 'sqlite';
import { hydrateReferenceEntity } from './referenceEntities';
import {
  getWorldHistoryPolityById,
  listWorldHistoryPolitySnapshotsByFeature,
  listWorldHistoryPolitySnapshotsByReferenceEntity,
  toLegacyPolitySnapshot,
} from './worldHistoryPolities';

type DbConnection = Database<sqlite3.Database, sqlite3.Statement>;

type PolitySnapshotRow = Omit<PolitySnapshot, 'geometry' | 'metadata'> & {
  geometry: string;
  metadata?: string | null;
};

type ReferenceEntityRow = Omit<ReferenceEntity, 'metadata'> & {
  metadata?: string | null;
};

const parseSnapshotGeometry = (value: string) => {
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch (error) {
    return {};
  }
};

const parseSnapshotMetadata = (value?: string | null) => {
  if (!value) return undefined;

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch (error) {
    return undefined;
  }
};

export const hydratePolitySnapshot = (row: PolitySnapshotRow): PolitySnapshot => ({
  ...row,
  geometry: parseSnapshotGeometry(row.geometry),
  metadata: parseSnapshotMetadata(row.metadata),
});

export const listPolitySnapshotsByReferenceEntity = async (
  db: DbConnection,
  referenceEntityId: number
) => {
  const worldHistorySnapshots = await listWorldHistoryPolitySnapshotsByReferenceEntity(
    db,
    referenceEntityId
  );
  if (worldHistorySnapshots.length > 0) {
    return worldHistorySnapshots.map((snapshot) =>
      toLegacyPolitySnapshot(snapshot, referenceEntityId)
    );
  }

  const rows = await db.all<PolitySnapshotRow[]>(
    `SELECT * FROM polity_snapshots
     WHERE referenceEntityId = ?
     ORDER BY snapshotYear ASC, createdAt ASC`,
    referenceEntityId
  );

  return rows.map(hydratePolitySnapshot);
};

export const findPolitySnapshotMatch = async (
  db: DbConnection,
  source: PolitySnapshot['source'],
  snapshotYear: number,
  sourceFeatureId: string
) => {
  const worldHistorySnapshots = await listWorldHistoryPolitySnapshotsByFeature(
    db,
    source,
    snapshotYear
  );

  for (const snapshot of worldHistorySnapshots) {
    const sourceFeatureIds = Array.isArray(snapshot.metadata?.sourceFeatureIds)
      ? snapshot.metadata?.sourceFeatureIds.filter(
          (value): value is string => typeof value === 'string'
        )
      : [];

    if (snapshot.sourceFeatureId !== sourceFeatureId && !sourceFeatureIds.includes(sourceFeatureId)) {
      continue;
    }

    if (!snapshot.referenceEntityId) {
      return null;
    }

    const referenceEntityRow = await db.get<ReferenceEntityRow>(
      'SELECT * FROM reference_entities WHERE id = ?',
      snapshot.referenceEntityId
    );

    if (!referenceEntityRow) {
      return null;
    }

    const worldHistoryPolity = await getWorldHistoryPolityById(db, snapshot.worldHistoryPolityId);

    return {
      referenceEntity: hydrateReferenceEntity(referenceEntityRow),
      snapshot: toLegacyPolitySnapshot(snapshot, snapshot.referenceEntityId),
      ...(worldHistoryPolity ? { worldHistoryPolity } : {}),
      worldHistoryPolitySnapshot: snapshot,
    };
  }

  const rows = await db.all<PolitySnapshotRow[]>(
    `SELECT * FROM polity_snapshots
     WHERE source = ? AND snapshotYear = ?
     ORDER BY referenceEntityId ASC`,
    source,
    snapshotYear
  );

  for (const row of rows) {
    const snapshot = hydratePolitySnapshot(row);
    const sourceFeatureIds = Array.isArray(snapshot.metadata?.sourceFeatureIds)
      ? snapshot.metadata?.sourceFeatureIds.filter(
          (value): value is string => typeof value === 'string'
        )
      : [];

    if (!sourceFeatureIds.includes(sourceFeatureId)) {
      continue;
    }

    const referenceEntityRow = await db.get<ReferenceEntityRow>(
      'SELECT * FROM reference_entities WHERE id = ?',
      snapshot.referenceEntityId
    );

    if (!referenceEntityRow) {
      return null;
    }

    return {
      referenceEntity: hydrateReferenceEntity(referenceEntityRow),
      snapshot,
    };
  }

  return null;
};
