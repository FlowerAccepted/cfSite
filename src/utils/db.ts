/**
 * Database connection utility for SQLite
 * 
 * This module provides a singleton database connection for the application.
 * It uses better-sqlite3 for synchronous SQLite operations.
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

let db: Database.Database | null = null;

function loadInitSql(): string {
  const initSqlPath = join(process.cwd(), 'db', 'init.sql');
  return readFileSync(initSqlPath, 'utf-8');
}

function ensureSchema(database: Database.Database): void {
  const articlesTable = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get('articles');

  if (!articlesTable) {
    database.exec(loadInitSql());
  }
}

export interface LocalUserSeed {
  uid: string;
  username: string;
  profile?: unknown;
}

/**
 * Get or create the database connection
 * @param dbPath - Path to the SQLite database file (defaults to ./data/app.db)
 * @returns Database instance
 */
export function getDatabase(dbPath: string = './data/app.db'): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    ensureSchema(db);
  }
  return db;
}

/**
 * Initialize the database schema from init.sql
 * @param dbPath - Path to the SQLite database file
 */
export function initializeDatabase(dbPath: string = './data/app.db'): void {
  const database = getDatabase(dbPath);
  database.exec(loadInitSql());
}

export function ensureLocalUser(database: Database.Database, user: LocalUserSeed): void {
  const uid = Number.parseInt(String(user.uid), 10);
  if (!Number.isFinite(uid)) {
    throw new Error(`Invalid uid for local user sync: ${user.uid}`);
  }

  const username = String(user.username || "").trim();
  if (!username) {
    throw new Error("Username is required for local user sync");
  }

  const profileJson = JSON.stringify(user.profile ?? {});
  const existing = database
    .prepare("SELECT uid FROM users WHERE uid = ?")
    .get(uid) as { uid: number } | undefined;

  if (existing) {
    database
      .prepare(
        `
        UPDATE users
        SET username = ?, profile = json(?)
        WHERE uid = ?
        `,
      )
      .run(username, profileJson, uid);
    return;
  }

  database
    .prepare(
      `
      INSERT INTO users (uid, username, password_hash, password_salt, create_time, profile)
      VALUES (?, ?, ?, ?, ?, json(?))
      `,
    )
    .run(uid, username, "", "", Date.now(), profileJson);
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Create an in-memory database for testing
 * @returns Database instance
 */
export function createTestDatabase(): Database.Database {
  const testDb = new Database(':memory:');
  testDb.pragma('foreign_keys = ON');
  testDb.exec(loadInitSql());
  
  return testDb;
}
