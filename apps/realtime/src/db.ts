import { DatabaseSync, SQLInputValue } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import {
  AvatarConfig,
  ChatMessage,
  DEFAULT_AVATAR_CONFIG,
  DEFAULT_ROOM_CUSTOMIZATION,
  RoomCustomization,
  RoomSummary,
} from '@luma/shared';

function resolveDbPath(): string {
  if (process.env.LUMA_DB_PATH) {
    return path.resolve(process.env.LUMA_DB_PATH);
  }
  const cwd = process.cwd();
  return cwd.endsWith('realtime')
    ? path.resolve(cwd, '..', '..', 'data', 'luma.db')
    : path.resolve(cwd, 'data', 'luma.db');
}

function toPgSql(sql: string): string {
  let idx = 0;
  return sql.replace(/\?/g, () => `$${++idx}`);
}

let sqliteInstance: DatabaseSync | null = null;
let pgPool: Pool | null = null;
let initPromise: Promise<void> | null = null;

function isPostgres(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim());
}

function getSqlite(): DatabaseSync {
  if (sqliteInstance) return sqliteInstance;
  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  sqliteInstance = db;
  return db;
}

function getPgPool(): Pool {
  if (pgPool) return pgPool;
  const conn = process.env.DATABASE_URL!;
  const isLocal = conn.includes('localhost') || conn.includes('127.0.0.1');
  pgPool = new Pool({
    connectionString: conn,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 10,
  });
  return pgPool;
}

export async function ensureRealtimeDbReady(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
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
  })();
  return initPromise;
}

async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | undefined> {
  await ensureRealtimeDbReady();
  if (isPostgres()) {
    const res = await getPgPool().query(toPgSql(sql), params);
    return res.rows[0] as T | undefined;
  }
  return getSqlite().prepare(sql).get(...(params as SQLInputValue[])) as T | undefined;
}

async function queryAll<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  await ensureRealtimeDbReady();
  if (isPostgres()) {
    const res = await getPgPool().query(toPgSql(sql), params);
    return res.rows as T[];
  }
  return getSqlite().prepare(sql).all(...(params as SQLInputValue[])) as T[];
}

async function executeSql(sql: string, params: unknown[] = []): Promise<void> {
  await ensureRealtimeDbReady();
  if (isPostgres()) {
    await getPgPool().query(toPgSql(sql), params);
    return;
  }
  getSqlite().prepare(sql).run(...(params as SQLInputValue[]));
}

export async function closeRealtimeDb(): Promise<void> {
  if (pgPool) {
    await pgPool.end();
    pgPool = null;
  }
  if (sqliteInstance) {
    try {
      sqliteInstance.close();
    } catch {
      // ignore
    }
    sqliteInstance = null;
  }
  initPromise = null;
}

export function getRealtimeDbForTest() {
  return {
    executeSql,
    queryOne,
    queryAll,
    closeRealtimeDb,
  };
}

export interface PersistedRoomRecord {
  summary: RoomSummary;
  passwordHash: string | null;
  customization: RoomCustomization;
}

export async function loadRoomByIdOrCode(idOrCode: string): Promise<PersistedRoomRecord | null> {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT * FROM rooms WHERE id = ? OR UPPER(code) = UPPER(?) LIMIT 1`,
    [idOrCode, idOrCode],
  );

  if (!row) return null;

  let customization: RoomCustomization = { ...DEFAULT_ROOM_CUSTOMIZATION };
  try {
    customization = {
      ...DEFAULT_ROOM_CUSTOMIZATION,
      ...JSON.parse(String(row.customization_json || '{}')),
    };
  } catch {
    // keep default
  }

  return {
    summary: {
      id: String(row.id),
      code: String(row.code),
      name: String(row.name),
      description: String(row.description || ''),
      ownerId: String(row.owner_id),
      ownerName: String(row.owner_name),
      theme: String(row.theme) as RoomSummary['theme'],
      category: String(row.category) as RoomSummary['category'],
      privacy: String(row.privacy) as RoomSummary['privacy'],
      hasPassword: Boolean(row.password_hash),
      maxUsers: Number(row.max_users || 24),
      onlineCount: 0,
      thumbnailUrl: row.thumbnail_url ? String(row.thumbnail_url) : null,
      createdAt: Number(row.created_at),
      isFeatured: Boolean(row.is_featured),
    },
    passwordHash: row.password_hash ? String(row.password_hash) : null,
    customization,
  };
}

export async function loadUserAvatar(userId: string): Promise<AvatarConfig> {
  const row = await queryOne<{ avatar_json?: string }>(
    `SELECT avatar_json FROM users WHERE id = ? LIMIT 1`,
    [userId],
  );
  if (!row?.avatar_json) return DEFAULT_AVATAR_CONFIG;
  try {
    return { ...DEFAULT_AVATAR_CONFIG, ...JSON.parse(row.avatar_json) };
  } catch {
    return DEFAULT_AVATAR_CONFIG;
  }
}

export async function saveRoomCustomization(
  roomId: string,
  customization: RoomCustomization,
): Promise<void> {
  await executeSql(
    `UPDATE rooms SET theme = ?, max_users = ?, customization_json = ? WHERE id = ?`,
    [customization.theme, customization.maxUsers, JSON.stringify(customization), roomId],
  );
}

export async function updateRoomOwner(
  roomId: string,
  ownerId: string,
  ownerName: string,
): Promise<void> {
  await executeSql(`UPDATE rooms SET owner_id = ?, owner_name = ? WHERE id = ?`, [
    ownerId,
    ownerName,
    roomId,
  ]);
}

export async function loadRecentChatMessages(
  roomId: string,
  limit: number = 60,
): Promise<ChatMessage[]> {
  const rows = await queryAll<Record<string, unknown>>(
    `SELECT * FROM chat_messages WHERE room_id = ? ORDER BY created_at DESC LIMIT ?`,
    [roomId, limit],
  );

  return rows.reverse().map((r) => ({
    id: String(r.id),
    roomId: String(r.room_id),
    userId: String(r.user_id),
    username: String(r.username),
    displayName: String(r.display_name),
    content: String(r.content),
    createdAt: Number(r.created_at),
    pinned: Boolean(r.pinned),
    reactions: safeParseReactions(r.reactions_json),
    type: r.type === 'system' ? 'system' : 'chat',
  }));
}

export async function insertChatMessage(msg: ChatMessage): Promise<void> {
  await executeSql(
    `INSERT INTO chat_messages (id, room_id, user_id, username, display_name, content, pinned, reactions_json, type, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      msg.id,
      msg.roomId,
      msg.userId,
      msg.username,
      msg.displayName,
      msg.content,
      msg.pinned ? 1 : 0,
      JSON.stringify(msg.reactions),
      msg.type,
      msg.createdAt,
    ],
  );
}

export async function updateChatMessageRecord(msg: ChatMessage): Promise<void> {
  await executeSql(`UPDATE chat_messages SET pinned = ?, reactions_json = ? WHERE id = ?`, [
    msg.pinned ? 1 : 0,
    JSON.stringify(msg.reactions),
    msg.id,
  ]);
}

export async function deleteChatMessageRecord(messageId: string): Promise<void> {
  await executeSql(`DELETE FROM chat_messages WHERE id = ?`, [messageId]);
}

function safeParseReactions(raw: unknown): Record<string, string[]> {
  if (typeof raw !== 'string') return {};
  try {
    return JSON.parse(raw) as Record<string, string[]>;
  } catch {
    return {};
  }
}
