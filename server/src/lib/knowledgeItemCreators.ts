import type sqlite3 from 'sqlite3';
import type { Database } from 'sqlite';

export const UNKNOWN_AUTHOR_SLUG = 'person-unknown-author';

type DbConnection = Database<sqlite3.Database, sqlite3.Statement>;

type CreatorPersonLookup = {
  id: number;
  title: string;
  slug: string;
};

const getUnknownAuthorPerson = async (db: DbConnection) => {
  return db.get<CreatorPersonLookup>(
    `SELECT id, title, slug
     FROM reference_entities
     WHERE kind = 'person' AND slug = ?
     LIMIT 1`,
    UNKNOWN_AUTHOR_SLUG
  );
};

export const findPersonByExactTitle = async (db: DbConnection, title: string) => {
  const trimmed = title.trim();
  if (!trimmed) return null;

  return db.get<CreatorPersonLookup>(
    `SELECT id, title, slug
     FROM reference_entities
     WHERE kind = 'person' AND lower(title) = lower(?)
     LIMIT 1`,
    trimmed
  );
};

export const getPersonById = async (db: DbConnection, id: number) => {
  return db.get<CreatorPersonLookup>(
    `SELECT id, title, slug
     FROM reference_entities
     WHERE id = ? AND kind = 'person'
     LIMIT 1`,
    id
  );
};

export const resolveCanonicalCreatorPerson = async (
  db: DbConnection,
  {
    creatorEntityId,
    creatorText,
  }: {
    creatorEntityId?: number | null;
    creatorText?: string | null;
  }
) => {
  if (creatorEntityId) {
    const explicitPerson = await getPersonById(db, creatorEntityId);
    if (!explicitPerson) {
      throw new Error('Creator entity must point to a person');
    }

    return explicitPerson;
  }

  const matchedPerson = creatorText ? await findPersonByExactTitle(db, creatorText) : null;
  if (matchedPerson) {
    return matchedPerson;
  }

  const unknownAuthor = await getUnknownAuthorPerson(db);
  if (!unknownAuthor) {
    throw new Error('Unknown Author fallback person is missing');
  }

  return unknownAuthor;
};

export const syncKnowledgeItemCreatorRelation = async (
  db: DbConnection,
  knowledgeItemId: number,
  personEntityId: number,
  createdAt = new Date().toISOString()
) => {
  await db.run(
    `DELETE FROM knowledge_relations
     WHERE fromEntityType = 'knowledge_item'
       AND fromEntityId = ?
       AND relationType = 'created_by'
       AND (toEntityType != 'reference_entity' OR toEntityId != ?)`,
    knowledgeItemId,
    personEntityId
  );

  const existing = await db.get<{ id: number }>(
    `SELECT id
     FROM knowledge_relations
     WHERE fromEntityType = 'knowledge_item'
       AND fromEntityId = ?
       AND toEntityType = 'reference_entity'
       AND toEntityId = ?
       AND relationType = 'created_by'
     LIMIT 1`,
    knowledgeItemId,
    personEntityId
  );

  if (existing) {
    return existing.id;
  }

  const result = await db.run(
    `INSERT INTO knowledge_relations
      (fromEntityType, fromEntityId, toEntityType, toEntityId, relationType, note, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    'knowledge_item',
    knowledgeItemId,
    'reference_entity',
    personEntityId,
    'created_by',
    null,
    createdAt
  );

  return result.lastID as number;
};

export const backfillKnowledgeItemCreatorRelations = async (db: DbConnection) => {
  const rows = await db.all<Array<{ id: number; creator?: string | null; createdAt: string }>>(
    `SELECT ki.id, ki.creator, ki.createdAt
     FROM knowledge_items ki
     WHERE NOT EXISTS (
       SELECT 1
       FROM knowledge_relations kr
       WHERE kr.fromEntityType = 'knowledge_item'
         AND kr.fromEntityId = ki.id
         AND kr.relationType = 'created_by'
     )`
  );

  for (const row of rows) {
    const creatorPerson = await resolveCanonicalCreatorPerson(db, {
      creatorText: row.creator ?? undefined,
    });
    await syncKnowledgeItemCreatorRelation(db, row.id, creatorPerson.id, row.createdAt);
  }
};
