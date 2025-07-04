import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data.db');

export async function initializeDatabase() {
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });

  // Create tables if they don't exist
  await db.exec(`
    -- Drop existing tables to recreate with new schema
    DROP TABLE IF EXISTS comments;
    DROP TABLE IF EXISTS notes;
    DROP TABLE IF EXISTS lectures;
    DROP TABLE IF EXISTS books;
    DROP TABLE IF EXISTS subjects;
    DROP TABLE IF EXISTS authors;
    DROP TABLE IF EXISTS nations;
    DROP TABLE IF EXISTS civilizations;
    DROP TABLE IF EXISTS eras;

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

    -- Insert some default data
    INSERT OR IGNORE INTO subjects (id, name) VALUES (1, 'General');
    INSERT OR IGNORE INTO authors (id, name) VALUES (1, 'Unknown Author');
  `);

  console.log('Database initialized successfully with new schema.');
  return db;
}

export const getDb = async () => {
  return open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });
};