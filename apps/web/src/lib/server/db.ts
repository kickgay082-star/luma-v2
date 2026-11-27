import { DatabaseSync, SQLInputValue } from 'node:sqlite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import {
  DEFAULT_AVATAR_CONFIG,
  DEFAULT_ROOM_CUSTOMIZATION,
  ROOM_THEMES,
  RoomThemeId,
} from '@luma/shared';

function resolveDbPath(): string {
  if (process.env.LUMA_DB_PATH) {
    return path.resolve(process.env.LUMA_DB_PATH);
  }
  if (process.env.VERCEL === '1') {
    return '/tmp/luma.db';
  }
  const cwd = process.cwd();
  return cwd.endsWith('web')
    ? path.resolve(cwd, '..', '..', 'data', 'luma.db')
    : path.resolve(cwd, 'data', 'luma.db');
}

function toPgSql(sql: string): string {
  let idx = 0;
  return sql.replace(/\?/g, () => `$${++idx}`);
}

const globalForDb = globalThis as unknown as {
  __lumaWebSqlite?: DatabaseSync;
  __lumaWebPg?: Pool;
  __lumaWebInit?: Promise<void>;
};

function isPostgres(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
}

function getSqlite(): DatabaseSync {
  if (globalForDb.__lumaWebSqlite) return globalForDb.__lumaWebSqlite;
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  globalForDb.__lumaWebSqlite = db;
  return db;
}

function getPgPool(): Pool {
  if (globalForDb.__lumaWebPg) return globalForDb.__lumaWebPg;
  const conn = process.env.DATABASE_URL!;
  const isLocal = conn.includes('localhost') || conn.includes('127.0.0.1');
  globalForDb.__lumaWebPg = new Pool({
    connectionString: conn,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 10,
  });
  return globalForDb.__lumaWebPg;
}

async function ensureReady(): Promise<void> {
  if (globalForDb.__lumaWebInit) return globalForDb.__lumaWebInit;

  globalForDb.__lumaWebInit = (async () => {
    const ddl = `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        email TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        avatar_json TEXT NOT NULL,
        settings_json TEXT NOT NULL DEFAULT '{}',
        last_seen_at BIGINT NOT NULL DEFAULT 0,
        created_at BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        owner_id TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        theme TEXT NOT NULL,
        category TEXT NOT NULL,
        privacy TEXT NOT NULL,
        password_hash TEXT,
        max_users INTEGER NOT NULL DEFAULT 24,
        thumbnail_url TEXT,
        customization_json TEXT NOT NULL,
        is_featured INTEGER NOT NULL DEFAULT 0,
        created_at BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS room_visits (
        user_id TEXT NOT NULL,
        room_id TEXT NOT NULL,
        visited_at BIGINT NOT NULL,
        PRIMARY KEY (user_id, room_id)
      );
      CREATE TABLE IF NOT EXISTS friendships (
        id TEXT PRIMARY KEY,
        requester_id TEXT NOT NULL,
        addressee_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        UNIQUE(requester_id, addressee_id)
      );
      CREATE TABLE IF NOT EXISTS room_invites (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        recipient_id TEXT NOT NULL,
        created_at BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS iptv_playlists (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        source_url TEXT,
        channels_json TEXT NOT NULL,
        created_at BIGINT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS iptv_favorites (
        user_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        channel_json TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        PRIMARY KEY (user_id, channel_id)
      );
      CREATE TABLE IF NOT EXISTS iptv_recents (
        user_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        channel_json TEXT NOT NULL,
        watched_at BIGINT NOT NULL,
        PRIMARY KEY (user_id, channel_id)
      );
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        display_name TEXT NOT NULL,
        content TEXT NOT NULL,
        pinned INTEGER NOT NULL DEFAULT 0,
        reactions_json TEXT NOT NULL DEFAULT '{}',
        type TEXT NOT NULL DEFAULT 'chat',
        created_at BIGINT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_chat_room_created ON chat_messages(room_id, created_at);
    `;

    if (isPostgres()) {
      await getPgPool().query(ddl);
    } else {
      getSqlite().exec(ddl);
    }

    await seedInitialData();
  })().catch((err) => {
    globalForDb.__lumaWebInit = undefined;
    throw err;
  });

  return globalForDb.__lumaWebInit;
}

