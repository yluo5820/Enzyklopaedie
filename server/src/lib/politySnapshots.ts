import type { PolitySnapshot, ReferenceEntity } from '@enzyklopaedie/shared';
import type sqlite3 from 'sqlite3';
import type { Database } from 'sqlite';
import { hydrateReferenceEntity, parseReferenceEntityMetadata } from './referenceEntities';

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
