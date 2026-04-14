import * as SQLite from 'expo-sqlite';
import { Video, Segment } from '../types';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('dancewithme.db');
  }
  return db;
}

export async function initDb(): Promise<void> {
  const database = await getDb();
  await database.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      duration REAL NOT NULL DEFAULT 0,
      localPath TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      videoId INTEGER NOT NULL,
      startTime REAL NOT NULL,
      endTime REAL NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (videoId) REFERENCES videos(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  // Migration: add thumbnailPath column if it doesn't exist yet
  try {
    await database.execAsync('ALTER TABLE videos ADD COLUMN thumbnailPath TEXT');
  } catch {
    // Column already exists — ignore
  }
}

// Videos
export async function insertVideo(
  filename: string,
  duration: number,
  localPath: string,
  thumbnailPath?: string
): Promise<number> {
  const database = await getDb();
  const result = await database.runAsync(
    'INSERT INTO videos (filename, duration, localPath, thumbnailPath, createdAt) VALUES (?, ?, ?, ?, ?)',
    filename,
    duration,
    localPath,
    thumbnailPath ?? null,
    new Date().toISOString()
  );
  return result.lastInsertRowId;
}

export async function updateVideoThumbnail(id: number, thumbnailPath: string): Promise<void> {
  const database = await getDb();
  await database.runAsync('UPDATE videos SET thumbnailPath = ? WHERE id = ?', thumbnailPath, id);
}

export async function getAllVideos(): Promise<Video[]> {
  const database = await getDb();
  return database.getAllAsync<Video>(
    'SELECT * FROM videos ORDER BY createdAt DESC'
  );
}

export async function getVideo(id: number): Promise<Video | null> {
  const database = await getDb();
  return database.getFirstAsync<Video>('SELECT * FROM videos WHERE id = ?', id);
}

export async function deleteVideo(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM videos WHERE id = ?', id);
}

// Segments
export async function getSegmentsForVideo(videoId: number): Promise<Segment[]> {
  const database = await getDb();
  return database.getAllAsync<Segment>(
    'SELECT * FROM segments WHERE videoId = ? ORDER BY startTime ASC',
    videoId
  );
}

export async function insertSegment(
  videoId: number,
  startTime: number,
  endTime: number
): Promise<number> {
  const database = await getDb();
  const result = await database.runAsync(
    'INSERT INTO segments (videoId, startTime, endTime, createdAt) VALUES (?, ?, ?, ?)',
    videoId,
    startTime,
    endTime,
    new Date().toISOString()
  );
  return result.lastInsertRowId;
}

export async function deleteSegment(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM segments WHERE id = ?', id);
}

export async function renameVideo(id: number, newFilename: string): Promise<void> {
  const database = await getDb();
  await database.runAsync('UPDATE videos SET filename = ? WHERE id = ?', newFilename.trim(), id);
}

// Settings
export async function getSetting(key: string): Promise<string | null> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?', key
  );
  return row?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, value
  );
}

export async function getFilenamesByPrefix(prefix: string): Promise<string[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<{ filename: string }>(
    'SELECT filename FROM videos WHERE filename LIKE ?',
    `${prefix}%`
  );
  return rows.map((r) => r.filename);
}

export async function updateVideoDuration(
  id: number,
  duration: number
): Promise<void> {
  const database = await getDb();
  await database.runAsync('UPDATE videos SET duration = ? WHERE id = ?', duration, id);
}
