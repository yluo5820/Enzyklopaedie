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
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      subjectId INTEGER,
      year INTEGER,
      pages INTEGER,
      isRead INTEGER DEFAULT 0, -- 0 for false, 1 for true
      rating INTEGER,
      coverImageUrl TEXT,
      description TEXT,
      FOREIGN KEY (subjectId) REFERENCES subjects(id)
    );

    CREATE TABLE IF NOT EXISTS lectures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      speaker TEXT NOT NULL,
      subjectId INTEGER,
      year INTEGER,
      duration INTEGER,
      link TEXT,
      FOREIGN KEY (subjectId) REFERENCES subjects(id)
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parentId INTEGER NOT NULL,
      parentType TEXT NOT NULL, -- 'book' or 'lecture'
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parentId INTEGER NOT NULL,
      parentType TEXT NOT NULL,
      content TEXT NOT NULL,
      timestamp TEXT NOT NULL
      -- userId INTEGER, -- Add if you implement users
      -- FOREIGN KEY (userId) REFERENCES users(id)
    );
  `);

  console.log('Database initialized successfully.');
  return db;
}

export const getDb = async () => {
  return open({
    filename: DB_PATH,
    driver: sqlite3.Database,
  });
};