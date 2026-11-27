import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { AvatarConfig, DEFAULT_AVATAR_CONFIG } from '@luma/shared';
import { dbExecute, dbQueryOne } from './db';

const SESSION_SECRET =
  process.env.SESSION_SECRET || 'luma-dev-session-secret-change-in-production-32chars';

export const SESSION_COOKIE_NAME = 'luma_session';

export interface AuthSession {
  userId: string;
  username: string;
  displayName: string;
  exp: number;
}

export interface AuthenticatedUser {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  avatar: AvatarConfig;
  settings: Record<string, unknown>;
  token: string;
}

export function hashPasswordScrypt(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPasswordScrypt(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, hashHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(hashHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function signSessionToken(payload: Omit<AuthSession, 'exp'>): string {
  const full: AuthSession = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 14, // 14 days
  };
  const b64 = Buffer.from(JSON.stringify(full)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(b64)
    .digest('base64url');
  return `${b64}.${sig}`;
}

export function verifySessionToken(token: string | undefined): AuthSession | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [b64, sig] = parts;
  const expected = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(b64)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8')) as AuthSession;
    if (
      typeof parsed.userId === 'string' &&
      typeof parsed.username === 'string' &&
      typeof parsed.displayName === 'string' &&
      typeof parsed.exp === 'number' &&
      parsed.exp > Date.now()
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session || !token) return null;

  const row = await dbQueryOne<Record<string, unknown>>(
    `SELECT id, username, display_name, email, avatar_json, settings_json FROM users WHERE id = ? LIMIT 1`,
    [session.userId],
  );

  if (!row) return null;

  // Update last_seen_at quietly
  await dbExecute(`UPDATE users SET last_seen_at = ? WHERE id = ?`, [
    Date.now(),
    session.userId,
  ]);

  let avatar = DEFAULT_AVATAR_CONFIG;
  try {
    avatar = { ...DEFAULT_AVATAR_CONFIG, ...JSON.parse(String(row.avatar_json || '{}')) };
  } catch {
    // keep default
  }

  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(String(row.settings_json || '{}'));
  } catch {
    // keep empty
  }

  return {
    id: String(row.id),
    username: String(row.username),
    displayName: String(row.display_name),
    email: row.email ? String(row.email) : null,
    avatar,
    settings,
    token,
  };
}

const requestBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkApiRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = requestBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    requestBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}
