import sqlite3 from 'sqlite3';
import { open, type Database } from 'sqlite';
import path from 'path';
import { syncLegacyReferenceEntities } from '../lib/referenceEntities';

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
    -- Create subjects table
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      parentId INTEGER,
      FOREIGN KEY (parentId) REFERENCES subjects(id)
    );

    -- Create authors table
    CREATE TABLE IF NOT EXISTS authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      yearOfBirth INTEGER,
      yearOfDeath INTEGER,
      countryId INTEGER,
      description TEXT,
      imageUrl TEXT,
      link TEXT,
      subjectIds TEXT, -- JSON array of subject IDs
      FOREIGN KEY (countryId) REFERENCES nations(id)
    );

    -- Create civilizations table
    CREATE TABLE IF NOT EXISTS civilizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      nationIds TEXT, -- JSON array of nation IDs
      description TEXT,
      parentId INTEGER,
      FOREIGN KEY (parentId) REFERENCES civilizations(id)
    );

    -- Create nations table
    CREATE TABLE IF NOT EXISTS nations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      beginYear INTEGER,
      endYear INTEGER,
      description TEXT,
      imageUrl TEXT,
      link TEXT,
      authorIds TEXT, -- JSON array of author IDs
      civilizationId INTEGER,
      eraIds TEXT, -- JSON array of era IDs
      FOREIGN KEY (civilizationId) REFERENCES civilizations(id)
    );

    -- Create eras table
    CREATE TABLE IF NOT EXISTS eras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      beginYear INTEGER,
      endYear INTEGER,
      description TEXT,
      civilizationId INTEGER,
      FOREIGN KEY (civilizationId) REFERENCES civilizations(id)
    );

    -- Create books table (updated schema)
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      authorId INTEGER NOT NULL,
      subjectIds TEXT NOT NULL, -- JSON array of subject IDs
      year INTEGER,
      pages INTEGER,
      isRead INTEGER DEFAULT 0, -- 0 for false, 1 for true
      rating INTEGER,
      coverImageUrl TEXT,
      description TEXT,
      FOREIGN KEY (authorId) REFERENCES authors(id)
    );

    -- Create lectures table (updated schema)
    CREATE TABLE IF NOT EXISTS lectures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      speakerId TEXT NOT NULL, -- Can be number (author ID) or string (speaker name)
      subjectIds TEXT NOT NULL, -- JSON array of subject IDs
      year INTEGER,
      duration INTEGER,
      link TEXT
    );

    -- Create notes table
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parentId INTEGER NOT NULL,
      parentType TEXT NOT NULL, -- 'book' or 'lecture'
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    -- Create comments table
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parentId INTEGER NOT NULL,
      parentType TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL
      -- userId INTEGER, -- Add if you implement users
      -- FOREIGN KEY (userId) REFERENCES users(id)
    );

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

    CREATE TABLE IF NOT EXISTS knowledge_item_topics (
      knowledgeItemId INTEGER NOT NULL,
      topicId INTEGER NOT NULL,
      sortOrder INTEGER DEFAULT 0,
      PRIMARY KEY (knowledgeItemId, topicId),
      FOREIGN KEY (knowledgeItemId) REFERENCES knowledge_items(id) ON DELETE CASCADE,
      FOREIGN KEY (topicId) REFERENCES topics(id) ON DELETE CASCADE
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
    CREATE INDEX IF NOT EXISTS idx_knowledge_notes_item ON knowledge_notes(knowledgeItemId);
    CREATE INDEX IF NOT EXISTS idx_knowledge_relations_from
      ON knowledge_relations(fromEntityType, fromEntityId, createdAt DESC);
    CREATE INDEX IF NOT EXISTS idx_knowledge_tasks_item ON knowledge_tasks(knowledgeItemId);
    CREATE INDEX IF NOT EXISTS idx_knowledge_reviews_item ON knowledge_reviews(knowledgeItemId);

    -- Insert some default data
    INSERT OR IGNORE INTO subjects (id, name) VALUES (1, 'General');
    INSERT OR IGNORE INTO authors (id, name) VALUES (1, 'Unknown Author');
  `);

  const now = new Date().toISOString();

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

  await syncLegacyReferenceEntities(db);

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