async function seedInitialData(): Promise<void> {
  const countRow = await rawQueryOne<{ c: number | string }>('SELECT COUNT(*) as c FROM rooms');
  if (Number(countRow?.c ?? 0) > 0) return;

  const systemOwnerId = 'luma-studio';
  const now = Date.now();

  const existingSystem = await rawQueryOne<{ id?: string }>(
    'SELECT id FROM users WHERE id = ?',
    [systemOwnerId],
  );

  if (!existingSystem) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(crypto.randomBytes(24).toString('hex'), salt, 64).toString('hex');
    await rawExecute(
      `INSERT INTO users (id, username, display_name, email, password_hash, avatar_json, settings_json, last_seen_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (id) DO NOTHING`,
      [
        systemOwnerId,
        'lumastudio',
        'Luma Küratör',
        'curator@luma.local',
        `${salt}:${hash}`,
        JSON.stringify(DEFAULT_AVATAR_CONFIG),
        JSON.stringify({}),
        now,
        now,
      ],
    );
  }

  const featuredSeeds: Array<{
    id: string;
    code: string;
    name: string;
    description: string;
    theme: RoomThemeId;
    category: string;
    seatLayout: 'theater' | 'lounge-u' | 'circle' | 'duo-rows';
  }> = [
    {
      id: 'luma-imax-01',
      code: 'LUMA01',
      name: 'Grand Noir Sinema',
      description: 'Kademeli IMAX koltukları ve mekânsal ses ile gece gösterimi.',
      theme: 'premium-cinema',
      category: 'cinema',
      seatLayout: 'theater',
    },
    {
      id: 'luma-lounge-02',
      code: 'LOUNGE',
      name: 'Gece Lounge & Sohbet',
      description: 'Arkadaşlarla buluşma, yakınsal sohbet ve ortak YouTube sırası.',
      theme: 'modern-lounge',
      category: 'lounge',
      seatLayout: 'lounge-u',
    },
    {
      id: 'luma-space-03',
      code: 'ORBIT3',
      name: 'Yörünge Gözlem Salonu',
      description: 'Uzay istasyonu manzarasında canlı yayınlar ve belgesel izleme.',
      theme: 'space-room',
      category: 'watch-party',
      seatLayout: 'circle',
    },
    {
      id: 'luma-city-04',
      code: 'SKY04',
      name: 'Penthouse Gece Kulübü',
      description: 'Şehir silüetine bakan penthouse lounge ve IPTV izleme odası.',
      theme: 'neon-city',
      category: 'iptv',
      seatLayout: 'duo-rows',
    },
  ];

  for (const seed of featuredSeeds) {
    const meta = ROOM_THEMES[seed.theme];
    const custom = {
      ...DEFAULT_ROOM_CUSTOMIZATION,
      theme: seed.theme,
      lightColor: meta.defaultLightColor,
      ambientIntensity: meta.defaultAmbient,
      seatLayout: seed.seatLayout,
    };
    await rawExecute(
      `INSERT INTO rooms (id, code, name, description, owner_id, owner_name, theme, category, privacy, password_hash, max_users, customization_json, is_featured, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'public', NULL, 24, ?, 1, ?)
       ON CONFLICT (id) DO NOTHING`,
      [
        seed.id,
        seed.code,
        seed.name,
        seed.description,
        systemOwnerId,
        'Luma Küratör',
        seed.theme,
        seed.category,
        JSON.stringify(custom),
        now,
      ],
    );
  }
}

async function rawQueryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  if (isPostgres()) {
    const res = await getPgPool().query(toPgSql(sql), params);
    return res.rows[0] as T | undefined;
  }
  return getSqlite().prepare(sql).get(...(params as SQLInputValue[])) as T | undefined;
}

async function rawExecute(sql: string, params: unknown[] = []): Promise<void> {
  if (isPostgres()) {
    await getPgPool().query(toPgSql(sql), params);
    return;
  }
  getSqlite().prepare(sql).run(...(params as SQLInputValue[]));
}

export async function dbQueryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  await ensureReady();
  return rawQueryOne<T>(sql, params);
}

export async function dbQueryAll<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensureReady();
  if (isPostgres()) {
    const res = await getPgPool().query(toPgSql(sql), params);
    return res.rows as T[];
  }
  return getSqlite().prepare(sql).all(...(params as SQLInputValue[])) as T[];
}

export async function dbExecute(sql: string, params: unknown[] = []): Promise<void> {
  await ensureReady();
  await rawExecute(sql, params);
}
