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

interface LegacyImportInput {
  kind: ReferenceEntityKind;
  title: string;
  summary?: string | null;
  description?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  metadata?: Record<string, unknown>;
}

type DbConnection = Database<sqlite3.Database, sqlite3.Statement>;

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

export const syncLegacyReferenceEntities = async (db: DbConnection) => {
  const now = new Date().toISOString();

  const upsertLegacyEntity = async (input: LegacyImportInput) => {
    const existing = await db.get(
      'SELECT id FROM reference_entities WHERE kind = ? AND lower(title) = lower(?)',
      input.kind,
      input.title
    );
    if (existing) return;

    const slug = await generateUniqueReferenceEntitySlug(db, input.kind, input.title);

    await db.run(
      `INSERT INTO reference_entities
        (kind, title, slug, summary, description, startYear, endYear, metadata, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.kind,
      input.title,
      slug,
      input.summary || null,
      input.description || null,
      input.startYear ?? null,
      input.endYear ?? null,
      input.metadata ? JSON.stringify(input.metadata) : null,
      now,
      now
    );
  };

  const authors = await db.all<any[]>('SELECT * FROM authors');
  for (const author of authors) {
    await upsertLegacyEntity({
      kind: 'person',
      title: author.name,
      summary: author.description,
      startYear: author.yearOfBirth,
      endYear: author.yearOfDeath,
      metadata: {
        legacySource: 'authors',
        legacyId: author.id,
        countryId: author.countryId,
        imageUrl: author.imageUrl,
        link: author.link,
        subjectIds: author.subjectIds,
      },
    });
  }

  const nations = await db.all<any[]>('SELECT * FROM nations');
  for (const nation of nations) {
    await upsertLegacyEntity({
      kind: 'nation',
      title: nation.name,
      summary: nation.description,
      startYear: nation.beginYear,
      endYear: nation.endYear,
      metadata: {
        legacySource: 'nations',
        legacyId: nation.id,
        imageUrl: nation.imageUrl,
        link: nation.link,
        authorIds: nation.authorIds,
        civilizationId: nation.civilizationId,
        eraIds: nation.eraIds,
      },
    });
  }

  const civilizations = await db.all<any[]>('SELECT * FROM civilizations');
  for (const civilization of civilizations) {
    await upsertLegacyEntity({
      kind: 'civilization',
      title: civilization.name,
      summary: civilization.description,
      metadata: {
        legacySource: 'civilizations',
        legacyId: civilization.id,
        nationIds: civilization.nationIds,
        parentId: civilization.parentId,
      },
    });
  }

  const eras = await db.all<any[]>('SELECT * FROM eras');
  for (const era of eras) {
    await upsertLegacyEntity({
      kind: 'era',
      title: era.name,
      summary: era.description,
      startYear: era.beginYear,
      endYear: era.endYear,
      metadata: {
        legacySource: 'eras',
        legacyId: era.id,
        civilizationId: era.civilizationId,
      },
    });
  }
};
