import {
  buildReferenceEntitySlug,
  type ReferenceEntity,
  type ReferenceEntityKind,
} from '@enzyklopaedie/shared';
import type sqlite3 from 'sqlite3';
import type { Database } from 'sqlite';

type ReferenceEntityRow = Omit<ReferenceEntity, 'metadata'> & {
  metadata?: string | null;
};

type DbConnection = Database<sqlite3.Database, sqlite3.Statement>;

export interface ReferenceEntityLookup {
  id: number;
  kind: ReferenceEntityKind;
  title: string;
  slug: string;
}

export const parseReferenceEntityMetadata = (value?: string | null) => {
  if (!value) return undefined;

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch (error) {
    return undefined;
  }
};

export const hydrateReferenceEntity = (row: ReferenceEntityRow): ReferenceEntity => ({
  ...row,
  metadata: parseReferenceEntityMetadata(row.metadata),
});

export const getReferenceEntityLookup = async (referenceEntityId: number) => {
  const db = await getDbConnection();
  return db.get<ReferenceEntityLookup>(
    'SELECT id, kind, title, slug FROM reference_entities WHERE id = ?',
    referenceEntityId
  );
};

const getDbConnection = async () => {
  return import('../db').then(({ getDb }) => getDb());
};

export const generateUniqueReferenceEntitySlug = async (
  db: DbConnection,
  kind: ReferenceEntityKind,
  title: string,
  excludeId?: number
) => {
  const baseSlug = buildReferenceEntitySlug(kind, title);
  let slug = baseSlug || `${kind}-entry`;
  let suffix = 2;

  while (
    await db.get(
      excludeId
        ? 'SELECT id FROM reference_entities WHERE slug = ? AND id != ?'
        : 'SELECT id FROM reference_entities WHERE slug = ?',
      ...(excludeId ? [slug, excludeId] : [slug])
    )
  ) {
    slug = `${baseSlug || `${kind}-entry`}-${suffix}`;
    suffix += 1;
  }

  return slug;
};
