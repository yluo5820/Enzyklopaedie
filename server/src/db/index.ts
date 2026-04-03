import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data.db');
let dbPromise: Promise<Database<sqlite3.Database, sqlite3.Statement>> | null = null;

const openDatabase = () => {
  if (!dbPromise) {
    dbPromise = open({
      filename: DB_PATH,
      driver: sqlite3.Database,
    }).then(async (db) => {
      await db.exec('PRAGMA foreign_keys = ON');
      return db;
    });
  }

  return dbPromise;
};

export async function initializeDatabase() {
  const db = await openDatabase();

  // Create tables if they don't exist
  await db.exec(`
    -- Create the new knowledge domain tables
    CREATE TABLE IF NOT EXISTS knowledge_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      creator TEXT,
      sourceName TEXT,
      sourceUrl TEXT,
      summary TEXT,
      description TEXT,
      publishedYear INTEGER,
      startedOn TEXT,
      completedOn TEXT,
      status TEXT NOT NULL DEFAULT 'inbox',
      rating INTEGER,
      coverImageUrl TEXT,
      metadata TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      description TEXT,
      parentTopicId INTEGER,
      color TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (parentTopicId) REFERENCES topics(id)
    );

    CREATE TABLE IF NOT EXISTS reference_entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      summary TEXT,
      description TEXT,
      startYear INTEGER,
      endYear INTEGER,
      metadata TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS study_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subjectId INTEGER NOT NULL,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      summary TEXT,
      description TEXT,
      parentTopicId INTEGER,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (subjectId) REFERENCES topics(id) ON DELETE CASCADE,
      FOREIGN KEY (parentTopicId) REFERENCES study_topics(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS knowledge_item_study_topics (
      knowledgeItemId INTEGER NOT NULL,
      studyTopicId INTEGER NOT NULL,
      sortOrder INTEGER DEFAULT 0,
      PRIMARY KEY (knowledgeItemId, studyTopicId),
      FOREIGN KEY (knowledgeItemId) REFERENCES knowledge_items(id) ON DELETE CASCADE,
      FOREIGN KEY (studyTopicId) REFERENCES study_topics(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS knowledge_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      knowledgeItemId INTEGER NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (knowledgeItemId) REFERENCES knowledge_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS knowledge_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fromEntityType TEXT NOT NULL,
      fromEntityId INTEGER NOT NULL,
      toEntityType TEXT NOT NULL,
      toEntityId INTEGER NOT NULL,
      relationType TEXT NOT NULL,
      note TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS knowledge_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      knowledgeItemId INTEGER NOT NULL,
      title TEXT NOT NULL,
      details TEXT,
      status TEXT NOT NULL DEFAULT 'todo',
      dueAt TEXT,
      scheduledFor TEXT,
      completedAt TEXT,
      sortOrder INTEGER DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (knowledgeItemId) REFERENCES knowledge_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS knowledge_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      knowledgeItemId INTEGER NOT NULL,
      score INTEGER,
      summary TEXT,
      body TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (knowledgeItemId) REFERENCES knowledge_items(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS activity_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      entityType TEXT NOT NULL,
      entityId INTEGER NOT NULL,
      message TEXT NOT NULL,
      metadata TEXT,
      occurredAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS places (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      latitude REAL,
      longitude REAL,
      bounds TEXT,
      description TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS timeline_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      startYear INTEGER,
      endYear INTEGER,
      placeId INTEGER,
      description TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      FOREIGN KEY (placeId) REFERENCES places(id)
    );

    CREATE TABLE IF NOT EXISTS canonical_historical_entities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      authority TEXT NOT NULL,
      authorityId TEXT NOT NULL,
      kind TEXT NOT NULL,
      referenceEntityId INTEGER,
      title TEXT NOT NULL,
      summary TEXT,
      description TEXT,
      startYear INTEGER,
      endYear INTEGER,
      latitude REAL,
      longitude REAL,
      imageUrl TEXT,
      sourceUrl TEXT,
      metadata TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(authority, authorityId),
      FOREIGN KEY (referenceEntityId) REFERENCES reference_entities(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS exhibits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      summary TEXT,
      description TEXT,
      isPublished INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_items_kind ON knowledge_items(kind);
    CREATE INDEX IF NOT EXISTS idx_knowledge_items_status ON knowledge_items(status);
    CREATE INDEX IF NOT EXISTS idx_activity_events_occurred_at ON activity_events(occurredAt DESC);
    CREATE INDEX IF NOT EXISTS idx_reference_entities_kind ON reference_entities(kind);
    CREATE INDEX IF NOT EXISTS idx_reference_entities_title ON reference_entities(lower(title));
    CREATE INDEX IF NOT EXISTS idx_study_topics_subject ON study_topics(subjectId, lower(name));
    CREATE INDEX IF NOT EXISTS idx_study_topics_parent ON study_topics(parentTopicId, lower(name));
    CREATE INDEX IF NOT EXISTS idx_knowledge_item_study_topics_item
      ON knowledge_item_study_topics(knowledgeItemId, sortOrder, studyTopicId);
    CREATE INDEX IF NOT EXISTS idx_knowledge_notes_item ON knowledge_notes(knowledgeItemId);
    CREATE INDEX IF NOT EXISTS idx_knowledge_relations_from
      ON knowledge_relations(fromEntityType, fromEntityId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_knowledge_tasks_item ON knowledge_tasks(knowledgeItemId);
    CREATE INDEX IF NOT EXISTS idx_knowledge_reviews_item ON knowledge_reviews(knowledgeItemId);
    CREATE INDEX IF NOT EXISTS idx_canonical_historical_entities_kind
      ON canonical_historical_entities(kind, lower(title));
    CREATE INDEX IF NOT EXISTS idx_canonical_historical_entities_years
      ON canonical_historical_entities(startYear, endYear);
  `);

  const now = new Date().toISOString();

  const canonicalHistoricalColumns = await db.all<{ name: string }[]>(
    `PRAGMA table_info(canonical_historical_entities)`
  );
  if (
    canonicalHistoricalColumns.length > 0 &&
    !canonicalHistoricalColumns.some((column) => column.name === 'referenceEntityId')
  ) {
    await db.exec(
      `ALTER TABLE canonical_historical_entities
       ADD COLUMN referenceEntityId INTEGER REFERENCES reference_entities(id) ON DELETE SET NULL`
    );
  }

  await db.run(
    `INSERT OR IGNORE INTO topics (name, slug, description, parentTopicId, color, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    'Ontology',
    'ontology',
    'The root of the encyclopedia taxonomy.',
    null,
    '#8d5d35',
    now,
    now
  );

  await db.run(
    `UPDATE topics
     SET parentTopicId = NULL, updatedAt = ?
     WHERE slug = 'ontology' AND parentTopicId IS NOT NULL`,
    now
  );

  await db.run(
    `UPDATE topics
     SET parentTopicId = (SELECT id FROM topics WHERE slug = 'ontology'),
         updatedAt = ?
     WHERE slug != 'ontology' AND parentTopicId IS NULL`,
    now
  );

  await db.run(
    `UPDATE knowledge_items
     SET kind = 'book', updatedAt = ?
     WHERE kind IN ('article', 'essay')`,
    now
  );

  await db.run(
    `UPDATE knowledge_items
     SET kind = 'lecture', updatedAt = ?
     WHERE kind IN ('video', 'podcast', 'course', 'artifact')`,
    now
  );

  await db.run(
    `UPDATE knowledge_relations
     SET fromEntityType = CASE fromEntityType
           WHEN 'study_topic' THEN 'topic'
           WHEN 'topic' THEN 'subject'
           ELSE fromEntityType
         END,
         toEntityType = CASE toEntityType
           WHEN 'study_topic' THEN 'topic'
           WHEN 'topic' THEN 'subject'
           ELSE toEntityType
         END
     WHERE fromEntityType IN ('topic', 'study_topic')
        OR toEntityType IN ('topic', 'study_topic')`
  );

  await db.run(
    `UPDATE activity_events
     SET entityType = CASE entityType
           WHEN 'study_topic' THEN 'topic'
           WHEN 'topic' THEN 'subject'
           ELSE entityType
         END
     WHERE entityType IN ('topic', 'study_topic')`
  );

  await db.run(
    `INSERT OR IGNORE INTO reference_entities
      (kind, title, slug, summary, description, startYear, endYear, metadata, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    'person',
    'Unknown Author',
    'person-unknown-author',
    'Fallback person record for items without a resolved creator entity.',
    null,
    null,
    null,
    null,
    now,
    now
  );

  console.log('Database initialized successfully with new schema.');
  return db;
}

export const getDb = async () => {
  return openDatabase();
};

export const closeDb = async () => {
  if (!dbPromise) return;

  const db = await dbPromise;
  dbPromise = null;
  await db.close();
};
